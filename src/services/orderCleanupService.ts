import { prisma } from '../lib/prisma.js';
import { createNotification, sendNotificationPush } from './notificationService.js';

/**
 * Cancel all expired orders for a given user.
 * Returns the number of orders cancelled.
 * Runs outside of any request-response cycle (fire-and-forget or cron).
 */
export async function cancelExpiredOrdersForUser(userId: string): Promise<number> {
  const expiredOrders = await prisma.order.findMany({
    where: {
      userId,
      status: { notIn: ['PICKED_UP', 'CANCELLED'] },
      pickupExpiresAt: { lt: new Date() },
    },
    include: { items: true },
  });

  for (const order of expiredOrders) {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    });

    // Find affected mitras
    const productIds = order.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, mitraId: true },
    });
    const uniqueMitraIds = [...new Set(products.map((p) => p.mitraId).filter(Boolean))];

    // Notify food-saver
    await createNotification({
      userId,
      title: 'Pesanan Dibatalkan',
      body: 'Pesanan kamu dibatalkan karena kode pickup sudah kedaluwarsa',
      type: 'order_status',
      data: { orderId: order.id, status: 'CANCELLED' },
    });
    sendNotificationPush(
      userId,
      'Pesanan Dibatalkan',
      'Pesanan kamu dibatalkan karena kode pickup sudah kedaluwarsa',
      { orderId: order.id, status: 'CANCELLED', type: 'order_status' }
    );

    // Notify each affected mitra
    for (const mitraId of uniqueMitraIds) {
      await createNotification({
        userId: mitraId as string,
        title: 'Pesanan Kedaluwarsa',
        body: `Pesanan ${order.id.slice(0, 8)} dibatalkan karena kode pickup tidak diambil tepat waktu`,
        type: 'order_status',
        data: { orderId: order.id, status: 'CANCELLED' },
      });
      sendNotificationPush(
        mitraId as string,
        'Pesanan Kedaluwarsa',
        `Pesanan ${order.id.slice(0, 8)} dibatalkan karena kode pickup tidak diambil tepat waktu`,
        { orderId: order.id, status: 'CANCELLED', type: 'order_status' }
      );
    }
  }

  return expiredOrders.length;
}
