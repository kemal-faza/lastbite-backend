import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('GET /mitra/analytics/products', () => {
  let mitraAccessToken: string;
  let mitraUserId: string;

  beforeEach(async () => {
    const mitraUser = await prisma.user.create({
      data: {
        email: 'prod-perf-mitra@example.com',
        name: 'Prod Perf Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: { storeName: 'Toko Produk', verificationStatus: 'VERIFIED' },
        },
      },
    });
    mitraUserId = mitraUser.id;
    mitraAccessToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });
  });

  it('should return product performance ranking', async () => {
    const prodA = await prisma.product.create({
      data: {
        name: 'Product A',
        category: 'meals',
        originalPrice: 30000,
        discountedPrice: 20000,
        stock: 10,
        storeName: 'Toko Produk',
        expiresAt: new Date(Date.now() + 86400000),
        mitraId: mitraUserId,
      },
    });

    const prodB = await prisma.product.create({
      data: {
        name: 'Product B',
        category: 'bakery',
        originalPrice: 25000,
        discountedPrice: 15000,
        stock: 5,
        storeName: 'Toko Produk',
        expiresAt: new Date(Date.now() + 86400000),
        mitraId: mitraUserId,
      },
    });

    const buyer = await prisma.user.create({
      data: {
        email: 'pp-buyer@example.com',
        name: 'PP Buyer',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });

    // Order with Product A (3 items)
    await prisma.order.create({
      data: {
        userId: buyer.id,
        storeName: 'Toko Produk',
        status: 'PICKED_UP',
        pickupCode: 'PROD-0001',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 60000,
        savingAmount: 30000,
        buyerName: 'Buyer',
        buyerPhone: '08000000',
        createdAt: new Date(),
        items: {
          create: {
            productId: prodA.id,
            name: 'Product A',
            storeName: 'Toko Produk',
            price: 20000,
            originalPrice: 30000,
            quantity: 3,
          },
        },
      },
    });

    // Order with Product B (1 item)
    await prisma.order.create({
      data: {
        userId: buyer.id,
        storeName: 'Toko Produk',
        status: 'PICKED_UP',
        pickupCode: 'PROD-0002',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 15000,
        savingAmount: 10000,
        buyerName: 'Buyer',
        buyerPhone: '08000001',
        createdAt: new Date(),
        items: {
          create: {
            productId: prodB.id,
            name: 'Product B',
            storeName: 'Toko Produk',
            price: 15000,
            originalPrice: 25000,
            quantity: 1,
          },
        },
      },
    });

    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date().toISOString();

    const res = await request(app)
      .get(`/mitra/analytics/products?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.products).toBeDefined();
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBe(2);
    expect(res.body.products[0].productId).toBe(prodA.id);
    expect(res.body.products[0].totalSold).toBe(3);
    expect(res.body.products[0].totalRevenue).toBe(60000);
    expect(res.body.products[1].productId).toBe(prodB.id);
    expect(res.body.products[1].totalSold).toBe(1);
    expect(res.body.products[1].totalRevenue).toBe(15000);
  });

  it('should return 401 without auth', async () => {
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date().toISOString();
    const res = await request(app).get(`/mitra/analytics/products?from=${from}&to=${to}`);
    expect(res.status).toBe(401);
  });
});
