import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { longString, unicodeStrings } from '../support/edgeCases.js';

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

  // ── Edge cases ──────────────────────────────────────────────────

  it('should reject whitespace-only token', async () => {
    const res = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should accept very long FCM token', async () => {
    const longToken = longString(1000);
    const res = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: longToken });
    expect(res.status).toBe(201);
    expect(res.body.device.token).toBe(longToken);
  });

  it('should accept unicode/emoji in token', async () => {
    const res = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: unicodeStrings[0] });
    expect(res.status).toBe(201);
    expect(res.body.device.token).toBe(unicodeStrings[0]);
  });

  it('should upsert token for another user (same token, different user)', async () => {
    // Register token for user A
    await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: 'shared-token' });
    expect(await prisma.deviceToken.count({ where: { token: 'shared-token' } })).toBe(1);

    // Register same token for user B
    const userB = await prisma.user.create({
      data: {
        email: `device-b-${Date.now()}@test.com`,
        name: 'Device B',
        passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHlbDqsOeABC123XYZ4567890abcdefghij',
        isVerified: true,
      },
    });
    const tokenB = signAccessToken({ userId: userB.id, email: userB.email });

    const res = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ token: 'shared-token' });

    // Upsert on unique userId_token → should create a new row
    expect(res.status).toBe(201);
    expect(await prisma.deviceToken.count({ where: { token: 'shared-token' } })).toBe(2);
  });

  it('should reject empty platform string', async () => {
    const res = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ token: 'test-token', platform: '' });
    expect(res.status).toBe(400);
  });
});
