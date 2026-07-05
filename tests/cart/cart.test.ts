import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('Cart API', () => {
  let accessToken: string;
  let userId: string;
  let productId: string;
  let secondProductId: string;

  beforeEach(async () => {
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
      expect(res.body.cart.storeName).toBe('Warung Test');
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

    it('should return 409 when adding product from different store', async () => {
      // First add from Warung Test
      await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId, quantity: 1 });

      // Try adding from Warung Lain
      const res = await request(app)
        .post('/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ productId: secondProductId, quantity: 1 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DIFFERENT_STORE');
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
});
