import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('Order status push notifications', () => {
  let foodSaverToken: string;
  let foodSaverId: string;
  let mitraToken: string;
  let mitraId: string;
  let productId: string;
  let orderId: string;

  beforeEach(async () => {
    // Food saver
    const foodSaver = await prisma.user.create({
      data: {
        email: `saver-push-${Date.now()}@test.com`,
        name: 'Saver Push',
        phone: '08123456789',
        passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHlbDqsOeABC123XYZ4567890abcdefghij',
        isVerified: true,
      },
    });
    foodSaverId = foodSaver.id;
    foodSaverToken = signAccessToken({ userId: foodSaver.id, email: foodSaver.email });

    // Register device token
    await prisma.deviceToken.create({
      data: { userId: foodSaverId, token: 'fcm-test-buyer', platform: 'web' },
    });

    // Mitra
    const mitra = await prisma.user.create({
      data: {
        email: `mitra-push-${Date.now()}@test.com`,
        name: 'Mitra Push',
        passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHlbDqsOeABC123XYZ4567890abcdefghij',
        role: 'MITRA',
        isVerified: true,
      },
    });
    mitraId = mitra.id;
    mitraToken = signAccessToken({ userId: mitra.id, email: mitra.email });

    await prisma.mitraProfile.create({
      data: { userId: mitraId, storeName: 'Warung Push', verificationStatus: 'VERIFIED' },
    });

    // Product
    const product = await prisma.product.create({
      data: {
        name: 'Nasi Goreng Push',
        category: 'meals',
        originalPrice: 25000,
        discountedPrice: 15000,
        stock: 10,
        storeName: 'Warung Push',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        mitraId,
        isActive: true,
      },
    });
    productId = product.id;

    // Checkout -> create order
    await request(app)
      .post('/cart')
      .set('Authorization', `Bearer ${foodSaverToken}`)
      .send({ productId, quantity: 1 });

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${foodSaverToken}`)
      .send({ buyerName: 'Buyer Push', buyerPhone: '08123456789' });

    orderId = orderRes.body.order.id;
  });

  it('should create a notification when order is placed', async () => {
    const notifs = await prisma.notification.findMany({
      where: { userId: foodSaverId, type: 'order_status' },
    });
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs[0].title).toContain('Pesanan');
    const data = notifs[0].data as Record<string, string>;
    expect(data.orderId).toBe(orderId);
  });

  it('should notify buyer when mitra marks order as PROCESSED', async () => {
    await request(app)
      .patch(`/mitra/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ status: 'PROCESSED' });

    const notifs = await prisma.notification.findMany({
      where: { userId: foodSaverId },
      orderBy: { createdAt: 'desc' },
    });
    const statusNotif = notifs.find((n) => n.body.includes('diproses'));
    expect(statusNotif).toBeDefined();
  });

  it('should notify buyer when mitra marks order as READY', async () => {
    await request(app)
      .patch(`/mitra/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ status: 'PROCESSED' });

    await request(app)
      .patch(`/mitra/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ status: 'READY' });

    const notifs = await prisma.notification.findMany({
      where: { userId: foodSaverId },
      orderBy: { createdAt: 'desc' },
    });
    const readyNotif = notifs.find((n) => n.body.includes('siap diambil'));
    expect(readyNotif).toBeDefined();
  });

  it('should have device token registered for push delivery', async () => {
    const devices = await prisma.deviceToken.findMany({
      where: { userId: foodSaverId },
    });
    expect(devices.length).toBe(1);
    expect(devices[0].token).toBe('fcm-test-buyer');
  });
});
