import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('GET /mitra/analytics/sales', () => {
  let mitraAccessToken: string;
  let mitraUserId: string;

  beforeEach(async () => {
    const mitraUser = await prisma.user.create({
      data: {
        email: 'analytics-mitra@example.com',
        name: 'Analytics Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: {
            storeName: 'Toko Analitik',
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    mitraUserId = mitraUser.id;
    mitraAccessToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/mitra/analytics/sales');
    expect(res.status).toBe(401);
  });

  it('should return daily sales trend for mitra products', async () => {
    const product = await prisma.product.create({
      data: {
        name: 'Trend Product',
        category: 'meals',
        originalPrice: 20000,
        discountedPrice: 10000,
        stock: 20,
        storeName: 'Toko Analitik',
        expiresAt: new Date(Date.now() + 86400000),
        mitraId: mitraUserId,
      },
    });

    const buyer = await prisma.user.create({
      data: {
        email: 'trend-buyer@example.com',
        name: 'Trend Buyer',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 0, 0, 0);

    await prisma.order.create({
      data: {
        userId: buyer.id,
        storeName: 'Toko Analitik',
        status: 'PICKED_UP',
        pickupCode: 'TRND-0001',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 20000,
        savingAmount: 20000,
        buyerName: 'Trend Buyer',
        buyerPhone: '08000000',
        createdAt: yesterday,
        items: {
          create: {
            productId: product.id,
            name: 'Trend Product',
            storeName: 'Toko Analitik',
            price: 10000,
            originalPrice: 20000,
            quantity: 2,
          },
        },
      },
    });

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(14, 0, 0, 0);

    await prisma.order.create({
      data: {
        userId: buyer.id,
        storeName: 'Toko Analitik',
        status: 'PICKED_UP',
        pickupCode: 'TRND-0002',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 10000,
        savingAmount: 10000,
        buyerName: 'Trend Buyer',
        buyerPhone: '08000001',
        createdAt: threeDaysAgo,
        items: {
          create: {
            productId: product.id,
            name: 'Trend Product',
            storeName: 'Toko Analitik',
            price: 10000,
            originalPrice: 20000,
            quantity: 1,
          },
        },
      },
    });

    const from = new Date();
    from.setDate(from.getDate() - 7);
    const to = new Date();

    const res = await request(app)
      .get(`/mitra/analytics/sales?from=${from.toISOString()}&to=${to.toISOString()}&granularity=daily`)
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.trend).toBeDefined();
    expect(Array.isArray(res.body.trend)).toBe(true);
    expect(res.body.trend.length).toBeGreaterThanOrEqual(2);
    const entry = res.body.trend[0];
    expect(entry).toHaveProperty('date');
    expect(entry).toHaveProperty('totalOrders');
    expect(entry).toHaveProperty('totalItems');
    expect(entry).toHaveProperty('totalRevenue');
    expect(entry).toHaveProperty('totalSavings');
  });

  it('should return 400 for invalid granularity', async () => {
    const res = await request(app)
      .get('/mitra/analytics/sales?from=2024-01-01T00:00:00.000Z&to=2024-01-31T00:00:00.000Z&granularity=yearly')
      .set('Authorization', `Bearer ${mitraAccessToken}`);
    expect(res.status).toBe(400);
  });

  it('should return 400 for missing date range', async () => {
    const res = await request(app)
      .get('/mitra/analytics/sales')
      .set('Authorization', `Bearer ${mitraAccessToken}`);
    expect(res.status).toBe(400);
  });

  it('should return 403 for non-mitra user', async () => {
    const fsUser = await prisma.user.create({
      data: {
        email: 'fs-no-mitra@example.com',
        name: 'FS Not Mitra',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });
    const fsToken = signAccessToken({ userId: fsUser.id, email: fsUser.email });

    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date().toISOString();

    const res = await request(app)
      .get(`/mitra/analytics/sales?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${fsToken}`);
    expect(res.status).toBe(403);
  });

  it('should return empty trend for mitra with no products', async () => {
    const emptyMitraUser = await prisma.user.create({
      data: {
        email: 'empty-mitra@example.com',
        name: 'Empty Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: {
            storeName: 'Toko Kosong',
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    const emptyToken = signAccessToken({ userId: emptyMitraUser.id, email: emptyMitraUser.email });

    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date().toISOString();

    const res = await request(app)
      .get(`/mitra/analytics/sales?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${emptyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.trend).toEqual([]);
  });
});
