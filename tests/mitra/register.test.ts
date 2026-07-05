import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('POST /mitra/register', () => {
  let accessToken: string;
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'mitra-test@example.com',
        name: 'Mitra Tester',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });
    userId = user.id;
    accessToken = signAccessToken({ userId: user.id, email: user.email });
  });

  it('should register user as mitra', async () => {
    const res = await request(app)
      .post('/mitra/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        storeName: 'Roti Ibu Tutik',
        storeAddress: 'Jl. Melati No. 8',
        storeDescription: 'Roti homemade fresh setiap hari',
      });

    expect(res.status).toBe(201);
    expect(res.body.profile).toBeDefined();
    expect(res.body.profile.storeName).toBe('Roti Ibu Tutik');
    expect(res.body.profile.storeAddress).toBe('Jl. Melati No. 8');
    expect(res.body.profile.storeDescription).toBe('Roti homemade fresh setiap hari');
    expect(res.body.profile.verificationStatus).toBe('PENDING');
  });

  it('should update user role to MITRA', async () => {
    await request(app)
      .post('/mitra/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ storeName: 'Test Store' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user!.role).toBe('MITRA');
  });

  it('should reject duplicate registration', async () => {
    await request(app)
      .post('/mitra/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ storeName: 'Store A' });

    const res = await request(app)
      .post('/mitra/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ storeName: 'Store B' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ALREADY_MITRA');
  });

  it('should reject empty store name', async () => {
    const res = await request(app)
      .post('/mitra/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ storeName: ' ' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should reject without auth', async () => {
    const res = await request(app)
      .post('/mitra/register')
      .send({ storeName: 'Test' });

    expect(res.status).toBe(401);
  });
});
