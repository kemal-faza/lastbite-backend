import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { createAdminUser, createFoodSaverUser } from './setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { badUuids } from '../support/edgeCases.js';
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

  // ── Edge cases ──────────────────────────────────────────────────

  it('should reject FOOD_SAVER trying to access admin users', async () => {
    const fsUser = await createFoodSaverUser();
    const fsToken = signAccessToken({ userId: fsUser.id, email: fsUser.email });

    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${fsToken}`);
    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent user detail', async () => {
    const res = await request(app)
      .get('/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('should return 400 for malformed UUID in user detail', async () => {
    const res = await request(app)
      .get('/admin/users/not-a-uuid')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('should handle pagination parameters', async () => {
    const res = await request(app)
      .get('/admin/users?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeLessThanOrEqual(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
  });

  it('should reject deleting non-existent user', async () => {
    const res = await request(app)
      .delete('/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
