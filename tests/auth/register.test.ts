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
    // OTP is stored hashed (bcrypt) — never as plaintext.
    expect(dbUser!.verificationCode!.startsWith('$2')).toBe(true);
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

  it('should return 400 for missing email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Test', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for missing name', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'missing-name@example.com', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for missing password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'missing-pw@example.com', name: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should detect case-insensitive duplicate email', async () => {
    await request(app).post('/auth/register').send({
      email: 'case-demo@example.com',
      name: 'First',
      password: 'password123',
    });

    const res = await request(app).post('/auth/register').send({
      email: 'Case-Demo@Example.com',
      name: 'Second',
      password: 'password123',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('should accept name at maximum length (100 chars)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'longname@example.com',
        name: 'A'.repeat(100),
        password: 'password123',
      });
    expect(res.status).toBe(201);
  });

  it('should reject name over 100 characters', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'toolongname@example.com',
        name: 'A'.repeat(101),
        password: 'password123',
      });
    expect(res.status).toBe(400);
  });

  it('should accept password at minimum length (8 chars)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'shortpw@example.com',
        name: 'Test',
        password: 'aB3$eX9!',
      });
    expect(res.status).toBe(201);
  });

  it('should reject password over 128 characters', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'over128pw@example.com',
        name: 'Test',
        password: 'A'.repeat(129),
      });
    expect(res.status).toBe(400);
  });
});
