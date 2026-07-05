import { prisma } from '../lib/prisma.js';
import type { MitraStatsResponse } from '../types/index.js';

export async function getMitraStats(mitraId: string): Promise<MitraStatsResponse> {
  const products = await prisma.product.findMany({
    where: { mitraId },
    select: { stock: true, id: true },
  });

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const productCount = products.length;
  const productIds = products.map((p) => p.id);

  // Count sold items from completed orders containing this mitra's products
  const orderItems = await prisma.orderItem.findMany({
    where: {
      productId: { in: productIds },
      order: { status: { in: ['PICKED_UP', 'READY'] } },
    },
    select: { quantity: true },
  });

  const totalSold = orderItems.reduce((sum, i) => sum + i.quantity, 0);
  const remaining = totalStock - totalSold;

  // Count active orders containing this mitra's products
  const activeOrders = await prisma.order.count({
    where: {
      status: { in: ['PENDING', 'PROCESSED', 'READY'] },
      items: { some: { productId: { in: productIds } } },
    },
  });

  return {
    totalStock: Math.max(0, totalStock),
    totalSold,
    remaining: Math.max(0, remaining),
    productCount,
    activeOrders,
  };
}
