import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

vi.mock('../../src/services/geocodingService.js', () => ({
  geocodeAddress: vi.fn().mockResolvedValue({ lat: -6.2088, lng: 106.8456, formattedAddress: 'Jl. Sudirman, Jakarta' }),
}));

const app = createApp();

describe('PATCH /mitra/me/location', () => {
  let mitraAccessToken: string;
  let foodSaverAccessToken: string;

  beforeEach(async () => {
    const mitraUser = await prisma.user.create({
      data: {
        email: 'mitra@test.com',
        name: 'Test Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: {
            storeName: 'Warung Test',
            storeAddress: 'Jl. Lama No. 1',
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    mitraAccessToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });

    const fsUser = await prisma.user.create({
      data: {
        email: 'saver@test.com',
        name: 'Food Saver',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });
    foodSaverAccessToken = signAccessToken({ userId: fsUser.id, email: fsUser.email });
  });

  it('should update location with lat/lng directly', async () => {
    const res = await request(app)
      .patch('/mitra/me/location')
      .set('Authorization', `Bearer ${mitraAccessToken}`)
      .send({ lat: -6.2088, lng: 106.8456 });

    expect(res.status).toBe(200);
    expect(res.body.profile.storeLat).toBe(-6.2088);
    expect(res.body.profile.storeLng).toBe(106.8456);
  });

  it('should geocode address and update location', async () => {
    const res = await request(app)
      .patch('/mitra/me/location')
      .set('Authorization', `Bearer ${mitraAccessToken}`)
      .send({ address: 'Jl. Sudirman, Jakarta' });

    expect(res.status).toBe(200);
    expect(res.body.profile.storeLat).toBe(-6.2088);
    expect(res.body.profile.storeLng).toBe(106.8456);
    expect(res.body.profile.storeAddress).toBe('Jl. Sudirman, Jakarta');
  });

  it('should return 400 when neither address nor lat/lng provided', async () => {
    const res = await request(app)
      .patch('/mitra/me/location')
      .set('Authorization', `Bearer ${mitraAccessToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for non-mitra user', async () => {
    const res = await request(app)
      .patch('/mitra/me/location')
      .set('Authorization', `Bearer ${foodSaverAccessToken}`)
      .send({ lat: -6.2088, lng: 106.8456 });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('MITRA_NOT_FOUND');
  });

  it('should return 401 without auth', async () => {
    const res = await request(app)
      .patch('/mitra/me/location')
      .send({ lat: -6.2088, lng: 106.8456 });
    expect(res.status).toBe(401);
  });
});
