import { prisma } from '../lib/prisma.js';
import type { ProductResponse } from '../types/index.js';
import { deriveImageVariants } from './imageVariants.js';
import { deleteFromSpaces, extractKeyFromUrl } from './uploadService.js';
import { AppError } from '../errors/AppError.js';

const MITRA_PRODUCT_ERROR_STATUSES: Record<string, number> = {
  PRODUCT_NOT_FOUND: 404,
};

export class MitraProductError extends AppError {
  constructor(message: string, code: string) {
    const statusCode = MITRA_PRODUCT_ERROR_STATUSES[code] ?? 400;
    super(message, statusCode, code);
    this.name = 'MitraProductError';
  }
}

function toISO(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toProductResponse(product: any): ProductResponse {
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
    expiresAt: toISO(product.expiresAt),
    isActive: product.isActive,
    createdAt: toISO(product.createdAt),
    updatedAt: toISO(product.updatedAt),
  };
}

export async function getMitraProducts(mitraId: string): Promise<ProductResponse[]> {
  const products = await prisma.product.findMany({
    where: { mitraId },
    orderBy: { createdAt: 'desc' },
  });
  return products.map(toProductResponse);
}

export async function updateMitraProduct(
  mitraId: string,
  productId: string,
  input: {
    name?: string;
    description?: string | null;
    category?: string;
    originalPrice?: number;
    discountedPrice?: number;
    stock?: number;
    imageUrl?: string | null;
    storeName?: string;
    storeAddress?: string | null;
    expiresAt?: string;
    isActive?: boolean;
  }
): Promise<ProductResponse> {
  const product = await prisma.product.findFirst({
    where: { id: productId, mitraId },
  });

  if (!product) {
    throw new MitraProductError('Produk tidak ditemukan atau bukan milik Anda', 'PRODUCT_NOT_FOUND');
  }

  const oldImageUrl = product.imageUrl;

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.category !== undefined && { category: input.category as any }),
      ...(input.originalPrice !== undefined && { originalPrice: input.originalPrice }),
      ...(input.discountedPrice !== undefined && { discountedPrice: input.discountedPrice }),
      ...(input.stock !== undefined && { stock: input.stock }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      ...(input.storeName !== undefined && { storeName: input.storeName }),
      ...(input.storeAddress !== undefined && { storeAddress: input.storeAddress }),
      ...(input.expiresAt !== undefined && { expiresAt: new Date(input.expiresAt) }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  // Check if stock was replenished (was 0, now > 0)
  if (input.stock !== undefined && product.stock === 0 && input.stock > 0) {
    await notifyStockReplenished(updated);
  }

  // If imageUrl changed, delete old image variants from DO Spaces (fire-and-forget)
  if (input.imageUrl !== undefined && oldImageUrl && oldImageUrl !== input.imageUrl) {
    const oldKey = extractKeyFromUrl(oldImageUrl);
    if (oldKey) {
      deleteFromSpaces(oldKey);
    }
  }

  return toProductResponse(updated);
}

export async function deleteMitraProduct(mitraId: string, productId: string): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: productId, mitraId },
    select: { id: true, imageUrl: true },
  });

  if (!product) {
    throw new MitraProductError('Produk tidak ditemukan atau bukan milik Anda', 'PRODUCT_NOT_FOUND');
  }

  await prisma.product.update({
    where: { id: productId },
    data: { isActive: false },
  });

  // Delete image variants from DO Spaces (fire-and-forget)
  const oldKey = extractKeyFromUrl(product.imageUrl);
  if (oldKey) {
    deleteFromSpaces(oldKey);
  }
}

async function notifyStockReplenished(product: { id: string; name: string }) {
  const subscriptions = await prisma.wishlistSubscription.findMany({
    where: { productId: product.id },
    include: { user: { select: { id: true } } },
  });

  if (subscriptions.length === 0) return;

  // Create notifications for all subscribed users in bulk
  await prisma.notification.createMany({
    data: subscriptions.map((sub) => ({
      userId: sub.user.id,
      title: 'Stok Favorit Tersedia',
      body: `${product.name} tersedia kembali. Segera pesan sebelum kehabisan!`,
      type: 'stock_alert',
      data: { productId: product.id },
    })),
  });

  // One-time alert per replenishment -- clear subscriptions
  await prisma.wishlistSubscription.deleteMany({
    where: { productId: product.id },
  });
}
