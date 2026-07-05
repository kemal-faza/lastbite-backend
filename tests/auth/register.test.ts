import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';

const app = createApp();

describe('POST /auth/register', () => {
  it('should register a new user and return 201', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: 'test@example.com',
      name: 'Test User',
      isVerified: false,
    });
    expect(res.body.user.id).toBeDefined();
    expect(res.body.message).toContain('verifikasi');

    const dbUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.verificationCode).toBeDefined();
    expect(dbUser!.verificationCode!.length).toBe(6);
  });

  it('should return 400 for invalid email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'not-an-email',
        name: 'Test',
        password: 'password123',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 409 for duplicate email', async () => {
    await request(app).post('/auth/register').send({
      email: 'dup@example.com',
      name: 'First',
      password: 'password123',
    });

    const res = await request(app).post('/auth/register').send({
      email: 'dup@example.com',
      name: 'Second',
      password: 'password123',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('should return 400 when name is empty', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        name: '',
        password: 'password123',
      });

    expect(res.status).toBe(400);
  });

  it('should return 400 when password is less than 8 characters', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        name: 'Test',
        password: 'short',
      });

    expect(res.status).toBe(400);
  });
});
