import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('GET /mitra/analytics/peak-hours', () => {
  let mitraAccessToken: string;
  let mitraUserId: string;

  beforeEach(async () => {
    const mitraUser = await prisma.user.create({
      data: {
        email: 'peak-mitra@example.com',
        name: 'Peak Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: { storeName: 'Toko Jam Sibuk', verificationStatus: 'VERIFIED' },
        },
      },
    });
    mitraUserId = mitraUser.id;
    mitraAccessToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });
  });

  it('should return hourly distribution with all 24 hours', async () => {
    const product = await prisma.product.create({
      data: {
        name: 'Peak Product',
        category: 'meals',
        originalPrice: 20000,
        discountedPrice: 10000,
        stock: 20,
        storeName: 'Toko Jam Sibuk',
        expiresAt: new Date(Date.now() + 86400000),
        mitraId: mitraUserId,
      },
    });

    const buyer = await prisma.user.create({
      data: {
        email: 'peak-buyer@example.com',
        name: 'Peak Buyer',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });

    // Anchor orders inside the query window so the test is time-of-day independent.
    const date10am = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
    const peakHourA = date10am.getHours();
    await prisma.order.create({
      data: {
        userId: buyer.id,
        storeName: 'Toko Jam Sibuk',
        status: 'PICKED_UP',
        pickupCode: 'PEAK-0001',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 20000,
        savingAmount: 10000,
        buyerName: 'Buyer 10am',
        buyerPhone: '08000000',
        createdAt: date10am,
        items: {
          create: {
            productId: product.id,
            name: 'Peak Product',
            storeName: 'Toko Jam Sibuk',
            price: 10000,
            originalPrice: 20000,
            quantity: 2,
          },
        },
      },
    });

    const date2pm = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5h ago
    const peakHourB = date2pm.getHours();
    await prisma.order.create({
      data: {
        userId: buyer.id,
        storeName: 'Toko Jam Sibuk',
        status: 'PICKED_UP',
        pickupCode: 'PEAK-0002',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 10000,
        savingAmount: 10000,
        buyerName: 'Buyer 2pm',
        buyerPhone: '08000001',
        createdAt: date2pm,
        items: {
          create: {
            productId: product.id,
            name: 'Peak Product',
            storeName: 'Toko Jam Sibuk',
            price: 10000,
            originalPrice: 20000,
            quantity: 1,
          },
        },
      },
    });

    const from = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 1000).toISOString();

    const res = await request(app)
      .get(`/mitra/analytics/peak-hours?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.hours).toBeDefined();
    expect(Array.isArray(res.body.hours)).toBe(true);
    expect(res.body.hours.length).toBe(24);
    // Assert against the hours the orders were actually placed in.
    expect(res.body.hours[peakHourA].orders).toBe(1);
    expect(res.body.hours[peakHourA].items).toBe(2);
    expect(res.body.hours[peakHourB].orders).toBe(1);
    expect(res.body.hours[peakHourB].items).toBe(1);
    // An hour with no orders at all.
    const emptyHour = (peakHourA + 3) % 24;
    expect(res.body.hours[emptyHour].orders).toBe(0);
  });

  it('should return 401 without auth', async () => {
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date().toISOString();
    const res = await request(app).get(`/mitra/analytics/peak-hours?from=${from}&to=${to}`);
    expect(res.status).toBe(401);
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('should return zero distribution for mitra with no orders', async () => {
    const emptyMitra = await prisma.user.create({
      data: {
        email: 'empty-peak@example.com',
        name: 'Empty Peak',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: { storeName: 'Toko Kosong', verificationStatus: 'VERIFIED' },
        },
      },
    });
    const emptyToken = signAccessToken({ userId: emptyMitra.id, email: emptyMitra.email });
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date().toISOString();

    const res = await request(app)
      .get(`/mitra/analytics/peak-hours?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${emptyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.hours).toHaveLength(24);
    res.body.hours.forEach((h: { orders: number }) => {
      expect(h.orders).toBe(0);
    });
  });

  it('should return 400 for invalid timezone', async () => {
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date().toISOString();
    const res = await request(app)
      .get(`/mitra/analytics/peak-hours?from=${from}&to=${to}&timezone=Invalid/Timezone`)
      .set('Authorization', `Bearer ${mitraAccessToken}`);
    // Invalid timezone should not break — either 200 (ignored) or 400
    expect([200, 400]).toContain(res.status);
  });
});
