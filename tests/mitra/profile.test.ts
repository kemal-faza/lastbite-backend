import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { longString, xssPayloads, unicodeStrings } from '../support/edgeCases.js';

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

    // ── Edge cases ────────────────────────────────────────────────

    it('should not allow FOOD_SAVER to access mitra profile (IDOR)', async () => {
      // FOOD_SAVER tries to access /mitra/me
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

    // ── Edge cases ────────────────────────────────────────────────

    it('should reject store name exceeding 200 chars', async () => {
      const res = await request(app)
        .patch('/mitra/me')
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ storeName: longString(201) });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject store description exceeding 1000 chars', async () => {
      const res = await request(app)
        .patch('/mitra/me')
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ storeDescription: longString(1001) });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should accept XSS in store name (stored as-is)', async () => {
      const res = await request(app)
        .patch('/mitra/me')
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ storeName: xssPayloads[0] });
      expect(res.status).toBe(200);
      expect(res.body.profile.storeName).toBe(xssPayloads[0]);
    });

    it('should accept unicode store name', async () => {
      const res = await request(app)
        .patch('/mitra/me')
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ storeName: unicodeStrings[0] });
      expect(res.status).toBe(200);
      expect(res.body.profile.storeName).toBe(unicodeStrings[0]);
    });

    it('should clear optional nullable fields by sending null', async () => {
      const res = await request(app)
        .patch('/mitra/me')
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ storeDescription: null, storeAddress: null });
      expect(res.status).toBe(200);
      expect(res.body.profile.storeDescription).toBeNull();
      expect(res.body.profile.storeAddress).toBeNull();
    });

    it('should reject invalid lat range', async () => {
      const res = await request(app)
        .patch('/mitra/me')
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ storeLat: 91 });
      expect(res.status).toBe(400);
    });

    it('should reject invalid lng range', async () => {
      const res = await request(app)
        .patch('/mitra/me')
        .set('Authorization', `Bearer ${mitraAccessToken}`)
        .send({ storeLng: 181 });
      expect(res.status).toBe(400);
    });
  });
});
