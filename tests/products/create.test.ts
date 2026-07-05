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
});
