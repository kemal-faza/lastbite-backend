import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createAdminUser } from './setup.js';
import { prisma } from '../setup.js';

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
});
