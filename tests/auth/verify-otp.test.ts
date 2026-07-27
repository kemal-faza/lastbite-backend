import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { hashPassword } from '../../src/lib/password.js';

const app = createApp();

describe('POST /auth/verify-otp', () => {
  beforeEach(async () => {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.user.create({
      data: {
        email: 'pending@example.com',
        name: 'Pending User',
        passwordHash: await hashPassword('password123'),
        verificationCode: '123456',
        verificationCodeExpiresAt: expiresAt,
        isVerified: false,
      },
    });
    await prisma.user.create({
      data: {
        email: 'expired@example.com',
        name: 'Expired User',
        passwordHash: await hashPassword('password123'),
        verificationCode: '654321',
        verificationCodeExpiresAt: new Date(Date.now() - 1000),
        isVerified: false,
      },
    });
    await prisma.user.create({
      data: {
        email: 'already-verified@example.com',
        name: 'Verified User',
        passwordHash: await hashPassword('password123'),
        isVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
      },
    });
  });

  it('should verify account with correct code', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'pending@example.com', code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);

    const user = await prisma.user.findUnique({ where: { email: 'pending@example.com' } });
    expect(user!.isVerified).toBe(true);
    expect(user!.verificationCode).toBeNull();
  });

  it('should return 400 for wrong code', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'pending@example.com', code: '999999' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_OTP');
  });

  it('should return 400 for expired code', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'expired@example.com', code: '654321' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_OTP');
  });

  it('should return 404 for non-existent user', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'unknown@example.com', code: '123456' });

    expect(res.status).toBe(404);
  });

  it('should accept already verified user', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'already-verified@example.com', code: '000000' });

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
  });

  it('should return 400 for malformed OTP code (non-numeric)', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'pending@example.com', code: 'abcdef' });
    // Validator: string().length(6) — "abcdef" is length 6, so it passes validation.
    // But the OTP is always numeric, so it should fail verification.
    expect(res.status).toBe(400);
  });

  it('should return 400 for too-short OTP code', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'pending@example.com', code: '123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for too-long OTP code', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'pending@example.com', code: '1234567' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for missing code', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ email: 'pending@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for missing email', async () => {
    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ code: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/resend-otp', () => {
  beforeEach(async () => {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.user.create({
      data: {
        email: 'pending@example.com',
        name: 'Pending User',
        passwordHash: await hashPassword('password123'),
        verificationCode: '123456',
        verificationCodeExpiresAt: expiresAt,
        isVerified: false,
      },
    });
  });

  it('should resend OTP for unverified user', async () => {
    const res = await request(app)
      .post('/auth/resend-otp')
      .send({ email: 'pending@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('dikirim');

    const user = await prisma.user.findUnique({ where: { email: 'pending@example.com' } });
    expect(user!.verificationCode).toBeDefined();
    expect(user!.verificationCode).not.toBe('123456');
  });

  it('should return 404 for non-existent user', async () => {
    const res = await request(app)
      .post('/auth/resend-otp')
      .send({ email: 'unknown@example.com' });

    expect(res.status).toBe(404);
  });

  it('should return 400 for already-verified user resend', async () => {
    await prisma.user.create({
      data: {
        email: 'already-verified-resend@example.com',
        name: 'Verified',
        passwordHash: await hashPassword('password123'),
        isVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
      },
    });

    const res = await request(app)
      .post('/auth/resend-otp')
      .send({ email: 'already-verified-resend@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ALREADY_VERIFIED');
  });
});
