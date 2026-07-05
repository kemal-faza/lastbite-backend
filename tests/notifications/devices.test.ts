import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('POST /devices', () => {
  let accessToken: string;
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `device-test-${Date.now()}@test.com`,
        name: 'Device Tester',
        passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHlbDqsOeABC123XYZ4567890abcdefghij',
        isVerified: true,
      },
    });
    userId = user.id;
    accessToken = signAccessToken({ userId: user.id, email: user.email });
  });

  it('should register a new device token', async () => {
    const res = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: 'fcm-token-abc123', platform: 'web' });

    expect(res.status).toBe(201);
    expect(res.body.device.token).toBe('fcm-token-abc123');
    expect(res.body.device.platform).toBe('web');
    expect(res.body.device.userId).toBe(userId);
  });

  it('should re-register same token idempotently (upsert)', async () => {
    await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: 'fcm-token-abc123' });

    const res = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: 'fcm-token-abc123' });

    expect(res.status).toBe(200);
    expect(res.body.device.token).toBe('fcm-token-abc123');
  });

  it('should require authentication', async () => {
    const res = await request(app).post('/devices').send({ token: 'test' });
    expect(res.status).toBe(401);
  });

  it('should reject missing token', async () => {
    const res = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ platform: 'web' });
    expect(res.status).toBe(400);
  });

  it('should reject invalid platform', async () => {
    const res = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: 'fcm-test', platform: 'invalid' });
    expect(res.status).toBe(400);
  });
});
