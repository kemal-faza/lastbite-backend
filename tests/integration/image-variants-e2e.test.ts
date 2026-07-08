import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const app = createApp();

describe('Image variants E2E flow', () => {
  let mitraToken: string;

  beforeEach(async () => {
    try {
      await fs.rm(path.resolve('uploads/products'), { recursive: true, force: true });
    } catch {}

    const user = await prisma.user.create({
      data: {
        email: 'mitra@test.com',
        name: 'Test Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
      },
    });
    mitraToken = signAccessToken({ userId: user.id, email: user.email });
  });

  it('full flow: upload → create product → fetch returns variants', async () => {
    // 1. Upload image
    const imageBuffer = await sharp({
      create: { width: 1000, height: 800, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    const uploadRes = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${mitraToken}`)
      .attach('file', imageBuffer, 'product.jpg');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.variants).toBeDefined();
    const { url, variants } = uploadRes.body;

    // 2. Create product with the imageUrl
    const productRes = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'Test Product',
        category: 'meals',
        originalPrice: 20000,
        discountedPrice: 10000,
        stock: 5,
        imageUrl: url,
        storeName: 'Test Store',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(productRes.status).toBe(201);
    const productId = productRes.body.product.id;

    // 3. Fetch product (food saver perspective, no auth)
    const getRes = await request(app).get(`/products/${productId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.product.imageUrl).toBe(url);
    expect(getRes.body.product.imageVariants).toBeDefined();
    expect(getRes.body.product.imageVariants.thumb).toBe(variants.thumb);
    expect(getRes.body.product.imageVariants.card).toBe(variants.card);
    expect(getRes.body.product.imageVariants.full).toBe(variants.full);
  });

  it('GET /products list includes imageVariants for each product', async () => {
    // Upload and create a product
    const imageBuffer = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 50, g: 200, b: 100 } },
    })
      .jpeg()
      .toBuffer();

    const uploadRes = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${mitraToken}`)
      .attach('file', imageBuffer, 'p.jpg');

    await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${mitraToken}`)
      .send({
        name: 'Listed Product',
        category: 'bakery',
        originalPrice: 15000,
        discountedPrice: 7500,
        stock: 3,
        imageUrl: uploadRes.body.url,
        storeName: 'Toko Roti',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    // Fetch list
    const listRes = await request(app).get('/products');
    expect(listRes.status).toBe(200);
    expect(listRes.body.products).toHaveLength(1);
    expect(listRes.body.products[0].imageVariants).toBeDefined();
    expect(listRes.body.products[0].imageVariants.thumb).toMatch(/\/products\/.+\/thumb\.jpg$/);
  });
});
