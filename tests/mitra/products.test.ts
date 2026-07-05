import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('Mitra Products API', () => {
  let mitraAccessToken: string;
  let mitraUserId: string;
  let productId: string;

  beforeEach(async () => {
    const mitraUser = await prisma.user.create({
      data: {
        email: 'mitra-products@example.com',
        name: 'Mitra Products',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: {
            storeName: 'Toko Mitra',
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    mitraUserId = mitraUser.id;
    mitraAccessToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });

    const product = await prisma.product.create({
      data: {
        name: 'Roti Coklat',
        category: 'bakery',
        originalPrice: 10000,
        discountedPrice: 5000,
        stock: 8,
        storeName: 'Toko Mitra',
        expiresAt: new Date(Date.now() + 86400000),
        mitraId: mitraUserId,
      },
    });
    productId = product.id;
  });

  describe('GET /mitra/products', () => {
    it('should list own products', async () => {
      const res = await request(app)
        .get('/mitra/products')
        .set('Authorization', `Bearer ${mitraAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].name).toBe('Roti Coklat');
    });

    it('should not show other mitra products', async () => {
      // Create another mitra with their own product
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-mitra@example.com',
          name: 'Other Mitra',
          passwordHash: 'hash',
          role: 'MITRA',
          isVerified: true,
          mitraProfile: {
            create: { storeName: 'Other Store', verificationStatus: 'VERIFIED' },
          },
        },
      });
      await prisma.product.create({
        data: {
          name: 'Other Product',
          category: 'meals',
          originalPrice: 20000,
          discountedPrice: 10000,
          stock: 3,
          storeName: 'Other Store',
          expiresAt: new Date(Date.now() + 86400000),
          mitraId: otherUser.id,
        },
      });

      const res = await request(app)
        .get('/mitra/products')
        .set('Authorization', `Bearer ${mitraAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].name).toBe('Roti Coklat');
    });
  });

  describe('PATCH /mitra/products/:id', () => {
    it('should update own product', async () => {
      const res = await request(app)
        .patch(`/mitra/products/${productId}`)
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ name: 'Roti Coklat Spesial', stock: 15 });

      expect(res.status).toBe(200);
      expect(res.body.product.name).toBe('Roti Coklat Spesial');
      expect(res.body.product.stock).toBe(15);
    });

    it('should reject updating other mitra product', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'other2@example.com',
          name: 'Other2',
          passwordHash: 'hash',
          role: 'MITRA',
          isVerified: true,
          mitraProfile: {
            create: { storeName: 'S2', verificationStatus: 'VERIFIED' },
          },
        },
      });
      const otherProduct = await prisma.product.create({
        data: {
          name: 'Other P',
          category: 'meals',
          originalPrice: 20000,
          discountedPrice: 10000,
          stock: 3,
          storeName: 'S2',
          expiresAt: new Date(Date.now() + 86400000),
          mitraId: otherUser.id,
        },
      });

      const res = await request(app)
        .patch(`/mitra/products/${otherProduct.id}`)
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ name: 'Hacked!' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('DELETE /mitra/products/:id', () => {
    it('should soft-delete own product', async () => {
      const res = await request(app)
        .delete(`/mitra/products/${productId}`)
        .set('Authorization', `Bearer ${mitraAccessToken}`);

      expect(res.status).toBe(204);

      const product = await prisma.product.findUnique({ where: { id: productId } });
      expect(product!.isActive).toBe(false);
    });

    it('should reject deleting other mitra product', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'other3@example.com',
          name: 'Other3',
          passwordHash: 'hash',
          role: 'MITRA',
          isVerified: true,
          mitraProfile: {
            create: { storeName: 'S3', verificationStatus: 'VERIFIED' },
          },
        },
      });
      const otherProduct = await prisma.product.create({
        data: {
          name: 'Other P2',
          category: 'meals',
          originalPrice: 20000,
          discountedPrice: 10000,
          stock: 3,
          storeName: 'S3',
          expiresAt: new Date(Date.now() + 86400000),
          mitraId: otherUser.id,
        },
      });

      const res = await request(app)
        .delete(`/mitra/products/${otherProduct.id}`)
        .set('Authorization', `Bearer ${mitraAccessToken}`);

      expect(res.status).toBe(404);
    });
  });
});
