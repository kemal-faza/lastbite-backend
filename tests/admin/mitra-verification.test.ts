import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { createAdminUser } from './setup.js';

const app = createApp();

describe('Admin Mitra Verification', () => {
  let adminToken: string;
  let mitraProfileId: string;

  beforeEach(async () => {
    const admin = await createAdminUser();
    adminToken = admin.accessToken;

    // Create a user with mitra profile in PENDING status
    const user = await prisma.user.create({
      data: {
        email: 'new-mitra@test.com',
        name: 'New Mitra',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
      },
    });

    const profile = await prisma.mitraProfile.create({
      data: {
        userId: user.id,
        storeName: 'Toko Baru',
        storeAddress: 'Jl. Baru No 1',
        verificationStatus: 'PENDING',
      },
    });
    mitraProfileId = profile.id;
  });

  it('should list PENDING mitra verifications', async () => {
    const res = await request(app)
      .get('/admin/mitra-verifications?status=PENDING')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.profiles[0].storeName).toBe('Toko Baru');
    expect(res.body.profiles[0].verificationStatus).toBe('PENDING');
  });

  it('should approve a mitra verification', async () => {
    const res = await request(app)
      .patch(`/admin/mitra-verifications/${mitraProfileId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'VERIFIED' });

    expect(res.status).toBe(200);
    expect(res.body.verificationStatus).toBe('VERIFIED');

    // Verify DB was updated
    const profile = await prisma.mitraProfile.findUnique({ where: { id: mitraProfileId } });
    expect(profile!.verificationStatus).toBe('VERIFIED');

    // Verify audit log was created
    const auditLogs = await prisma.auditLog.findMany({
      where: { entity: 'mitra_profile', entityId: mitraProfileId },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('mitra.verify.approve');
  });

  it('should reject a mitra verification', async () => {
    const res = await request(app)
      .patch(`/admin/mitra-verifications/${mitraProfileId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED' });

    expect(res.status).toBe(200);
    expect(res.body.verificationStatus).toBe('REJECTED');
  });
});
