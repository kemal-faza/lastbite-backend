import { prisma } from '../lib/prisma.js';

export interface AdminDashboardStats {
  totalUsers: number;
  totalMitra: number;
  totalOrders: number;
  totalRevenue: number;
  pendingVerifications: number;
  activeProducts: number;
}

export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const [
    totalUsers,
    totalMitra,
    totalOrders,
    revenueResult,
    pendingVerifications,
    activeProducts,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'FOOD_SAVER' } }),
    prisma.user.count({ where: { role: 'MITRA' } }),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { totalAmount: true } }),
    prisma.mitraProfile.count({ where: { verificationStatus: 'PENDING' } }),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  return {
    totalUsers,
    totalMitra,
    totalOrders,
    totalRevenue: revenueResult._sum.totalAmount || 0,
    pendingVerifications,
    activeProducts,
  };
}
