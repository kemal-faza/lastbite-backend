import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { hashPassword } from '../../src/lib/password.js';

const app = createApp();

describe('POST /auth/login', () => {
  beforeEach(async () => {
    const pwHash = await hashPassword('password123');
    await prisma.user.createMany({
      data: [
        {
          email: 'verified@example.com',
          name: 'Verified User',
          passwordHash: pwHash,
          isVerified: true,
        },
        {
          email: 'unverified@example.com',
          name: 'Unverified User',
          passwordHash: pwHash,
          isVerified: false,
        },
      ],
    });
  });

  it('should login verified user and return tokens', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'verified@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('verified@example.com');
    expect(res.body.user.isVerified).toBe(true);
  });

  it('should return 401 for wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'verified@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'unknown@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('should return 403 for unverified account', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'unverified@example.com', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_NOT_VERIFIED');
  });
});

describe('POST /auth/refresh', () => {
  beforeEach(async () => {
    await prisma.user.create({
      data: {
        email: 'verified@example.com',
        name: 'Verified User',
        passwordHash: await hashPassword('password123'),
        isVerified: true,
      },
    });
  });

  it('should return new tokens with valid refresh token', async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'verified@example.com', password: 'password123' });

    const refreshToken = loginRes.body.tokens.refreshToken;

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.accessToken).not.toBe(loginRes.body.tokens.accessToken);
  });

  it('should return 401 for invalid refresh token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid-token' });

    expect(res.status).toBe(401);
  });
});
