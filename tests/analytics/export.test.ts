import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('GET /mitra/analytics/export', () => {
  let mitraAccessToken: string;
  let mitraUserId: string;

  beforeEach(async () => {
    const mitraUser = await prisma.user.create({
      data: {
        email: 'export-mitra@example.com',
        name: 'Export Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: { storeName: 'Toko Ekspor', verificationStatus: 'VERIFIED' },
        },
      },
    });
    mitraUserId = mitraUser.id;
    mitraAccessToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });
  });

  it('should return CSV file with correct headers and content', async () => {
    const product = await prisma.product.create({
      data: {
        name: 'Export Product',
        category: 'meals',
        originalPrice: 30000,
        discountedPrice: 20000,
        stock: 10,
        storeName: 'Toko Ekspor',
        expiresAt: new Date(Date.now() + 86400000),
        mitraId: mitraUserId,
      },
    });

    const buyer = await prisma.user.create({
      data: {
        email: 'exp-buyer@example.com',
        name: 'Exp Buyer',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });

    const now = Date.now();
    const orderDate = new Date(now);
    orderDate.setUTCHours(10, 30, 0, 0);

    await prisma.order.create({
      data: {
        userId: buyer.id,
        storeName: 'Toko Ekspor',
        status: 'PICKED_UP',
        pickupCode: 'EXPT-0001',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 40000,
        savingAmount: 20000,
        buyerName: 'Buyer Export',
        buyerPhone: '08000000',
        createdAt: orderDate,
        items: {
          create: {
            productId: product.id,
            name: 'Export Product',
            storeName: 'Toko Ekspor',
            price: 20000,
            originalPrice: 30000,
            quantity: 2,
          },
        },
      },
    });

    const from = new Date(now - 86400000).toISOString();
    const to = new Date(now).toISOString();

    const res = await request(app)
      .get(`/mitra/analytics/export?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${mitraAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.csv');

    const lines = res.text.trim().split('\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]).toContain('Tanggal');
    expect(lines[0]).toContain('Produk');
    expect(lines[0]).toContain('Jumlah');
    expect(lines[0]).toContain('Pendapatan');

    expect(lines[1]).toContain('Export Product');
    expect(lines[1]).toContain('2');
    expect(lines[1]).toContain('40000');
  });

  it('should return 401 without auth', async () => {
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date().toISOString();
    const res = await request(app).get(`/mitra/analytics/export?from=${from}&to=${to}`);
    expect(res.status).toBe(401);
  });
});
