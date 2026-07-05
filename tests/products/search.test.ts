import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';

const app = createApp();

describe('GET /products/search', () => {
  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'mitra@searchtest.com',
        name: 'Test Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
      },
    });
    const now = new Date();
    await prisma.product.createMany({
      data: [
        {
          name: 'Ayam Geprek Pedas',
          description: 'Ayam geprek level 5 dengan sambal bawang',
          category: 'meals',
          originalPrice: 20000,
          discountedPrice: 10000,
          stock: 5,
          storeName: 'Preksu Geprek',
          expiresAt: new Date(now.getTime() + 7200000),
          mitraId: user.id,
        },
        {
          name: 'Nasi Goreng Special',
          description: 'Nasi goreng dengan topping lengkap',
          category: 'meals',
          originalPrice: 25000,
          discountedPrice: 15000,
          stock: 3,
          storeName: 'Warung Nasi',
          expiresAt: new Date(now.getTime() + 3600000),
          mitraId: user.id,
        },
        {
          name: 'Roti Coklat Lumer',
          description: 'Roti dengan isian coklat premium',
          category: 'bakery',
          originalPrice: 10000,
          discountedPrice: 5000,
          stock: 10,
          storeName: 'Bakery Manis',
          expiresAt: new Date(now.getTime() + 14400000),
          mitraId: user.id,
        },
        {
          name: 'Es Teh Manis',
          description: 'Teh manis segar dengan es batu',
          category: 'drinks',
          originalPrice: 8000,
          discountedPrice: 4000,
          stock: 15,
          storeName: 'Kopiku',
          expiresAt: new Date(now.getTime() + 1800000),
          mitraId: user.id,
        },
      ],
    });
  });

  it('should search by product name with partial match', async () => {
    const res = await request(app).get('/products/search?q=ayam');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThanOrEqual(1);
    expect(res.body.products[0].name).toContain('Ayam');
  });

  it('should search by store name', async () => {
    const res = await request(app).get('/products/search?q=preksu');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
  });

  it('should return empty for no matches', async () => {
    const res = await request(app).get('/products/search?q=zzzznotfound');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
  });

  it('should return 400 for empty query', async () => {
    const res = await request(app).get('/products/search');
    expect(res.status).toBe(400);
  });
});
