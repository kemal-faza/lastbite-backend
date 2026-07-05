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
});
