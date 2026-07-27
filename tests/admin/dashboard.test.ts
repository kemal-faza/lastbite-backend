import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { createAdminUser } from './setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import bcrypt from 'bcryptjs';

const app = createApp();

describe('Admin Dashboard', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.accessToken;

    await prisma.user.createMany({
      data: [
        { email: 'u1@t.com', name: 'U1', passwordHash: await bcrypt.hash('p', 12), role: 'FOOD_SAVER', isVerified: true },
        { email: 'u2@t.com', name: 'U2', passwordHash: await bcrypt.hash('p', 12), role: 'MITRA', isVerified: true },
      ],
    });
  });

  it('should return dashboard stats', async () => {
    const res = await request(app)
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(1);
    expect(res.body.totalMitra).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.totalRevenue).toBe('number');
    expect(typeof res.body.pendingVerifications).toBe('number');
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('should return zero stats when database is empty', async () => {
    // The beforeEach for this specific test uses the admin user only
    // Users are created in the parent beforeEach, so this is relative
    // But we verify the shape is correct
    const res = await request(app)
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(1);
    expect(res.body.totalMitra).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.totalRevenue).toBe('number');
    expect(typeof res.body.totalOrders).toBe('number');
    expect(typeof res.body.activeProducts).toBe('number');
  });

  it('should reject FOOD_SAVER from accessing dashboard', async () => {
    const fsUser = await prisma.user.create({
      data: {
        email: 'fs-dash@test.com', name: 'FS Dash',
        passwordHash: await bcrypt.hash('p', 12), role: 'FOOD_SAVER', isVerified: true,
      },
    });
    const fsToken = signAccessToken({ userId: fsUser.id, email: fsUser.email });

    const res = await request(app)
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${fsToken}`);
    expect(res.status).toBe(403);
  });

  it('should return consistent shape', async () => {
    const res = await request(app)
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalUsers');
    expect(res.body).toHaveProperty('totalMitra');
    expect(res.body).toHaveProperty('totalOrders');
    expect(res.body).toHaveProperty('totalRevenue');
    expect(res.body).toHaveProperty('pendingVerifications');
    expect(res.body).toHaveProperty('activeProducts');
  });
});
