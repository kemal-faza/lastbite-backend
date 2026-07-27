import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { longString } from '../support/edgeCases.js';

const app = createApp();

describe('Cart API', () => {
  let accessToken: string;
  let userId: string;
  let productId: string;
  let secondProductId: string;

  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: 'cart-test@example.com',
        name: 'Cart Tester',
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

    const secondProduct = await prisma.product.create({
      data: {
        name: 'Test Es Teh',
        category: 'drinks',
        originalPrice: 8000,
        discountedPrice: 4000,
        stock: 10,
        storeName: 'Warung Lain',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    secondProductId = secondProduct.id;
  });

  describe('GET /cart', () => {
    it('should return empty cart for new user', async () => {
      const res = await request(app)
        .get('/cart')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.cart).toBeDefined();
      expect(res.body.cart.items).toEqual([]);
      expect(res.body.cart.storeName).toBeNull();
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/cart');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /cart', () => {
    it('should add item to cart with correct quantity', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0].productId).toBe(productId);
      expect(res.body.cart.items[0].quantity).toBe(2);
      expect(res.body.cart.storeName).toBeNull();
    });

    it('should increase quantity when adding same product', async () => {
      // First add
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 2 });

      // Second add (same product)
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 3 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0].quantity).toBe(5);
    });

    it('should return 409 when stock exceeded', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 10 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    });

    it('should allow adding products from different stores', async () => {
      // First add from Warung Test
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      // Add from Warung Lain — multi-store is now allowed
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: secondProductId, quantity: 1 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(2);
    });

    it('should return 404 when product does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: fakeId, quantity: 1 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('PATCH /cart/items/:productId', () => {
    it('should update item quantity', async () => {
      // First add item
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 3 });

      // Update quantity
      const res = await request(app)
        .patch(`/cart/items/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items[0].quantity).toBe(2);
    });

    it('should remove item when quantity is 0', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 3 });

      const res = await request(app)
        .patch(`/cart/items/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 0 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(0);
      expect(res.body.cart.storeName).toBeNull();
    });

    it('should return 409 when stock exceeded', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 3 });

      const res = await request(app)
        .patch(`/cart/items/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 10 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    });
  });

  describe('DELETE /cart/items/:productId', () => {
    it('should remove item from cart', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 2 });

      const res = await request(app)
        .delete(`/cart/items/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.cart.items).toHaveLength(0);
      expect(res.body.cart.storeName).toBeNull();
    });
  });

  describe('DELETE /cart', () => {
    it('should clear entire cart', async () => {
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 2 });

      const res = await request(app)
        .delete('/cart')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Keranjang dikosongkan');
    });
  });

  describe('POST /cart - Input Validation', () => {
    it('should reject negative quantity', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: -1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject zero quantity', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject float quantity', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 2.5 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject quantity exceeding maximum (99)', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 100 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should accept quantity at boundary maximum (99)', async () => {
      // Product with enough stock for the boundary test
      const highStockProduct = await prisma.product.create({
        data: {
          name: 'High Stock Item',
          category: 'meals',
          originalPrice: 10000,
          discountedPrice: 5000,
          stock: 100,
          storeName: 'Warung Test',
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: highStockProduct.id, quantity: 99 });

      expect(res.status).toBe(200);
      expect(res.body.cart.items[0].quantity).toBe(99);
    });

    it('should reject missing productId', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject malformed UUID as productId', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: 'not-a-uuid', quantity: 2 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty body', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject SQL injection in productId', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: "' OR '1'='1", quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid productId with default quantity', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId });

      expect(res.status).toBe(200);
      expect(res.body.cart.items[0].quantity).toBe(1);
    });
  });

  describe('PATCH /cart/items/:productId - Input Validation', () => {
    beforeEach(async () => {
      // Ensure item exists in cart for patch tests
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 3 });
    });

    it('should reject negative quantity', async () => {
      const res = await request(app)
        .patch(`/cart/items/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: -1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject float quantity', async () => {
      const res = await request(app)
        .patch(`/cart/items/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 2.5 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject quantity exceeding maximum (99)', async () => {
      const res = await request(app)
        .patch(`/cart/items/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 100 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing quantity field', async () => {
      const res = await request(app)
        .patch(`/cart/items/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject malformed UUID in route param', async () => {
      const res = await request(app)
        .patch('/cart/items/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /cart/items/:productId - Input Validation', () => {
    it('should reject malformed UUID in route param', async () => {
      const res = await request(app)
        .delete('/cart/items/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Business Rules', () => {
    it('should return 404 for inactive product', async () => {
      const inactiveProduct = await prisma.product.create({
        data: {
          name: 'Inactive Product',
          category: 'meals',
          originalPrice: 10000,
          discountedPrice: 5000,
          stock: 5,
          storeName: 'Warung Test',
          expiresAt: new Date(Date.now() + 86400000),
          isActive: false,
        },
      });

      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: inactiveProduct.id, quantity: 1 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('Auth - Malformed Tokens', () => {
    const invalidTokens = [
      'Bearer invalid-token',
      'Bearer ',
      'Bearer',
      'NotBearer token',
      '',
    ];

    it('should return 401 with malformed token on GET /cart', async () => {
      const res = await request(app)
        .get('/cart')
        .set('Authorization', `Bearer some-invalid-jwt`);

      expect(res.status).toBe(401);
    });

    it('should return 401 with malformed token on POST /cart', async () => {
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer some-invalid-jwt`)
        .send({ productId, quantity: 1 });

      expect(res.status).toBe(401);
    });

    it('should return 401 with malformed token on PATCH /cart/items/:id', async () => {
      const res = await request(app)
        .patch(`/cart/items/${productId}`)
        .set('Authorization', `Bearer some-invalid-jwt`)
        .send({ quantity: 2 });

      expect(res.status).toBe(401);
    });

    it('should return 401 with malformed token on DELETE /cart/items/:id', async () => {
      const res = await request(app)
        .delete(`/cart/items/${productId}`)
        .set('Authorization', `Bearer some-invalid-jwt`);

      expect(res.status).toBe(401);
    });
  });
});
