import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('Orders API', () => {
  let accessToken: string;
  let userId: string;
  let productId: string;

  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: 'order-test@example.com',
        name: 'Order Tester',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });
    userId = user.id;
    accessToken = signAccessToken({ userId: user.id, email: user.email });

    const product = await prisma.product.create({
      data: {
        name: 'Test Nasi Goreng',
        category: 'meals',
        originalPrice: 25000,
        discountedPrice: 15000,
        stock: 5,
        storeName: 'Warung Test',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    productId = product.id;
  });

  describe('POST /orders', () => {
    it('should create order from cart', async () => {
      // Add item to cart first
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 2 });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          buyerName: 'Budi',
          buyerPhone: '08123456789',
        });

      expect(res.status).toBe(201);
      expect(res.body.order).toBeDefined();
      expect(res.body.order.storeName).toBe('Warung Test');
      expect(res.body.order.status).toBe('PENDING');
      expect(res.body.order.totalAmount).toBe(30000);
      expect(res.body.order.savingAmount).toBe(20000);
      expect(res.body.order.buyerName).toBe('Budi');
      expect(res.body.order.buyerPhone).toBe('08123456789');
      expect(res.body.order.pickupCode).toMatch(/^LAST-/);
      expect(res.body.order.items).toHaveLength(1);
      expect(res.body.order.items[0].name).toBe('Test Nasi Goreng');
      expect(res.body.order.items[0].quantity).toBe(2);
    });

    it('should return 400 when cart empty', async () => {
      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          buyerName: 'Budi',
          buyerPhone: '08123456789',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CART_EMPTY');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).post('/orders').send({
        buyerName: 'Budi',
        buyerPhone: '08123456789',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /orders', () => {
    it('should return empty array when no orders', async () => {
      const res = await request(app)
        .get('/orders')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toEqual([]);
    });

    it('should return user orders', async () => {
      // Create an order first
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          buyerName: 'Budi',
          buyerPhone: '08123456789',
        });

      const res = await request(app)
        .get('/orders')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].buyerName).toBe('Budi');
      expect(res.body.orders[0].items).toHaveLength(1);
    });
  });

  describe('GET /orders/:id', () => {
    it('should return 404 for non-existent order', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/orders/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ORDER_NOT_FOUND');
    });

    it('should return order detail', async () => {
      // Create an order first
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const createRes = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          buyerName: 'Budi',
          buyerPhone: '08123456789',
        });

      const orderId = createRes.body.order.id;

      const res = await request(app)
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.order.id).toBe(orderId);
      expect(res.body.order.items).toHaveLength(1);
    });
  });

  describe('GET /orders/has-history', () => {
    it('should return false for user with no orders', async () => {
      const res = await request(app)
        .get('/orders/has-history')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hasHistory: false });
    });

    it('should return true for user with at least one order', async () => {
      // Add item to cart first, then create an order
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerName: 'Test User', buyerPhone: '08123456789' });

      const res = await request(app)
        .get('/orders/has-history')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hasHistory: true });
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/orders/has-history');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /orders/:id/verify-pickup', () => {
    let orderId: string;
    let pickupCode: string;

    beforeEach(async () => {
      // Create an order for pickup tests
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const createRes = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          buyerName: 'Budi',
          buyerPhone: '08123456789',
        });

      orderId = createRes.body.order.id;
      pickupCode = createRes.body.order.pickupCode;
    });

    it('should verify with correct code', async () => {
      const res = await request(app)
        .post(`/orders/${orderId}/verify-pickup`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pickupCode });

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('PICKED_UP');
      expect(res.body.message).toBe('Pickup berhasil diverifikasi');
    });

    it('should reject wrong code', async () => {
      const res = await request(app)
        .post(`/orders/${orderId}/verify-pickup`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pickupCode: 'WRONG-1234' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PICKUP_CODE');
    });

    it('should reject expired pickup code', async () => {
      // Manually set pickupExpiresAt to the past
      await prisma.order.update({
        where: { id: orderId },
        data: { pickupExpiresAt: new Date(Date.now() - 3600000) },
      });

      const res = await request(app)
        .post(`/orders/${orderId}/verify-pickup`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pickupCode });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PICKUP_EXPIRED');
    });
  });
});
