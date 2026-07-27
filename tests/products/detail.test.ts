import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';

const app = createApp();

describe('GET /products/:id', () => {
  let productId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'mitra@test.com',
        name: 'Test Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
      },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        description: 'A test product',
        category: 'meals',
        originalPrice: 20000,
        discountedPrice: 10000,
        stock: 5,
        storeName: 'Test Store',
        storeAddress: '123 Test St',
        expiresAt: new Date(Date.now() + 3600000),
        mitraId: user.id,
      },
    });
    productId = product.id;
  });

  it('should return product by id with status 200', async () => {
    const res = await request(app).get(`/products/${productId}`);
    expect(res.status).toBe(200);
    expect(res.body.product.id).toBe(productId);
    expect(res.body.product.name).toBe('Test Product');
    expect(res.body.product.discountPercent).toBe(50);
    expect(res.body.product.category).toBe('meals');
  });

  it('should return 404 for non-existent product', async () => {
    const res = await request(app).get('/products/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  // ── Edge-case tests ──────────────────────────────────────────────

  it('should return 404 for malformed UUID (all zeros)', async () => {
    const res = await request(app).get('/products/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('should return 404 for non-existent valid UUID', async () => {
    const res = await request(app).get('/products/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('should return detail for inactive/soft-deleted product', async () => {
    // Soft-delete the product first
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    const res = await request(app).get(`/products/${productId}`);
    // findById does NOT filter by isActive, so it should still return the product
    expect(res.status).toBe(200);
    expect(res.body.product.id).toBe(productId);
  });

  it('should return consistent error shape for not found', async () => {
    const res = await request(app).get('/products/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('code');
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('should handle SQL injection in product id', async () => {
    const res = await request(app).get("/products/' OR '1'='1");
    // Should not leak data, just return 404
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('should return valid product response shape', async () => {
    const res = await request(app).get(`/products/${productId}`);
    expect(res.status).toBe(200);
    const product = res.body.product;
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('category');
    expect(product).toHaveProperty('originalPrice');
    expect(product).toHaveProperty('discountedPrice');
    expect(product).toHaveProperty('discountPercent');
    expect(product).toHaveProperty('stock');
    expect(product).toHaveProperty('storeName');
    expect(product).toHaveProperty('expiresAt');
    expect(product).toHaveProperty('isActive');
    expect(product).toHaveProperty('createdAt');
    expect(product).toHaveProperty('updatedAt');
  });
});
