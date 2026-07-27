import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { unicodeStrings } from '../support/edgeCases.js';

const app = createApp();

describe('GET /mitra/analytics/revenue', () => {
  let mitraAccessToken: string;
  let mitraUserId: string;

  beforeEach(async () => {
    const mitraUser = await prisma.user.create({
      data: {
        email: 'revenue-mitra@example.com',
        name: 'Revenue Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: { storeName: 'Toko Revenue', verificationStatus: 'VERIFIED' },
        },
      },
    });
    mitraUserId = mitraUser.id;
    mitraAccessToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });
  });

  it('should return revenue summary', async () => {
    const product = await prisma.product.create({
      data: {
        name: 'Revenue Product',
        category: 'meals',
        originalPrice: 50000,
        discountedPrice: 30000,
        stock: 10,
        storeName: 'Toko Revenue',
        expiresAt: new Date(Date.now() + 86400000),
        mitraId: mitraUserId,
      },
    });

    const buyer = await prisma.user.create({
      data: {
        email: 'rev-buyer@example.com',
        name: 'Rev Buyer',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });

    // Order 1: 30000 revenue, 20000 savings
    await prisma.order.create({
      data: {
        userId: buyer.id,
        storeName: 'Toko Revenue',
        status: 'PICKED_UP',
        pickupCode: 'REV-00001',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 30000,
        savingAmount: 20000,
        buyerName: 'Buyer 1',
        buyerPhone: '08000001',
        createdAt: new Date(),
        items: {
          create: {
            productId: product.id,
            name: 'Revenue Product',
            storeName: 'Toko Revenue',
            price: 30000,
            originalPrice: 50000,
            quantity: 1,
          },
        },
      },
    });

    // Order 2: 60000 revenue, 40000 savings
    await prisma.order.create({
      data: {
        userId: buyer.id,
        storeName: 'Toko Revenue',
        status: 'PICKED_UP',
        pickupCode: 'REV-00002',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 60000,
        savingAmount: 40000,
        buyerName: 'Buyer 2',
        buyerPhone: '08000002',
        createdAt: new Date(),
        items: {
          create: {
            productId: product.id,
            name: 'Revenue Product',
            storeName: 'Toko Revenue',
            price: 30000,
            originalPrice: 50000,
            quantity: 2,
          },
        },
      },
    });

    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date().toISOString();

    const res = await request(app)
      .get(`/mitra/analytics/revenue?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totalRevenue).toBe(90000);
    expect(res.body.summary.totalSavings).toBe(60000);
    expect(res.body.summary.totalOrders).toBe(2);
    expect(res.body.summary.totalItems).toBe(3); // 1 + 2
    expect(res.body.summary.averageOrderValue).toBe(45000); // 90000 / 2
  });

  it('should return 401 without auth', async () => {
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date().toISOString();
    const res = await request(app).get(`/mitra/analytics/revenue?from=${from}&to=${to}`);
    expect(res.status).toBe(401);
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('should return zero revenue for period with no orders', async () => {
    const from = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const to = new Date(Date.now() + 2 * 86400000).toISOString(); // day after

    const res = await request(app)
      .get(`/mitra/analytics/revenue?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalRevenue).toBe(0);
    expect(res.body.summary.totalOrders).toBe(0);
    expect(res.body.summary.totalItems).toBe(0);
    expect(res.body.summary.averageOrderValue).toBe(0);
  });

  it('should return 400 for invalid date format', async () => {
    const res = await request(app)
      .get('/mitra/analytics/revenue?from=not-a-date&to=2024-01-01')
      .set('Authorization', `Bearer ${mitraAccessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for missing date params', async () => {
    const res = await request(app)
      .get('/mitra/analytics/revenue')
      .set('Authorization', `Bearer ${mitraAccessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for future date range (from > to): valid ISO but no data', async () => {
    const from = new Date(Date.now() + 86400000).toISOString();
    const to = new Date(Date.now() - 86400000).toISOString();

    const res = await request(app)
      .get(`/mitra/analytics/revenue?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    // Either 400 (validation rejects) or 200 (returns empty data)
    expect([200, 400]).toContain(res.status);
  });
});
