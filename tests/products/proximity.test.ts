import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';

const app = createApp();

// Reference point: Monas (Jakarta)
const MONAS_LAT = -6.1754;
const MONAS_LNG = 106.8272;

describe('GET /products -- proximity search', () => {
  let proximityUserId: string;

  beforeEach(async () => {
    // Ensure clean state for this test group
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: 'mitra-proximity@test.com',
        name: 'Mitra Proximity',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
      },
    });
    proximityUserId = user.id;

    await prisma.product.createMany({
      data: [
        {
          name: 'Nasi Goreng Monas',
          description: 'Dekat Monas',
          category: 'meals',
          originalPrice: 20000,
          discountedPrice: 10000,
          stock: 5,
          storeName: 'Warung Monas',
          storeAddress: 'Sekitar Monas',
          storeLat: -6.1800,
          storeLng: 106.8300,
          expiresAt: new Date(Date.now() + 3600000),
          mitraId: user.id,
          isActive: true,
        },
        {
          name: 'Roti Bakar Menteng',
          description: 'Dekat Menteng',
          category: 'bakery',
          originalPrice: 15000,
          discountedPrice: 7500,
          stock: 3,
          storeName: 'Toko Roti Menteng',
          storeAddress: 'Menteng',
          storeLat: -6.1900,
          storeLng: 106.8300,
          expiresAt: new Date(Date.now() + 7200000),
          mitraId: user.id,
          isActive: true,
        },
        {
          name: 'Es Kopi Bogor',
          description: 'Jauh dari Monas',
          category: 'drinks',
          originalPrice: 18000,
          discountedPrice: 9000,
          stock: 10,
          storeName: 'Kopiku Bogor',
          storeAddress: 'Bogor',
          storeLat: -6.5972,
          storeLng: 106.8060,
          expiresAt: new Date(Date.now() + 1800000),
          mitraId: user.id,
          isActive: true,
        },
        {
          name: 'Mie Ayam BSD',
          description: 'Jauh dari Monas',
          category: 'meals',
          originalPrice: 12000,
          discountedPrice: 8000,
          stock: 2,
          storeName: 'Mie Ayam BSD',
          storeAddress: 'BSD City',
          storeLat: -6.3532,
          storeLng: 106.6742,
          expiresAt: new Date(Date.now() + 5400000),
          mitraId: user.id,
          isActive: true,
        },
      ],
    });
  });

  it('should return only products within 5km radius from Monas', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT, lng: MONAS_LNG, radius: 5 });

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(2); // Nasi Goreng Monas + Roti Bakar Menteng

    // Verify distanceKm is included
    for (const product of res.body.products) {
      expect(product).toHaveProperty('distanceKm');
      expect(typeof product.distanceKm).toBe('number');
      expect(product.distanceKm).toBeLessThanOrEqual(5);
    }
  });

  it('should return all nearby products within a large radius', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT, lng: MONAS_LNG, radius: 100 });

    expect(res.status).toBe(200);
    // Should include Nasi Goreng, Roti Bakar, Mie Ayam (all near Jakarta)
    // Bogor is ~47 km from Monas, so within 100 km
    expect(res.body.products.length).toBeGreaterThanOrEqual(3);
  });

  it('should return 400 when radius is provided without lat/lng', async () => {
    const res = await request(app)
      .get('/products')
      .query({ radius: 5 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when lat is provided without lng', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should sort by distance ascending when sort=distance_asc', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT, lng: MONAS_LNG, sort: 'distance_asc' });

    expect(res.status).toBe(200);
    const distances = res.body.products.map(
      (p: { distanceKm: number }) => p.distanceKm
    );
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
  });

  it('should include distanceKm field in response when lat/lng provided', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT, lng: MONAS_LNG });

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
    for (const product of res.body.products) {
      expect(product).toHaveProperty('distanceKm');
      expect(typeof product.distanceKm).toBe('number');
      expect(product.distanceKm).toBeGreaterThan(0);
    }
  });

  // ── Edge-case tests ──────────────────────────────────────────────

  it('should return 400 for lat beyond -90/90 range', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: 100, lng: MONAS_LNG, radius: 5 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for lng beyond -180/180 range', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT, lng: 200, radius: 5 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for radius=0 (positive required)', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT, lng: MONAS_LNG, radius: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for negative radius', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT, lng: MONAS_LNG, radius: -5 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for radius exceeding max (500)', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT, lng: MONAS_LNG, radius: 999 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should work without lat/lng returning all products in default sort', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(4);
    // No distanceKm should be serialized when lat/lng not provided
    for (const product of res.body.products) {
      expect(product.distanceKm).toBeUndefined();
    }
  });

  it('should return 400 for lat provided without lng', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT, radius: 5 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for lng provided without lat', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lng: MONAS_LNG, radius: 5 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return empty array when no products in radius', async () => {
    // Very small radius at a remote location — nothing nearby
    const res = await request(app)
      .get('/products')
      .query({ lat: 0, lng: 0, radius: 0.1 });
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('should handle very large radius (up to 500km)', async () => {
    const res = await request(app)
      .get('/products')
      .query({ lat: MONAS_LAT, lng: MONAS_LNG, radius: 500 });
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThanOrEqual(3);
    for (const product of res.body.products) {
      expect(product).toHaveProperty('distanceKm');
    }
  });
});
