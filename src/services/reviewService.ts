import { prisma } from '../lib/prisma.js';
import type { CreateReviewInput } from '../validators/reviews.js';

export class ReviewError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ReviewError';
  }
}

export async function createReview(
  userId: string,
  orderId: string,
  input: CreateReviewInput
) {
  // Verify order exists and belongs to user
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: { take: 1 }, review: true },
  });

  if (!order) {
    throw new ReviewError('Pesanan tidak ditemukan', 'ORDER_NOT_FOUND');
  }

  // Guard: order must be PICKED_UP
  if (order.status !== 'PICKED_UP') {
    throw new ReviewError(
      'Hanya bisa mengulas pesanan yang sudah diambil',
      'ORDER_NOT_PICKED_UP'
    );
  }

  // Guard: no duplicate review
  if (order.review) {
    throw new ReviewError(
      'Pesanan ini sudah diulas',
      'DUPLICATE_REVIEW'
    );
  }

  // Get the product ID from the first order item
  const firstItem = order.items[0];
  if (!firstItem) {
    throw new ReviewError('Pesanan tidak memiliki produk', 'ORDER_HAS_NO_ITEMS');
  }

  const review = await prisma.review.create({
    data: {
      orderId,
      userId,
      productId: firstItem.productId,
      rating: input.rating,
      comment: input.comment || null,
      imageUrl: input.imageUrl || null,
    },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return review;
}

export interface ReviewListOptions {
  page: number;
  limit: number;
}

export async function getProductReviews(productId: string, opts: ReviewListOptions) {
  const { page, limit } = opts;
  const skip = (page - 1) * limit;

  const [reviews, total, aggregation] = await Promise.all([
    prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: { productId } }),
    prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  // Compute rating distribution
  const distributionRaw = await prisma.$queryRaw<Array<{ rating: number; count: bigint }>>`
    SELECT rating, COUNT(*)::int as count
    FROM reviews
    WHERE "productId" = ${productId}
    GROUP BY rating
  `;

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distributionRaw) {
    ratingDistribution[row.rating] = Number(row.count);
  }

  return {
    reviews,
    avgRating: aggregation._avg.rating ? Math.round(aggregation._avg.rating * 10) / 10 : null,
    totalReviews: total,
    ratingDistribution,
    pagination: { page, limit, total },
  };
}

export async function getMitraReviews(mitraUserId: string, opts: ReviewListOptions) {
  const { page, limit } = opts;
  const skip = (page - 1) * limit;

  // Get all products belonging to this mitra
  const mitraProducts = await prisma.product.findMany({
    where: { mitraId: mitraUserId },
    select: { id: true },
  });
  const productIds = mitraProducts.map((p) => p.id);

  if (productIds.length === 0) {
    return {
      reviews: [],
      avgRating: null,
      totalReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      pagination: { page, limit, total: 0 },
    };
  }

  const [reviews, total, aggregation] = await Promise.all([
    prisma.review.findMany({
      where: { productId: { in: productIds } },
      include: {
        product: { select: { id: true, name: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: { productId: { in: productIds } } }),
    prisma.review.aggregate({
      where: { productId: { in: productIds } },
      _avg: { rating: true },
    }),
  ]);

  return {
    reviews,
    avgRating: aggregation._avg.rating ? Math.round(aggregation._avg.rating * 10) / 10 : null,
    totalReviews: total,
    ratingDistribution: {},
    pagination: { page, limit, total },
  };
}

export interface TrustBadge {
  label: string;
  icon: 'verified' | 'hygiene' | 'freshness' | 'popular';
}

/**
 * Compute trust badges for a product based on:
 * - Mitra verification status (Verified badge)
 * - Avg rating >= 4.5 and >= 5 reviews (Higienis A+)
 * - Avg rating >= 4.0 and >= 3 reviews (Higienis B+)
 */
export async function computeTrustBadges(productId: string): Promise<TrustBadge[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      mitra: {
        select: { mitraProfile: { select: { verificationStatus: true } } },
      },
    },
  });

  const aggregation = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const badges: TrustBadge[] = [];

  // Verified badge
  if (product?.mitra?.mitraProfile?.verificationStatus === 'VERIFIED') {
    badges.push({ label: 'Terverifikasi LastBite', icon: 'verified' });
  }

  // Hygiene badge based on rating
  const avgRating = aggregation._avg.rating || 0;
  const reviewCount = aggregation._count.rating || 0;

  if (avgRating >= 4.5 && reviewCount >= 5) {
    badges.push({ label: 'Higienis A+', icon: 'hygiene' });
  } else if (avgRating >= 4.0 && reviewCount >= 3) {
    badges.push({ label: 'Higienis B+', icon: 'hygiene' });
  }

  // Popular badge
  if (reviewCount >= 10) {
    badges.push({ label: 'Populer', icon: 'popular' });
  }

  return badges;
}
