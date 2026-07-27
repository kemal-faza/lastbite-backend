import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { xssPayloads, sqlInjection, longString, badUuids } from '../support/edgeCases.js';

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

    it('should reject missing buyerName', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerPhone: '08123456789' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty buyerName', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerName: '', buyerPhone: '08123456789' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject buyerName exceeding max length (100)', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerName: longString(101), buyerPhone: '08123456789' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing buyerPhone', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerName: 'Budi' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject buyerPhone too short (< 6)', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerName: 'Budi', buyerPhone: '123' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject buyerPhone exceeding max length (20)', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerName: 'Budi', buyerPhone: longString(21) });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject notes exceeding max length (500)', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          buyerName: 'Budi',
          buyerPhone: '08123456789',
          notes: longString(501),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should accept XSS-looking buyerName (output encoding, not input sanitization)', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerName: xssPayloads[0], buyerPhone: '08123456789' });

      expect(res.status).toBe(201);
    });

    it('should accept SQL-looking buyerName (Prisma parameterized queries prevent injection)', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerName: sqlInjection[0], buyerPhone: '08123456789' });

      expect(res.status).toBe(201);
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

  describe('POST /orders/:id/cancel-expired', () => {
    let orderId: string;
    let pickupCode: string;

    beforeEach(async () => {
      // Create an order for cancel tests
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 2 });

      const createRes = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerName: 'Budi', buyerPhone: '08123456789' });

      orderId = createRes.body.order.id;
      pickupCode = createRes.body.order.pickupCode;
    });

    it('should cancel expired order and restore stock', async () => {
      // Set pickup to the past
      await prisma.order.update({
        where: { id: orderId },
        data: { pickupExpiresAt: new Date(Date.now() - 3600000) },
      });

      const res = await request(app)
        .post(`/orders/${orderId}/cancel-expired`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('CANCELLED');
      expect(res.body.message).toBe('Pesanan dibatalkan karena kode pickup kedaluwarsa');

      // Verify stock was restored (5 initial - 2 for order + 2 restored = 5)
      const product = await prisma.product.findUnique({ where: { id: productId } });
      expect(product!.stock).toBe(5);
    });

    it('should return 400 NOT_EXPIRED if pickup code not yet expired', async () => {
      const futureExpiry = new Date(Date.now() + 7200000); // 2h from now
      await prisma.order.update({
        where: { id: orderId },
        data: { pickupExpiresAt: futureExpiry },
      });

      const res = await request(app)
        .post(`/orders/${orderId}/cancel-expired`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NOT_EXPIRED');
    });

    it('should return 409 for already PICKED_UP order', async () => {
      // Set status to PICKED_UP directly (status takes precedence over expiry check)
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PICKED_UP', pickupExpiresAt: new Date(Date.now() - 3600000) },
      });

      const res = await request(app)
        .post(`/orders/${orderId}/cancel-expired`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_STATUS');
    });

    it('should return 409 for already CANCELLED order', async () => {
      // Set expired and cancel first
      await prisma.order.update({
        where: { id: orderId },
        data: { pickupExpiresAt: new Date(Date.now() - 3600000) },
      });

      await request(app)
        .post(`/orders/${orderId}/cancel-expired`)
        .set('Authorization', `Bearer ${accessToken}`);

      const res = await request(app)
        .post(`/orders/${orderId}/cancel-expired`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_STATUS');
    });

    it('should return 404 for non-existent order', async () => {
      const res = await request(app)
        .post('/orders/00000000-0000-0000-0000-000000000000/cancel-expired')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ORDER_NOT_FOUND');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).post(`/orders/${orderId}/cancel-expired`);
      expect(res.status).toBe(401);
    });
  });

  describe('Route Param Validation', () => {
    it('should reject malformed UUID for GET /orders/:id', async () => {
      const res = await request(app)
        .get('/orders/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject malformed UUID for POST /orders/:id/verify-pickup', async () => {
      const res = await request(app)
        .post('/orders/not-a-uuid/verify-pickup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pickupCode: 'LAST-TEST' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject malformed UUID for POST /orders/:id/cancel-expired', async () => {
      // cancel-expired uses z.string().min(1) — bad UUID passes but service returns 404
      const res = await request(app)
        .post('/orders/not-a-uuid/cancel-expired')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('IDOR - Cross-User Access', () => {
    let otherAccessToken: string;
    let otherOrderId: string;
    let otherPickupCode: string;

    beforeEach(async () => {
      // Create User B (different from the beforeEach user A)
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-order@example.com',
          name: 'Other User',
          passwordHash: 'hash',
          role: 'FOOD_SAVER',
          isVerified: true,
        },
      });
      otherAccessToken = signAccessToken({ userId: otherUser.id, email: otherUser.email });

      // Create a cart and order for User B
      const otherProduct = await prisma.product.create({
        data: {
          name: 'Other Product',
          category: 'meals',
          originalPrice: 10000,
          discountedPrice: 5000,
          stock: 5,
          storeName: 'Warung Lain',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .send({ productId: otherProduct.id, quantity: 1 });

      const createRes = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .send({ buyerName: 'Other', buyerPhone: '08111111111' });

      otherOrderId = createRes.body.order.id;
      otherPickupCode = createRes.body.order.pickupCode;
    });

    it('should return 404 when User A views User B order', async () => {
      const res = await request(app)
        .get(`/orders/${otherOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ORDER_NOT_FOUND');
    });

    it('should return 404 when User A verifies User B pickup', async () => {
      const res = await request(app)
        .post(`/orders/${otherOrderId}/verify-pickup`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pickupCode: otherPickupCode });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ORDER_NOT_FOUND');
    });

    it('should return 404 when User A cancels User B expired order', async () => {
      // Manually expire the order
      await prisma.order.update({
        where: { id: otherOrderId },
        data: { pickupExpiresAt: new Date(Date.now() - 3600000) },
      });

      const res = await request(app)
        .post(`/orders/${otherOrderId}/cancel-expired`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('Pagination Validation', () => {
    it('should reject page=0', async () => {
      const res = await request(app)
        .get('/orders?page=0')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject negative page', async () => {
      const res = await request(app)
        .get('/orders?page=-1')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject limit=0', async () => {
      const res = await request(app)
        .get('/orders?limit=0')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject limit exceeding max (50)', async () => {
      const res = await request(app)
        .get('/orders?limit=51')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject negative limit', async () => {
      const res = await request(app)
        .get('/orders?limit=-5')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Verify Pickup - Missing pickupCode', () => {
    let orderId: string;

    beforeEach(async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      const createRes = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ buyerName: 'Budi', buyerPhone: '08123456789' });

      orderId = createRes.body.order.id;
    });

    it('should reject missing pickupCode in body', async () => {
      const res = await request(app)
        .post(`/orders/${orderId}/verify-pickup`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
