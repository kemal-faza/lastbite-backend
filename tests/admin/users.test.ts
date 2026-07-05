import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { createAdminUser } from './setup.js';
import bcrypt from 'bcryptjs';

const app = createApp();

describe('Admin User Management', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.accessToken;

    await prisma.user.createMany({
      data: [
        { email: 'user1@test.com', name: 'User Satu', passwordHash: await bcrypt.hash('pass', 12), role: 'FOOD_SAVER', isVerified: true },
        { email: 'user2@test.com', name: 'User Dua', passwordHash: await bcrypt.hash('pass', 12), role: 'FOOD_SAVER', isVerified: false },
        { email: 'mitra1@test.com', name: 'Mitra Satu', passwordHash: await bcrypt.hash('pass', 12), role: 'MITRA', isVerified: true },
      ],
    });
  });

  it('should list all users', async () => {
    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.users).toBeInstanceOf(Array);
  });

  it('should filter users by role', async () => {
    const res = await request(app)
      .get('/admin/users?role=MITRA')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users.every((u: { role: string }) => u.role === 'MITRA')).toBe(true);
  });

  it('should search users by email', async () => {
    const res = await request(app)
      .get('/admin/users?search=user1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.users[0].email).toBe('user1@test.com');
  });

  it('should update a user', async () => {
    const user = await prisma.user.findFirst({ where: { role: 'FOOD_SAVER' } });

    const res = await request(app)
      .patch(`/admin/users/${user!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nama Baru' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Nama Baru');
  });
});
