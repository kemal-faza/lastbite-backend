import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { createAdminUser } from './setup.js';
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
});
