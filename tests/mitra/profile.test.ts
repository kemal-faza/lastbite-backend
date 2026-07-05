import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('Mitra Profile API', () => {
  let mitraAccessToken: string;
  let mitraUserId: string;
  let foodSaverAccessToken: string;

  beforeEach(async () => {
    // Create mitra user with profile
    const mitraUser = await prisma.user.create({
      data: {
        email: 'mitra-pro@example.com',
        name: 'Mitra Pro',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
        mitraProfile: {
          create: {
            storeName: 'Roti Enak',
            storeAddress: 'Jl. Kenanga No. 1',
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    mitraUserId = mitraUser.id;
    mitraAccessToken = signAccessToken({ userId: mitraUser.id, email: mitraUser.email });

    // Create food saver user (no mitra profile)
    const fsUser = await prisma.user.create({
      data: {
        email: 'food-saver@example.com',
        name: 'Food Saver',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });
    foodSaverAccessToken = signAccessToken({ userId: fsUser.id, email: fsUser.email });
  });

  describe('GET /mitra/me', () => {
    it('should return mitra profile', async () => {
      const res = await request(app)
        .get('/mitra/me')
        .set('Authorization', `Bearer ${mitraAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.profile.storeName).toBe('Roti Enak');
      expect(res.body.profile.storeAddress).toBe('Jl. Kenanga No. 1');
      expect(res.body.profile.verificationStatus).toBe('VERIFIED');
    });

    it('should return 404 for non-mitra user', async () => {
      const res = await request(app)
        .get('/mitra/me')
        .set('Authorization', `Bearer ${foodSaverAccessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('MITRA_NOT_FOUND');
    });
  });

  describe('PATCH /mitra/me', () => {
    it('should update mitra profile', async () => {
      const res = await request(app)
        .patch('/mitra/me')
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ storeName: 'Roti Enak Banget', storeAddress: 'Jl. Mawar No. 5' });

      expect(res.status).toBe(200);
      expect(res.body.profile.storeName).toBe('Roti Enak Banget');
      expect(res.body.profile.storeAddress).toBe('Jl. Mawar No. 5');
    });

    it('should partial update', async () => {
      const res = await request(app)
        .patch('/mitra/me')
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ storeName: 'Roti Super' });

      expect(res.status).toBe(200);
      expect(res.body.profile.storeName).toBe('Roti Super');
      expect(res.body.profile.storeAddress).toBe('Jl. Kenanga No. 1'); // unchanged
    });

    it('should return 404 for non-mitra user', async () => {
      const res = await request(app)
        .patch('/mitra/me')
        .set('Authorization', `Bearer ${foodSaverAccessToken}`)
        .send({ storeName: 'Hacked!' });

      expect(res.status).toBe(404);
    });
  });
});
