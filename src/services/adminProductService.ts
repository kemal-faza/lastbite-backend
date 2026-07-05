import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export interface ListProductsInput {
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listAllProducts(input: ListProductsInput = {}) {
  const { isActive, search, page = 1, limit = 20 } = input;
  const where: Prisma.ProductWhereInput = {};

  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        category: true,
        originalPrice: true,
        discountedPrice: true,
        stock: true,
        storeName: true,
        isActive: true,
        createdAt: true,
        mitra: { select: { email: true } },
        _count: { select: { cartItems: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      originalPrice: p.originalPrice,
      discountedPrice: p.discountedPrice,
      stock: p.stock,
      storeName: p.storeName,
      isActive: p.isActive,
      mitraEmail: p.mitra?.email || null,
      createdAt: p.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function toggleProduct(productId: string, isActive: boolean) {
  const product = await prisma.product.update({
    where: { id: productId },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });

  return product;
}
