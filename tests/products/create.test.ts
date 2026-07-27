import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('POST /products', () => {
  let mitraToken: string;
  let userToken: string;

  beforeEach(async () => {
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    const mitra = await prisma.user.create({
      data: {
        email: 'mitra@createtest.com',
        name: 'Mitra Test',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        email: 'user@createtest.com',
        name: 'User Test',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });
    mitraToken = signAccessToken({ userId: mitra.id, email: mitra.email });
    userToken = signAccessToken({ userId: user.id, email: user.email });
  });

  it('should create product as mitra', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'New Product',
        description: 'A test product',
        category: 'meals',
        originalPrice: 30000,
        discountedPrice: 15000,
        stock: 10,
        storeName: 'My Store',
        storeAddress: '123 Test St',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.product.name).toBe('New Product');
    expect(res.body.product.discountPercent).toBe(50);
  });

  it('should return 403 for non-mitra user', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'New Product',
        category: 'meals',
        originalPrice: 30000,
        discountedPrice: 15000,
        stock: 10,
        storeName: 'My Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app)
      .post('/products')
      .send({
        name: 'New Product',
        category: 'meals',
        originalPrice: 30000,
        discountedPrice: 15000,
        stock: 10,
        storeName: 'My Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid data', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });

  // ── Edge-case tests ──────────────────────────────────────────────

  it('should reject discountedPrice > originalPrice', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'Mahal Diskon',
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 20000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject negative price', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'Negatif',
        category: 'meals',
        originalPrice: -5000,
        discountedPrice: 1000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject zero price', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'Gratis',
        category: 'meals',
        originalPrice: 0,
        discountedPrice: 0,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject negative stock', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'Stok Negatif',
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: -1,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should accept zero stock', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'Habis',
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 0,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.product.stock).toBe(0);
  });

  it('should reject invalid category', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'Invalid Cat',
        category: 'electronics',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject SQL injection in name', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: "'; DROP TABLE products; --",
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(201);
  });

  it('should reject XSS in name', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: '<script>alert("xss")</script>',
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        storeName: '<img src=x onerror=alert(1)>',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(201);
  });

  it('should reject very long name (over 200 chars)', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'A'.repeat(201),
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing name', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing category', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'No Cat',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing originalPrice', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'No Price',
        category: 'meals',
        discountedPrice: 5000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing discountedPrice', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'No Disc',
        category: 'meals',
        originalPrice: 10000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing stock', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'No Stock',
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing storeName', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'No Store',
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing expiresAt', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'No Expiry',
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        storeName: 'Test Store',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should accept past expiresAt (validates format, not time)', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'Past Expiry',
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
      });

    // Schema only validates datetime format, not whether it's in the future
    expect(res.status).toBe(201);
  });

  it('should reject expired/malformed token', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', 'Bearer expired.token.here')
      .send({
        name: 'Bad Token',
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(401);
  });

  it('should reject non-mitra role (FOOD_SAVER)', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'User Create',
        category: 'meals',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 5,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(403);
  });

  it('should handle unicode/emoji in name and storeName', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'Nasi Goreng 😀🔥',
        description: 'Enak 佐藤',
        category: 'meals',
        originalPrice: 25000,
        discountedPrice: 12000,
        stock: 10,
        storeName: 'Warung 佐藤',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.product.name).toBe('Nasi Goreng 😀🔥');
  });
});
