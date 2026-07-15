import { Prisma, Category } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { ProductResponse, ProductListResponse, ProductSearchResponse } from '../types/index.js';
import { filterByProximity } from './locationService.js';
import { deriveImageVariants } from './imageVariants.js';

export class ProductNotFoundError extends Error {
  constructor() {
    super('Produk tidak ditemukan');
    this.name = 'ProductNotFoundError';
  }
}

export interface ProductListOptions {
  category?: string;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'oldest' | 'distance_asc' | 'stock_asc';
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  maxPrice?: number;
  expiry?: 'Hari Ini' | '< 1 Jam' | '< 3 Jam' | '< 6 Jam';
  ids?: string[];
}

function toISO(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toProductResponse(
  product: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    originalPrice: number;
    discountedPrice: number;
    stock: number;
    imageUrl: string | null;
    storeName: string;
    storeAddress: string | null;
    storeLat: number | null;
    storeLng: number | null;
    expiresAt: Date | string;
    isActive: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
  },
  distanceKm?: number
): ProductResponse {
  const discountPercent = Math.round(
    ((product.originalPrice - product.discountedPrice) / product.originalPrice) * 100
  );
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    originalPrice: product.originalPrice,
    discountedPrice: product.discountedPrice,
    discountPercent,
    stock: product.stock,
    imageUrl: product.imageUrl,
    imageVariants: deriveImageVariants(product.imageUrl),
    storeName: product.storeName,
    storeAddress: product.storeAddress,
    storeLat: product.storeLat,
    storeLng: product.storeLng,
    distanceKm: (distanceKm !== undefined ? distanceKm : undefined) as number | undefined,
    expiresAt: toISO(product.expiresAt),
    isActive: product.isActive,
    createdAt: toISO(product.createdAt),
    updatedAt: toISO(product.updatedAt),
  };
}

export async function findAll(options: ProductListOptions = {}): Promise<ProductListResponse> {
  const { category, sort = 'newest', page = 1, limit = 20, lat, lng, radius, maxPrice, expiry, ids } = options;

  const where: Prisma.ProductWhereInput = { isActive: true };
  if (category) {
    where.category = category as Prisma.EnumCategoryFilter['equals'];
  }
  if (ids && ids.length > 0) {
    where.id = { in: ids };
  }
  if (maxPrice !== undefined) {
    where.discountedPrice = { lte: maxPrice };
  }
  if (expiry) {
    const now = new Date();
    switch (expiry) {
      case 'Hari Ini': {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        where.expiresAt = { lte: endOfDay };
        break;
      }
      case '< 1 Jam':
        where.expiresAt = { lte: new Date(now.getTime() + 60 * 60 * 1000) };
        break;
      case '< 3 Jam':
        where.expiresAt = { lte: new Date(now.getTime() + 3 * 60 * 60 * 1000) };
        break;
      case '< 6 Jam':
        where.expiresAt = { lte: new Date(now.getTime() + 6 * 60 * 60 * 1000) };
        break;
    }
  }

  // Proximity flow: fetch ALL products, compute distances, filter, sort, paginate in-memory
  if (lat !== undefined && lng !== undefined) {
    const allProducts = await prisma.product.findMany({ where });

    let withDistance = filterByProximity(allProducts, lat, lng, radius);

    // Sort by distance or standard criteria
    if (sort === 'distance_asc') {
      withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
    } else {
      switch (sort) {
        case 'price_asc':
          withDistance.sort((a, b) => a.discountedPrice - b.discountedPrice);
          break;
        case 'price_desc':
          withDistance.sort((a, b) => b.discountedPrice - a.discountedPrice);
          break;
        case 'stock_asc':
          withDistance.sort((a, b) => a.stock - b.stock);
          break;
        case 'oldest':
          withDistance.sort(
            (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
          );
          break;
        case 'newest':
        default:
          withDistance.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          break;
      }
    }

    const total = withDistance.length;
    const skip = (page - 1) * limit;
    const paginated = withDistance.slice(skip, skip + limit);

    return {
      products: paginated.map((p) => toProductResponse(p, p.distanceKm)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Standard flow (no proximity): use SQL-level pagination
  let orderBy: Prisma.ProductOrderByWithRelationInput;
  switch (sort) {
    case 'price_asc':
      orderBy = { discountedPrice: 'asc' };
      break;
    case 'price_desc':
      orderBy = { discountedPrice: 'desc' };
      break;
    case 'stock_asc':
      orderBy = { stock: 'asc' };
      break;
    case 'oldest':
      orderBy = { createdAt: 'asc' };
      break;
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' };
      break;
  }

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: products.map(toProductResponse),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function findById(id: string): Promise<ProductResponse> {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new ProductNotFoundError();
  }
  return toProductResponse(product);
}

export interface SearchOptions {
  q: string;
  category?: string;
  page: number;
  limit: number;
}

export interface CreateProductInput {
  name: string;
  description?: string | null;
  category: string;
  originalPrice: number;
  discountedPrice: number;
  stock: number;
  imageUrl?: string | null;
  storeName: string;
  storeAddress?: string | null;
  storeLat?: number | null;
  storeLng?: number | null;
  expiresAt: string;
  mitraId: string;
}

export async function create(input: CreateProductInput): Promise<ProductResponse> {
  const product = await prisma.product.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      category: input.category as Category,
      originalPrice: input.originalPrice,
      discountedPrice: input.discountedPrice,
      stock: input.stock,
      imageUrl: input.imageUrl ?? null,
      storeName: input.storeName,
      storeAddress: input.storeAddress ?? null,
      storeLat: input.storeLat ?? null,
      storeLng: input.storeLng ?? null,
      expiresAt: new Date(input.expiresAt),
      mitraId: input.mitraId,
    },
  });

  return toProductResponse(product);
}

export async function search(options: SearchOptions): Promise<ProductSearchResponse> {
  const { q, category, page, limit } = options;

  // Use raw SQL for tsvector search with ILIKE fallback
  const categoryFilter = category ? `AND p."category" = $4` : '';
  const params: any[] = [q, limit, (page - 1) * limit];
  if (category) params.push(category);

  const products = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT p."id", p."name", p."description", p."category",
       p."originalPrice", p."discountedPrice", p."stock",
       p."imageUrl", p."storeName", p."storeAddress",
       p."storeLat", p."storeLng", p."expiresAt", p."isActive",
       p."createdAt", p."updatedAt",
       ts_rank(p."searchVector", plainto_tsquery('indonesian', $1)) AS rank
     FROM "products" p
     WHERE p."isActive" = true
       AND (p."searchVector" @@ plainto_tsquery('indonesian', $1)
            OR p."name" ILIKE '%' || $1 || '%'
            OR p."storeName" ILIKE '%' || $1 || '%')
       ${categoryFilter}
     ORDER BY rank DESC, p."createdAt" DESC
     LIMIT $2 OFFSET $3`,
    ...params
  );

  const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::int as count
     FROM "products" p
     WHERE p."isActive" = true
       AND (p."searchVector" @@ plainto_tsquery('indonesian', $1)
            OR p."name" ILIKE '%' || $1 || '%'
            OR p."storeName" ILIKE '%' || $1 || '%')
       ${categoryFilter}`,
    ...params.slice(0, category ? 2 : 1)
  );

  const total = Number(countResult[0]?.count || 0);

  // Track search query for trending
  if (q) {
    const normalizedQuery = q.toLowerCase().trim();
    prisma.searchQuery.upsert({
      where: { query: normalizedQuery },
      update: { count: { increment: 1 } },
      create: { query: normalizedQuery, count: 1 },
    }).catch(() => {}); // fire-and-forget, don't block search results
  }

  return {
    products: products.map(toProductResponse),
    total,
    page,
    limit,
    query: q,
  };
}
