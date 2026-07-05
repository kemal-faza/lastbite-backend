import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('Mitra Orders API', () => {
  let mitraAccessToken: string;
  let mitraUserId: string;
  let productId: string;
  let orderId: string;

  beforeEach(async () => {
    const mitraUser = await prisma.user.create({
      data: {
        email: 'mitra-ord@example.com',
        name: 'Mitra Order',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: {
            storeName: 'Toko Order',
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    mitraUserId = mitraUser.id;
    mitraAccessToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });

    const product = await prisma.product.create({
      data: {
        name: 'Order Test Product',
        category: 'meals',
        originalPrice: 20000,
        discountedPrice: 10000,
        stock: 10,
        storeName: 'Toko Order',
        expiresAt: new Date(Date.now() + 86400000),
        mitraId: mitraUserId,
      },
    });
    productId = product.id;

    const fsUser = await prisma.user.create({
      data: {
        email: 'fs-ord@example.com',
        name: 'FS Order',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });

    const order = await prisma.order.create({
      data: {
        userId: fsUser.id,
        storeName: 'Toko Order',
        status: 'PENDING',
        pickupCode: 'MIT-0001',
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 20000,
        savingAmount: 20000,
        buyerName: 'Budi',
        buyerPhone: '08123456789',
        items: {
          create: {
            productId,
            name: 'Order Test Product',
            storeName: 'Toko Order',
            price: 10000,
            originalPrice: 20000,
            quantity: 2,
          },
        },
      },
      include: { items: true },
    });
    orderId = order.id;
  });

  describe('GET /mitra/orders', () => {
    it('should list orders containing mitra products', async () => {
      const res = await request(app)
        .get('/mitra/orders')
        .set('Authorization', `Bearer ${mitraAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].buyerName).toBe('Budi');
      expect(res.body.orders[0].status).toBe('PENDING');
      expect(res.body.orders[0].items).toHaveLength(1);
    });

    it('should not show orders from other stores', async () => {
      const otherMitra = await prisma.user.create({
        data: {
          email: 'other-ord@example.com',
          name: 'Other',
          passwordHash: 'hash',
          role: 'MITRA',
          isVerified: true,
          mitraProfile: { create: { storeName: 'Other', verificationStatus: 'VERIFIED' } },
        },
      });
      const otherProduct = await prisma.product.create({
        data: {
          name: 'Other P',
          category: 'meals',
          originalPrice: 10000,
          discountedPrice: 5000,
          stock: 3,
          storeName: 'Other',
          expiresAt: new Date(Date.now() + 86400000),
          mitraId: otherMitra.id,
        },
      });
      const fsUser = await prisma.user.create({
        data: { email: 'fs2@example.com', name: 'FS2', passwordHash: 'hash', role: 'FOOD_SAVER', isVerified: true },
      });
      await prisma.order.create({
        data: {
          userId: fsUser.id,
          storeName: 'Other',
          status: 'PENDING',
          pickupCode: 'OTH-0001',
          pickupExpiresAt: new Date(Date.now() + 7200000),
          totalAmount: 5000,
          savingAmount: 5000,
          buyerName: 'Other Buyer',
          buyerPhone: '08000000',
          items: { create: { productId: otherProduct.id, name: 'Other P', storeName: 'Other', price: 5000, originalPrice: 10000, quantity: 1 } },
        },
      });

      const res = await request(app)
        .get('/mitra/orders')
        .set('Authorization', `Bearer ${mitraAccessToken}`);

      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].buyerName).toBe('Budi');
    });
  });

  describe('PATCH /mitra/orders/:id/status', () => {
    it('should update from PENDING to PROCESSED', async () => {
      const res = await request(app)
        .patch(`/mitra/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ status: 'PROCESSED' });

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('PROCESSED');
    });

    it('should reject invalid transition', async () => {
      const res = await request(app)
        .patch(`/mitra/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ status: 'PICKED_UP' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });

    it('should cancel order and restore stock', async () => {
      const res = await request(app)
        .patch(`/mitra/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ status: 'CANCELLED' });

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('CANCELLED');

      const product = await prisma.product.findUnique({ where: { id: productId } });
      expect(product!.stock).toBe(12); // 10 + 2 restored
    });

    it('should reject without auth', async () => {
      const res = await request(app)
        .patch(`/mitra/orders/${orderId}/status`)
        .send({ status: 'PROCESSED' });

      expect(res.status).toBe(401);
    });
  });
});
