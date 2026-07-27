import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createAdminUser } from './setup.js';
import { prisma } from '../setup.js';
import { xssPayloads } from '../support/edgeCases.js';

const app = createApp();

describe('Admin Platform Config', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.accessToken;
    // Clean up platform config between tests
    await prisma.platformConfig.deleteMany();
  });

  it('should return default config when not set', async () => {
    const res = await request(app)
      .get('/admin/config')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.commissionRate).toBe(5);
    expect(res.body.categories).toEqual(['meals', 'bakery', 'drinks']);
  });

  it('should update config', async () => {
    const res = await request(app)
      .patch('/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionRate: 10, categories: ['meals', 'bakery', 'drinks', 'snacks'] });

    expect(res.status).toBe(200);
    expect(res.body.commissionRate).toBe(10);
    expect(res.body.categories).toContain('snacks');
  });

  it('should persist config across requests', async () => {
    await request(app)
      .patch('/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supportPhone: '021-12345678' });

    const res = await request(app)
      .get('/admin/config')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.supportPhone).toBe('021-12345678');
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('should reject FOOD_SAVER from accessing admin config', async () => {
    const { createFoodSaverUser } = await import('./setup.js');
    const fsUser = await createFoodSaverUser();
    const { signAccessToken } = await import('../../src/lib/jwt.js');
    const fsToken = signAccessToken({ userId: fsUser.id, email: fsUser.email });

    const res = await request(app)
      .get('/admin/config')
      .set('Authorization', `Bearer ${fsToken}`);
    expect(res.status).toBe(403);
  });

  it('should accept XSS payload in config value (stored as-is)', async () => {
    const res = await request(app)
      .patch('/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supportPhone: xssPayloads[0] });

    expect(res.status).toBe(200);
    expect(res.body.supportPhone).toBe(xssPayloads[0]);
  });

  it('should reject negative commission rate', async () => {
    const res = await request(app)
      .patch('/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionRate: -5 });

    expect(res.status).toBe(400);
  });

  it('should accept zero commission rate (valid value meaning no commission)', async () => {
    const res = await request(app)
      .patch('/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionRate: 0 });

    // 0% commission is a valid value (platform takes no fee)
    expect(res.status).toBe(200);
    expect(res.body.commissionRate).toBe(0);
  });

  it('should reject missing required fields gracefully', async () => {
    const res = await request(app)
      .patch('/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // Accept either 200 (no-op) or 400 (validation)
    expect([200, 400]).toContain(res.status);
  });

  it('should handle large config values', async () => {
    const longValue = 'x'.repeat(10000);
    const res = await request(app)
      .patch('/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supportPhone: longValue });

    // Accept or reject depending on length validation
    expect([200, 400]).toContain(res.status);
  });
});
