import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { hashPassword } from '../../src/lib/password.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('GET /users/me', () => {
  let accessToken: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'profile@example.com',
        name: 'Profile User',
        passwordHash: await hashPassword('password123'),
        isVerified: true,
      },
    });
    accessToken = signAccessToken({ userId: user.id, email: user.email });
  });

  it('should return user profile with valid token', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('profile@example.com');
    expect(res.body.user.name).toBe('Profile User');
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /users/me', () => {
  let accessToken: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'edit@example.com',
        name: 'Edit User',
        passwordHash: await hashPassword('password123'),
        isVerified: true,
      },
    });
    accessToken = signAccessToken({ userId: user.id, email: user.email });
  });

  it('should update user name', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Updated Name');
  });

  it('should update user phone', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phone: '08123456789' });

    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe('08123456789');
  });

  it('should return 400 for too short phone', async () => {
    const res = await request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phone: '123' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without token', async () => {
    const res = await request(app)
      .patch('/users/me')
      .send({ name: 'No Auth' });
    expect(res.status).toBe(401);
  });
});
