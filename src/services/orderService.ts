import { prisma } from '../lib/prisma.js';
import { getCart } from './cartService.js';
import { createNotification, sendNotificationPush } from './notificationService.js';
import { deriveImageVariants } from './imageVariants.js';

type ImageVariantsObj = { thumb: string; card: string; full: string } | null;

export class OrderError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'OrderError';
  }
}

/**
 * Check if a user has at least one order (any status).
 */
export async function hasOrderHistory(userId: string): Promise<boolean> {
  const count = await prisma.order.count({ where: { userId } });
  return count > 0;
}

export interface CreateOrderInput {
  buyerName: string;
  buyerPhone: string;
  notes?: string;
  storeName?: string;
}

function generatePickupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LAST-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function ensureUniquePickupCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generatePickupCode();
    const existing = await prisma.order.findUnique({ where: { pickupCode: code } });
    if (!existing) return code;
  }
  throw new OrderError('Gagal membuat kode pickup, silakan coba lagi', 'PICKUP_CODE_ERROR');
}

function addImageVariantsToOrder(order: any) {
  if (!order?.items) return order;
  return {
    ...order,
    hasReviewed: !!order.review,
    items: order.items.map((item: any) => ({
      ...item,
      imageVariants: deriveImageVariants(item.imageUrl),
    })),
  };
}

export async function createOrder(userId: string, input: CreateOrderInput) {
  const cart = await getCart(userId);

  if (!cart.items || cart.items.length === 0) {
    throw new OrderError('Keranjang kosong', 'CART_EMPTY');
  }

  const { storeName } = input;

  // Filter items by store if specified (multi-store support)
  let checkoutItems = cart.items;
  let orderStoreName: string;

  if (storeName) {
    checkoutItems = cart.items.filter((item) => item.product.storeName === storeName);
    orderStoreName = storeName;
    if (checkoutItems.length === 0) {
      throw new OrderError(
        `Tidak ada produk dari "${storeName}" di keranjang`,
        'CART_EMPTY'
      );
    }
  } else {
    // Derive order store name from items when checking out entire cart
    const uniqueStores = [...new Set(cart.items.map((i) => i.product.storeName))];
    orderStoreName = uniqueStores.length === 1 ? uniqueStores[0] : '';
  }

  const order = await prisma.$transaction(async (tx) => {
    // Verify stock for all items
    for (const item of checkoutItems) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) {
        throw new OrderError(
          `Produk "${item.product.name}" sudah tidak tersedia`,
          'PRODUCT_UNAVAILABLE'
        );
      }
      if (item.quantity > product.stock) {
        throw new OrderError(
          `Stok "${item.product.name}" tidak mencukupi. Tersedia: ${product.stock}.`,
          'INSUFFICIENT_STOCK'
        );
      }
    }

    // Calculate totals
    let totalAmount = 0;
    let savingAmount = 0;
    for (const item of checkoutItems) {
      totalAmount += item.product.discountedPrice * item.quantity;
      savingAmount += (item.product.originalPrice - item.product.discountedPrice) * item.quantity;
    }

    // Generate unique pickup code
    const pickupCode = await ensureUniquePickupCode();
    const pickupExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    // Create order with items
    const created = await tx.order.create({
      data: {
        userId,
        storeName: orderStoreName,
        status: 'PENDING',
        pickupCode,
        pickupExpiresAt,
        totalAmount,
        savingAmount,
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone,
        notes: input.notes || null,
        items: {
          create: checkoutItems.map((item) => ({
            productId: item.productId,
            name: item.product.name,
            storeName: item.product.storeName,
            price: item.product.discountedPrice,
            originalPrice: item.product.originalPrice,
            quantity: item.quantity,
            imageUrl: item.product.imageUrl,
          })),
        },
      },
      include: { items: true },
    });

    // Decrement stock for all items
    for (const item of checkoutItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Remove only the checked-out items, keep items from other stores
    await tx.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        productId: { in: checkoutItems.map((i) => i.productId) },
      },
    });

    // Check if cart is now empty and clear storeName
    const remainingItems = await tx.cartItem.count({
      where: { cartId: cart.id },
    });
    if (remainingItems === 0) {
      await tx.cart.update({
        where: { id: cart.id },
        data: { storeName: null },
      });
    }

    // Create notification for the buyer
    await tx.notification.create({
      data: {
        userId,
        title: 'Pesanan Berhasil Dibuat',
        body: `Pesanan kamu di ${orderStoreName} telah dibuat. Kode pickup: ${created.pickupCode}`,
        type: 'order_status',
        data: { orderId: created.id, pickupCode: created.pickupCode },
      },
    });

    return created;
  });

  // Fire-and-forget push notification outside the transaction
  sendNotificationPush(
    userId,
    'Pesanan Berhasil Dibuat',
    `Pesanan kamu di ${order.storeName} telah dibuat. Kode pickup: ${order.pickupCode}`,
    { orderId: order.id, pickupCode: order.pickupCode, type: 'order_status' }
  );

  return addImageVariantsToOrder(order);
}

export async function getUserOrders(userId: string) {
  // Auto-cancel expired orders before returning (lazy check for list view)
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

  const orders = await prisma.order.findMany({
    where: { userId },
    include: { items: true, review: true },
    orderBy: { createdAt: 'desc' },
  });
  return orders.map(addImageVariantsToOrder);
}

export async function getOrderById(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true, review: true },
  });

  if (!order) {
    throw new OrderError('Pesanan tidak ditemukan', 'ORDER_NOT_FOUND');
  }

  return addImageVariantsToOrder(order);
}

export async function cancelExpiredOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });

  if (!order) {
    throw new OrderError('Pesanan tidak ditemukan', 'ORDER_NOT_FOUND');
  }

  if (order.status === 'PICKED_UP') {
    throw new OrderError('Pesanan sudah diambil', 'INVALID_STATUS');
  }
  if (order.status === 'CANCELLED') {
    throw new OrderError('Pesanan sudah dibatalkan', 'INVALID_STATUS');
  }

  // CRITICAL: only allow cancel if actually expired
  if (new Date() <= order.pickupExpiresAt) {
    throw new OrderError('Kode pickup belum kedaluwarsa', 'NOT_EXPIRED');
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
      include: { items: true },
    });

    // Restore stock for each item
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    return updated;
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
    data: { orderId, status: 'CANCELLED' },
  });
  sendNotificationPush(
    userId,
    'Pesanan Dibatalkan',
    'Pesanan kamu dibatalkan karena kode pickup sudah kedaluwarsa',
    { orderId, status: 'CANCELLED', type: 'order_status' }
  );

  // Notify each affected mitra
  for (const mitraId of uniqueMitraIds) {
    await createNotification({
      userId: mitraId as string,
      title: 'Pesanan Kedaluwarsa',
      body: `Pesanan ${orderId.slice(0, 8)} dibatalkan karena kode pickup tidak diambil tepat waktu`,
      type: 'order_status',
      data: { orderId, status: 'CANCELLED' },
    });
    sendNotificationPush(
      mitraId as string,
      'Pesanan Kedaluwarsa',
      `Pesanan ${orderId.slice(0, 8)} dibatalkan karena kode pickup tidak diambil tepat waktu`,
      { orderId, status: 'CANCELLED', type: 'order_status' }
    );
  }

  return addImageVariantsToOrder(updatedOrder);
}

export async function verifyPickup(
  userId: string,
  orderId: string,
  pickupCodeInput: string
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });

  if (!order) {
    throw new OrderError('Pesanan tidak ditemukan', 'ORDER_NOT_FOUND');
  }

  // Check status - only allow pickup for PENDING, PROCESSED, or READY
  if (order.status === 'PICKED_UP') {
    throw new OrderError('Pesanan sudah diambil', 'INVALID_STATUS');
  }
  if (order.status === 'CANCELLED') {
    throw new OrderError('Pesanan sudah dibatalkan', 'INVALID_STATUS');
  }

  // Validate pickup code (case-insensitive trimmed)
  if (order.pickupCode.toLowerCase().trim() !== pickupCodeInput.toLowerCase().trim()) {
    throw new OrderError('Kode pickup salah', 'INVALID_PICKUP_CODE');
  }

  // Validate pickup code hasn't expired
  if (new Date() > order.pickupExpiresAt) {
    throw new OrderError('Kode pickup sudah kedaluwarsa', 'PICKUP_EXPIRED');
  }

  // Update status to PICKED_UP
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'PICKED_UP' },
    include: { items: true },
  });

  return addImageVariantsToOrder(updatedOrder);
}
