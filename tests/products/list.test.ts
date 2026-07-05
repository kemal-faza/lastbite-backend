import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';

const app = createApp();

describe('GET /products', () => {
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

    await prisma.product.createMany({
      data: [
        {
          name: 'Nasi Goreng',
          description: 'Enak',
          category: 'meals',
          originalPrice: 20000,
          discountedPrice: 10000,
          stock: 5,
          storeName: 'Warung A',
          expiresAt: new Date(Date.now() + 3600000),
          mitraId: user.id,
          isActive: true,
        },
        {
          name: 'Roti Bakar',
          description: 'Manis',
          category: 'bakery',
          originalPrice: 15000,
          discountedPrice: 7500,
          stock: 3,
          storeName: 'Toko Roti',
          expiresAt: new Date(Date.now() + 7200000),
          mitraId: user.id,
          isActive: true,
        },
        {
          name: 'Es Kopi',
          description: 'Segar',
          category: 'drinks',
          originalPrice: 18000,
          discountedPrice: 9000,
          stock: 10,
          storeName: 'Kopiku',
          expiresAt: new Date(Date.now() + 1800000),
          mitraId: user.id,
          isActive: true,
        },
        {
          name: 'Mie Ayam',
          description: 'Lezat',
          category: 'meals',
          originalPrice: 12000,
          discountedPrice: 8000,
          stock: 2,
          storeName: 'Mie Ayam Pakde',
          expiresAt: new Date(Date.now() + 5400000),
          mitraId: user.id,
          isActive: true,
        },
      ],
    });
  });

  it('should return all active products with default pagination', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(4);
    expect(res.body.total).toBe(4);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.totalPages).toBe(1);
  });

  it('should filter by category', async () => {
    const res = await request(app).get('/products?category=meals');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(2);
    expect(res.body.products.every((p: { category: string }) => p.category === 'meals')).toBe(true);
  });

  it('should sort by price ascending', async () => {
    const res = await request(app).get('/products?sort=price_asc');
    expect(res.status).toBe(200);
    const prices = res.body.products.map((p: { discountedPrice: number }) => p.discountedPrice);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it('should paginate with limit and page', async () => {
    const res = await request(app).get('/products?limit=2&page=1');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(2);
    expect(res.body.total).toBe(4);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.page).toBe(1);

    const res2 = await request(app).get('/products?limit=2&page=2');
    expect(res2.status).toBe(200);
    expect(res2.body.products.length).toBe(2);
    expect(res2.body.page).toBe(2);
  });

  it('should return 400 for invalid category value', async () => {
    const res = await request(app).get('/products?category=nonexistent');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should filter drinks with price descending', async () => {
    const res = await request(app).get('/products?category=drinks&sort=price_desc');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);
    expect(res.body.products[0].category).toBe('drinks');
  });
});
