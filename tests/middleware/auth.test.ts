import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import bcrypt from 'bcryptjs';

const app = createApp();

// Pre-compute the expensive bcrypt hash once
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await bcrypt.hash('password', 12);
});

interface TestUser {
  userId: string;
  email: string;
  accessTokenWithRole: string;
  accessTokenNoRole: string;
}

let adminUser: TestUser;
let mitraUser: TestUser;
let foodSaverUser: TestUser;

beforeEach(async () => {
  // Create fresh users for each test (global beforeEach wipes the DB)
  const admin = await prisma.user.create({
    data: { email: `admin-mw-${Date.now()}@test.com`, name: 'Admin MW', passwordHash, role: 'ADMIN', isVerified: true },
  });
  adminUser = {
    userId: admin.id,
    email: admin.email,
    accessTokenWithRole: signAccessToken({ userId: admin.id, email: admin.email, role: 'ADMIN' }),
    accessTokenNoRole: signAccessToken({ userId: admin.id, email: admin.email }),
  };

  const mitra = await prisma.user.create({
    data: { email: `mitra-mw-${Date.now()}@test.com`, name: 'Mitra MW', passwordHash, role: 'MITRA', isVerified: true },
  });
  await prisma.mitraProfile.create({
    data: { userId: mitra.id, storeName: 'MW Store', verificationStatus: 'VERIFIED' },
  });
  mitraUser = {
    userId: mitra.id,
    email: mitra.email,
    accessTokenWithRole: signAccessToken({ userId: mitra.id, email: mitra.email, role: 'MITRA' }),
    accessTokenNoRole: signAccessToken({ userId: mitra.id, email: mitra.email }),
  };

  const saver = await prisma.user.create({
    data: { email: `saver-mw-${Date.now()}@test.com`, name: 'Saver MW', passwordHash, role: 'FOOD_SAVER', isVerified: true },
  });
  foodSaverUser = {
    userId: saver.id,
    email: saver.email,
    accessTokenWithRole: signAccessToken({ userId: saver.id, email: saver.email, role: 'FOOD_SAVER' }),
    accessTokenNoRole: signAccessToken({ userId: saver.id, email: saver.email }),
  };
});

// ── requireAuth ──────────────────────────────────────────────

describe('requireAuth middleware', () => {
  it('should return 401 when no Authorization header', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 for invalid Bearer token', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('should return 401 for empty Bearer token', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('should return 200 for valid token', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${foodSaverUser.accessTokenWithRole}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(foodSaverUser.email);
  });
});

// ── requireMitra ──────────────────────────────────────────────

describe('requireMitra middleware', () => {
  it('should return 401 when no auth', async () => {
    const res = await request(app).get('/mitra/me');
    expect(res.status).toBe(401);
  });

  it('should return 403 for FOOD_SAVER token with role claim (fast path)', async () => {
    const res = await request(app)
      .get('/mitra/products')
      .set('Authorization', `Bearer ${foodSaverUser.accessTokenWithRole}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 403 for FOOD_SAVER token without role claim (DB fallback path)', async () => {
    const res = await request(app)
      .get('/mitra/products')
      .set('Authorization', `Bearer ${foodSaverUser.accessTokenNoRole}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 200 for MITRA token with role claim (fast path)', async () => {
    const res = await request(app)
      .get('/mitra/stats')
      .set('Authorization', `Bearer ${mitraUser.accessTokenWithRole}`);
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
  });

  it('should return 200 for MITRA token without role claim (DB fallback path)', async () => {
    const res = await request(app)
      .get('/mitra/stats')
      .set('Authorization', `Bearer ${mitraUser.accessTokenNoRole}`);
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
  });
});

// ── requireAdmin ──────────────────────────────────────────────

describe('requireAdmin middleware', () => {
  it('should return 401 when no auth', async () => {
    const res = await request(app).get('/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('should return 403 for FOOD_SAVER token with role claim (fast path)', async () => {
    const res = await request(app)
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${foodSaverUser.accessTokenWithRole}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 403 for MITRA token with role claim (fast path)', async () => {
    const res = await request(app)
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${mitraUser.accessTokenWithRole}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 200 for ADMIN token with role claim (fast path)', async () => {
    const res = await request(app)
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${adminUser.accessTokenWithRole}`);
    expect(res.status).toBe(200);
  });

  it('should return 200 for ADMIN token without role claim (DB fallback path)', async () => {
    const res = await request(app)
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${adminUser.accessTokenNoRole}`);
    expect(res.status).toBe(200);
  });
});
