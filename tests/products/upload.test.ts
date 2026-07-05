import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('POST /uploads', () => {
  let accessToken: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'uploader@test.com',
        name: 'Uploader',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });
    accessToken = signAccessToken({ userId: user.id, email: user.email });
  });

  it('should upload an image and return URL', async () => {
    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('fake-image-data'), 'test.jpg');

    expect(res.status).toBe(201);
    expect(res.body.url).toBeDefined();
    expect(res.body.key).toBeDefined();
  });

  it('should return 401 without auth', async () => {
    const res = await request(app)
      .post('/uploads')
      .attach('file', Buffer.from('fake-image-data'), 'test.jpg');

    expect(res.status).toBe(401);
  });

  it('should return 400 when no file provided', async () => {
    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_REQUIRED');
  });
});
