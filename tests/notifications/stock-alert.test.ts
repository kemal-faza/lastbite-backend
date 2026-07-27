import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { badUuids } from '../support/edgeCases.js';

const app = createApp();

describe('Stock alert push notifications', () => {
  let foodSaverToken: string;
  let foodSaverId: string;
  let mitraToken: string;
  let mitraId: string;
  let productId: string;

  beforeEach(async () => {
    const foodSaver = await prisma.user.create({
      data: {
        email: `saver-stock-${Date.now()}@test.com`,
        name: 'Stock Alert Saver',
        passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHlbDqsOeABC123XYZ4567890abcdefghij',
        isVerified: true,
      },
    });
    foodSaverId = foodSaver.id;
    foodSaverToken = signAccessToken({ userId: foodSaver.id, email: foodSaver.email });

    await prisma.deviceToken.create({
      data: { userId: foodSaverId, token: 'fcm-stock-alert', platform: 'web' },
    });

    const mitra = await prisma.user.create({
      data: {
        email: `mitra-stock-${Date.now()}@test.com`,
        name: 'Mitra Stock',
        passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHlbDqsOeABC123XYZ4567890abcdefghij',
        role: 'MITRA',
        isVerified: true,
      },
    });
    mitraId = mitra.id;
    mitraToken = signAccessToken({ userId: mitra.id, email: mitra.email });

    await prisma.mitraProfile.create({
      data: { userId: mitraId, storeName: 'Toko Stok', verificationStatus: 'VERIFIED' },
    });

    // Create product with 0 stock
    const product = await prisma.product.create({
      data: {
        name: 'Nasi Uduk Stok Habis',
        category: 'meals',
        originalPrice: 20000,
        discountedPrice: 10000,
        stock: 0,
        storeName: 'Toko Stok',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        mitraId,
        isActive: true,
      },
    });
    productId = product.id;

    // Subscribe
    await prisma.wishlistSubscription.create({
      data: { userId: foodSaverId, productId },
    });
  });

  it('should notify subscribed users when stock replenished (0 -> >0)', async () => {
    await request(app)
      .patch(`/mitra/products/${productId}`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ stock: 5 });

    const notifs = await prisma.notification.findMany({
      where: { userId: foodSaverId, type: 'stock_alert' },
    });
    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toBe('Stok Favorit Tersedia');
    expect(notifs[0].body).toContain('Nasi Uduk Stok Habis');
    const data = notifs[0].data as Record<string, string>;
    expect(data.productId).toBe(productId);
  });

  it('should NOT notify when stock goes from positive to positive', async () => {
    // Set stock > 0 first
    await prisma.product.update({ where: { id: productId }, data: { stock: 3 } });

    // Change from 3 to 10 (both > 0)
    await request(app)
      .patch(`/mitra/products/${productId}`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ stock: 10 });

    const notifs = await prisma.notification.findMany({
      where: { userId: foodSaverId, type: 'stock_alert' },
    });
    expect(notifs.length).toBe(0);
  });

  it('should clean up subscriptions after notifying', async () => {
    await request(app)
      .patch(`/mitra/products/${productId}`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ stock: 5 });

    const subs = await prisma.wishlistSubscription.findMany({
      where: { productId },
    });
    expect(subs.length).toBe(0); // One-time alert per replenishment
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('should return 400 for product update with bad UUID', async () => {
    const res = await request(app)
      .patch('/mitra/products/not-a-uuid')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ stock: 5 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should NOT notify when stock goes from 0 to 0 (still out of stock)', async () => {
    // Product is already stock 0
    await request(app)
      .patch(`/mitra/products/${productId}`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ stock: 0 });

    const notifs = await prisma.notification.findMany({
      where: { userId: foodSaverId, type: 'stock_alert' },
    });
    expect(notifs.length).toBe(0);
  });

  it('should NOT notify when stock goes to negative (invalid)', async () => {
    const res = await request(app)
      .patch(`/mitra/products/${productId}`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ stock: -1 });
    expect(res.status).toBe(400);
  });

  it('should suppress duplicate alert if stock goes 0→5→0→5 within timeframe', async () => {
    // 0 → 5: should notify
    await request(app)
      .patch(`/mitra/products/${productId}`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ stock: 5 });

    // Subscription is deleted after first notify
    let subs = await prisma.wishlistSubscription.findMany({ where: { productId } });
    expect(subs.length).toBe(0);

    // Re-subscribe and set stock to 0 again, then back to 5
    await prisma.wishlistSubscription.create({
      data: { userId: foodSaverId, productId },
    });
    await prisma.product.update({ where: { id: productId }, data: { stock: 0 } });

    await request(app)
      .patch(`/mitra/products/${productId}`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ stock: 5 });

    const notifs = await prisma.notification.findMany({
      where: { userId: foodSaverId, type: 'stock_alert' },
    });
    expect(notifs.length).toBe(2); // second alert is also sent
  });

  it('should not alert for a product the user is not subscribed to', async () => {
    const unsubscribedUser = await prisma.user.create({
      data: {
        email: `unsub-${Date.now()}@test.com`,
        name: 'Unsubscribed',
        passwordHash: 'hash',
        isVerified: true,
      },
    });

    await request(app)
      .patch(`/mitra/products/${productId}`)
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ stock: 5 });

    const notifs = await prisma.notification.findMany({
      where: { userId: unsubscribedUser.id, type: 'stock_alert' },
    });
    expect(notifs.length).toBe(0);
  });
});
