import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { createAdminUser, createFoodSaverUser } from './setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

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

  // ── Edge-case tests ──────────────────────────────────────────────

  it('should reactivate a soft-deleted product', async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    const res = await request(app)
      .patch(`/admin/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });

  it('should reject FOOD_SAVER from accessing admin products', async () => {
    const foodSaver = await createFoodSaverUser('foodsaver-admin@test.com');
    const userToken = signAccessToken({ userId: foodSaver.id, email: foodSaver.email });

    const res = await request(app)
      .get('/admin/products')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should reject MITRA from accessing admin products', async () => {
    const mitraUser = await prisma.user.create({
      data: {
        email: 'mitra-admin@test.com',
        name: 'Mitra Admin',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
      },
    });
    const mitraToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });

    const res = await request(app)
      .get('/admin/products')
      .set('Authorization', `Bearer ${mitraToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 400 for invalid product ID format', async () => {
    const res = await request(app)
      .patch('/admin/products/invalid-uuid')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for non-existent UUID product', async () => {
    const res = await request(app)
      .patch('/admin/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('should return 400 when isActive field is missing', async () => {
    const res = await request(app)
      .patch(`/admin/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should list products filtered by isActive=false', async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    const res = await request(app)
      .get('/admin/products?isActive=false')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);
    expect(res.body.products[0].isActive).toBe(false);
  });

  it('should list products filtered by isActive=true', async () => {
    const res = await request(app)
      .get('/admin/products?isActive=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThanOrEqual(1);
    expect(res.body.products[0].isActive).toBe(true);
  });

  it('should handle bad query params gracefully (non-boolean isActive)', async () => {
    const res = await request(app)
      .get('/admin/products?isActive=notaboolean')
      .set('Authorization', `Bearer ${adminToken}`);

    // isActive query param parsing: 'true' → true, 'false' → false, anything else → undefined
    // So 'notaboolean' is treated as undefined, returns all products
    expect(res.status).toBe(200);
  });

  it('should search products by name', async () => {
    const res = await request(app)
      .get('/admin/products?search=Test')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThanOrEqual(1);
    expect(res.body.products[0].name).toContain('Test');
  });

  it('should return empty search results for non-matching name', async () => {
    const res = await request(app)
      .get('/admin/products?search=zzzznotexist')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
  });

  it('should paginate admin products list', async () => {
    // Create 3 more products
    const mitra = await prisma.user.findFirst({ where: { role: 'MITRA' } });
    if (!mitra) throw new Error('No mitra found');
    await prisma.product.createMany({
      data: [
        { name: 'P2', category: 'meals', originalPrice: 100, discountedPrice: 50, stock: 1, storeName: 'S', expiresAt: new Date(Date.now() + 86400000), mitraId: mitra.id },
        { name: 'P3', category: 'meals', originalPrice: 200, discountedPrice: 100, stock: 2, storeName: 'S', expiresAt: new Date(Date.now() + 86400000), mitraId: mitra.id },
        { name: 'P4', category: 'meals', originalPrice: 300, discountedPrice: 150, stock: 3, storeName: 'S', expiresAt: new Date(Date.now() + 86400000), mitraId: mitra.id },
      ],
    });

    const res = await request(app)
      .get('/admin/products?limit=2&page=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(2);
    expect(res.body.total).toBe(4);
    expect(res.body.totalPages).toBe(2);
  });
});
