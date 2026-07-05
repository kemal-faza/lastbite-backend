import { prisma } from '../lib/prisma.js';
import { getCart } from './cartService.js';
import { sendNotificationPush } from './notificationService.js';

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

export async function createOrder(userId: string, input: CreateOrderInput) {
  const cart = await getCart(userId);

  if (!cart.items || cart.items.length === 0) {
    throw new OrderError('Keranjang kosong', 'CART_EMPTY');
  }

  const order = await prisma.$transaction(async (tx) => {
    // Verify stock for all items
    for (const item of cart.items) {
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
    for (const item of cart.items) {
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
        storeName: cart.storeName!,
        status: 'PENDING',
        pickupCode,
        pickupExpiresAt,
        totalAmount,
        savingAmount,
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone,
        notes: input.notes || null,
        items: {
          create: cart.items.map((item) => ({
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
    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Clear cart items and storeName
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
    await tx.cart.update({
      where: { id: cart.id },
      data: { storeName: null },
    });

    // Create notification for the buyer
    await tx.notification.create({
      data: {
        userId,
        title: 'Pesanan Berhasil Dibuat',
        body: `Pesanan kamu di ${cart.storeName} telah dibuat. Kode pickup: ${created.pickupCode}`,
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

  return order;
}

export async function getUserOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOrderById(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });

  if (!order) {
    throw new OrderError('Pesanan tidak ditemukan', 'ORDER_NOT_FOUND');
  }

  return order;
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

  return updatedOrder;
}
