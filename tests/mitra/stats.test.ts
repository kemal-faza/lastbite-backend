import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('GET /mitra/stats', () => {
  let mitraAccessToken: string;
  let mitraUserId: string;
  let productId: string;

  beforeEach(async () => {
    const mitraUser = await prisma.user.create({
      data: {
        email: 'mitra-stats@example.com',
        name: 'Mitra Stats',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: {
            storeName: 'Toko Statistik',
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    mitraUserId = mitraUser.id;
    mitraAccessToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });

    const product = await prisma.product.create({
      data: {
        name: 'Stat Product',
        category: 'meals',
        originalPrice: 20000,
        discountedPrice: 10000,
        stock: 10,
        storeName: 'Toko Statistik',
        expiresAt: new Date(Date.now() + 86400000),
        mitraId: mitraUserId,
      },
    });
    productId = product.id;
  });

  it('should return stats for mitra', async () => {
    const res = await request(app)
      .get('/mitra/stats')
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.totalStock).toBe(10);
    expect(res.body.stats.productCount).toBe(1);
    expect(res.body.stats.totalSold).toBe(0);
    expect(res.body.stats.remaining).toBe(10);
    expect(res.body.stats.activeOrders).toBe(0);
  });

  it('should count sold items correctly', async () => {
    const fsUser = await prisma.user.create({
      data: {
        email: 'fs-stats@example.com',
        name: 'FS Stats',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });

    await prisma.order.create({
      data: {
        userId: fsUser.id,
        storeName: 'Toko Statistik',
        status: 'PICKED_UP',
        pickupCode: 'STAT-0001',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 20000,
        savingAmount: 20000,
        buyerName: 'Stats Buyer',
        buyerPhone: '08000000',
        items: {
          create: {
            productId,
            name: 'Stat Product',
            storeName: 'Toko Statistik',
            price: 10000,
            originalPrice: 20000,
            quantity: 3,
          },
        },
      },
    });

    const res = await request(app)
      .get('/mitra/stats')
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.body.stats.totalSold).toBe(3);
    expect(res.body.stats.remaining).toBe(7);
  });

  it('should count active orders', async () => {
    const fsUser = await prisma.user.create({
      data: {
        email: 'fs-active@example.com',
        name: 'FS Active',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });

    await prisma.order.create({
      data: {
        userId: fsUser.id,
        storeName: 'Toko Statistik',
        status: 'PENDING',
        pickupCode: 'ACTV-0001',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 20000,
        savingAmount: 20000,
        buyerName: 'Active Buyer',
        buyerPhone: '08000001',
        items: {
          create: {
            productId,
            name: 'Stat Product',
            storeName: 'Toko Statistik',
            price: 10000,
            originalPrice: 20000,
            quantity: 1,
          },
        },
      },
    });

    const res = await request(app)
      .get('/mitra/stats')
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.body.stats.activeOrders).toBe(1);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/mitra/stats');
    expect(res.status).toBe(401);
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('should return zero stats for mitra with no products', async () => {
    const emptyMitra = await prisma.user.create({
      data: {
        email: 'empty-stats@example.com',
        name: 'Empty Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: { storeName: 'Toko Kosong', verificationStatus: 'VERIFIED' },
        },
      },
    });
    const emptyToken = signAccessToken({ userId: emptyMitra.id, email: emptyMitra.email });

    const res = await request(app)
      .get('/mitra/stats')
      .set('Authorization', `Bearer ${emptyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.stats.totalStock).toBe(0);
    expect(res.body.stats.productCount).toBe(0);
    expect(res.body.stats.totalSold).toBe(0);
    expect(res.body.stats.remaining).toBe(0);
    expect(res.body.stats.activeOrders).toBe(0);
  });

  it('should handle deactivated products correctly', async () => {
    // Deactivate the product
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });

    const res = await request(app)
      .get('/mitra/stats')
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.status).toBe(200);
    // Stats service counts all products regardless of isActive
    expect(res.body.stats.productCount).toBe(1);
    expect(res.body.stats.totalStock).toBe(10);
  });

  it('should handle negative stock gracefully (should never happen, but defensive)', async () => {
    await prisma.product.update({ where: { id: productId }, data: { stock: -5 } });

    const res = await request(app)
      .get('/mitra/stats')
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.status).toBe(200);
    // totalStock = -5 but the service uses Math.max(0, totalStock)
    expect(res.body.stats.totalStock).toBe(0);
    expect(res.body.stats.remaining).toBe(0);
  });
});
