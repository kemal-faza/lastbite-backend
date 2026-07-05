import { prisma } from '../lib/prisma.js';
import type { SalesTrendEntry } from '../types/index.js';

export class AnalyticsError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

function getPeriodKey(date: Date, granularity: 'daily' | 'weekly' | 'monthly'): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  switch (granularity) {
    case 'daily':
      return d.toISOString().slice(0, 10);
    case 'weekly': {
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }
    case 'monthly':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

export async function getSalesTrend(
  mitraId: string,
  from: Date,
  to: Date,
  granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<SalesTrendEntry[]> {
  const products = await prisma.product.findMany({
    where: { mitraId },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);

  if (productIds.length === 0) {
    return [];
  }

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['PICKED_UP', 'READY'] },
      createdAt: { gte: from, lte: to },
      items: { some: { productId: { in: productIds } } },
    },
    select: {
      id: true,
      createdAt: true,
      totalAmount: true,
      savingAmount: true,
      items: {
        where: { productId: { in: productIds } },
        select: { quantity: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const periodMap = new Map<string, SalesTrendEntry>();

  for (const order of orders) {
    const key = getPeriodKey(order.createdAt, granularity);
    const existing = periodMap.get(key);
    const periodItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

    if (existing) {
      existing.totalOrders += 1;
      existing.totalItems += periodItems;
      existing.totalRevenue += order.totalAmount;
      existing.totalSavings += order.savingAmount;
    } else {
      periodMap.set(key, {
        date: key,
        totalOrders: 1,
        totalItems: periodItems,
        totalRevenue: order.totalAmount,
        totalSavings: order.savingAmount,
      });
    }
  }

  return Array.from(periodMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface RevenueSummary {
  totalRevenue: number;
  totalSavings: number;
  totalOrders: number;
  totalItems: number;
  averageOrderValue: number;
}

export async function getRevenueSummary(
  mitraId: string,
  from: Date,
  to: Date
): Promise<RevenueSummary> {
  const products = await prisma.product.findMany({
    where: { mitraId },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);

  if (productIds.length === 0) {
    return { totalRevenue: 0, totalSavings: 0, totalOrders: 0, totalItems: 0, averageOrderValue: 0 };
  }

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['PICKED_UP', 'READY'] },
      createdAt: { gte: from, lte: to },
      items: { some: { productId: { in: productIds } } },
    },
    select: {
      totalAmount: true,
      savingAmount: true,
      items: {
        where: { productId: { in: productIds } },
        select: { quantity: true },
      },
    },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalSavings = orders.reduce((sum, o) => sum + o.savingAmount, 0);
  const totalOrders = orders.length;
  const totalItems = orders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0
  );

  return {
    totalRevenue,
    totalSavings,
    totalOrders,
    totalItems,
    averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
  };
}

export interface ProductPerformanceEntry {
  productId: string;
  productName: string;
  category: string;
  totalSold: number;
  totalRevenue: number;
  averageRating: number;
}

export async function getProductPerformance(
  mitraId: string,
  from: Date,
  to: Date
): Promise<ProductPerformanceEntry[]> {
  const products = await prisma.product.findMany({
    where: { mitraId },
    select: { id: true, name: true, category: true },
  });
  const productIds = products.map((p) => p.id);
  const productMap = new Map(products.map((p) => [p.id, { name: p.name, category: p.category }]));

  if (productIds.length === 0) return [];

  const orderItems = await prisma.orderItem.findMany({
    where: {
      productId: { in: productIds },
      order: {
        status: { in: ['PICKED_UP', 'READY'] },
        createdAt: { gte: from, lte: to },
      },
    },
    select: { productId: true, quantity: true, price: true },
  });

  const aggregated = new Map<string, { totalSold: number; totalRevenue: number }>();
  for (const item of orderItems) {
    const entry = aggregated.get(item.productId) || { totalSold: 0, totalRevenue: 0 };
    entry.totalSold += item.quantity;
    entry.totalRevenue += item.price * item.quantity;
    aggregated.set(item.productId, entry);
  }

  const ratings = await prisma.review.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds } },
    _avg: { rating: true },
  });
  const ratingMap = new Map(ratings.map((r) => [r.productId, r._avg.rating || 0]));

  const result: ProductPerformanceEntry[] = [];
  for (const [productId, data] of aggregated) {
    const info = productMap.get(productId);
    if (!info) continue;
    result.push({
      productId,
      productName: info.name,
      category: info.category,
      totalSold: data.totalSold,
      totalRevenue: data.totalRevenue,
      averageRating: Math.round((ratingMap.get(productId) || 0) * 10) / 10,
    });
  }

  result.sort((a, b) => b.totalSold - a.totalSold);
  return result;
}

export interface PeakHourEntry {
  hour: number;
  label: string;
  orders: number;
  items: number;
  revenue: number;
}

export async function getPeakHours(
  mitraId: string,
  from: Date,
  to: Date
): Promise<PeakHourEntry[]> {
  const products = await prisma.product.findMany({
    where: { mitraId },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);

  const hourMap = new Map<number, PeakHourEntry>();
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { hour: h, label: `${String(h).padStart(2, '0')}:00`, orders: 0, items: 0, revenue: 0 });
  }

  if (productIds.length === 0) {
    return Array.from(hourMap.values());
  }

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['PICKED_UP', 'READY'] },
      createdAt: { gte: from, lte: to },
      items: { some: { productId: { in: productIds } } },
    },
    select: {
      createdAt: true,
      totalAmount: true,
      items: {
        where: { productId: { in: productIds } },
        select: { quantity: true },
      },
    },
  });

  for (const order of orders) {
    const hour = order.createdAt.getHours();
    const entry = hourMap.get(hour)!;
    entry.orders += 1;
    entry.items += order.items.reduce((sum, i) => sum + i.quantity, 0);
    entry.revenue += order.totalAmount;
  }

  return Array.from(hourMap.values());
}

export async function generateAnalyticsCsv(
  mitraId: string,
  from: Date,
  to: Date
): Promise<string> {
  const products = await prisma.product.findMany({
    where: { mitraId },
    select: { id: true, name: true },
  });
  const productIds = products.map((p) => p.id);

  const orderItems = await prisma.orderItem.findMany({
    where: {
      productId: { in: productIds },
      order: {
        status: { in: ['PICKED_UP', 'READY'] },
        createdAt: { gte: from, lte: to },
      },
    },
    select: {
      productId: true,
      name: true,
      price: true,
      quantity: true,
      order: {
        select: {
          createdAt: true,
          totalAmount: true,
          savingAmount: true,
          buyerName: true,
          status: true,
        },
      },
    },
    orderBy: { order: { createdAt: 'desc' } },
  });

  const headers = ['Tanggal', 'Produk', 'Jumlah', 'Harga Satuan', 'Pendapatan', 'Hemat Pembeli', 'Pembeli', 'Status'];

  const escapeCsv = (value: string | number): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = orderItems.map((item) => [
    escapeCsv(item.order.createdAt.toISOString()),
    escapeCsv(item.name),
    item.quantity,
    item.price,
    item.price * item.quantity,
    item.order.savingAmount,
    escapeCsv(item.order.buyerName),
    item.order.status,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
