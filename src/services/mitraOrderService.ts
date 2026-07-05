import { prisma } from '../lib/prisma.js';
import type { OrderStatus } from '@prisma/client';
import { createNotification, sendNotificationPush } from './notificationService.js';

export class MitraOrderError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MitraOrderError';
  }
}

interface MitraOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
}

interface MitraOrder {
  id: string;
  status: string;
  pickupCode: string;
  pickupExpiresAt: string;
  totalAmount: number;
  savingAmount: number;
  buyerName: string;
  buyerPhone: string;
  notes: string | null;
  items: MitraOrderItem[];
  createdAt: string;
}

function toISO(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toOrderResponse(order: any): MitraOrder {
  return {
    id: order.id,
    status: order.status,
    pickupCode: order.pickupCode,
    pickupExpiresAt: toISO(order.pickupExpiresAt),
    totalAmount: order.totalAmount,
    savingAmount: order.savingAmount,
    buyerName: order.buyerName,
    buyerPhone: order.buyerPhone,
    notes: order.notes,
    items: order.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      imageUrl: item.imageUrl,
    })),
    createdAt: toISO(order.createdAt),
  };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PROCESSED', 'CANCELLED'],
  PROCESSED: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP', 'CANCELLED'],
};

export async function getStoreOrders(mitraId: string): Promise<MitraOrder[]> {
  const mitraProducts = await prisma.product.findMany({
    where: { mitraId },
    select: { id: true },
  });
  const productIds = mitraProducts.map((p) => p.id);

  if (productIds.length === 0) {
    return [];
  }

  const orders = await prisma.order.findMany({
    where: {
      items: { some: { productId: { in: productIds } } },
    },
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          name: true,
          price: true,
          quantity: true,
          imageUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map(toOrderResponse);
}

export async function updateOrderStatus(
  mitraId: string,
  orderId: string,
  newStatus: string
): Promise<MitraOrder> {
  const mitraProducts = await prisma.product.findMany({
    where: { mitraId },
    select: { id: true },
  });
  const productIds = mitraProducts.map((p) => p.id);

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      items: { some: { productId: { in: productIds } } },
    },
    include: { items: { select: { id: true, productId: true, name: true, price: true, quantity: true, imageUrl: true } } },
  });

  if (!order) {
    throw new MitraOrderError('Pesanan tidak ditemukan', 'ORDER_NOT_FOUND');
  }

  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new MitraOrderError(
      `Tidak dapat mengubah status dari ${order.status} ke ${newStatus}`,
      'INVALID_TRANSITION'
    );
  }

  if (newStatus === 'CANCELLED') {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      for (const item of order.items) {
        await tx.product.updateMany({
          where: { id: item.productId, mitraId },
          data: { stock: { increment: item.quantity } },
        });
      }
    });

    await notifyOrderStatusChange(order.userId, orderId, 'CANCELLED');

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { select: { id: true, name: true, price: true, quantity: true, imageUrl: true } } },
    });
    return toOrderResponse(updated!);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus as OrderStatus },
    include: { items: { select: { id: true, name: true, price: true, quantity: true, imageUrl: true } } },
  });

  await notifyOrderStatusChange(order.userId, orderId, newStatus);

  return toOrderResponse(updated);
}

const STATUS_LABELS: Record<string, string> = {
  PROCESSED: 'sedang diproses',
  READY: 'siap diambil',
  PICKED_UP: 'sudah diambil',
  CANCELLED: 'dibatalkan',
};

async function notifyOrderStatusChange(userId: string, orderId: string, newStatus: string) {
  const label = STATUS_LABELS[newStatus] || newStatus.toLowerCase();

  await createNotification({
    userId,
    title: 'Status Pesanan Diperbarui',
    body: `Pesanan kamu ${label} oleh mitra`,
    type: 'order_status',
    data: { orderId, status: newStatus },
  });

  // Fire-and-forget push notification
  sendNotificationPush(
    userId,
    'Status Pesanan Diperbarui',
    `Pesanan kamu ${label} oleh mitra`,
    { orderId, status: newStatus, type: 'order_status' }
  );
}
