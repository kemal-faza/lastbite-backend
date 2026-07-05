import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createAdminUser, createFoodSaverUser } from './setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('Admin Auth Middleware', () => {
  describe('requireAdmin', () => {
    it('should reject non-admin users (expect 403)', async () => {
      const user = await createFoodSaverUser();
      const token = signAccessToken({ userId: user.id, email: user.email });
      const res = await request(app)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should reject MITRA from admin routes (expect 403)', async () => {
      const mitra = await createFoodSaverUser('mitra@test.com');
      const token = signAccessToken({ userId: mitra.id, email: mitra.email });
      const res = await request(app)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should allow ADMIN user to access admin routes (expect 200)', async () => {
      const admin = await createAdminUser();
      const res = await request(app)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect(res.status).toBe(200);
    });
  });
});
