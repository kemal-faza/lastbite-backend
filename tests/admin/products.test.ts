import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { createAdminUser } from './setup.js';

const app = createApp();

describe('Admin Product Moderation', () => {
  let adminToken: string;
  let productId: string;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.accessToken;

    const mitra = await prisma.user.create({
      data: { email: 'seller@test.com', name: 'Seller', passwordHash: 'hash', role: 'MITRA', isVerified: true },
    });

    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        category: 'meals',
        originalPrice: 30000,
        discountedPrice: 20000,
        stock: 10,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 86400000),
        mitraId: mitra.id,
        isActive: true,
      },
    });
    productId = product.id;
  });

  it('should list all products', async () => {
    const res = await request(app)
      .get('/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].name).toBe('Test Product');
  });

  it('should deactivate a product', async () => {
    const res = await request(app)
      .patch(`/admin/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);

    const db = await prisma.product.findUnique({ where: { id: productId } });
    expect(db!.isActive).toBe(false);
  });
});
