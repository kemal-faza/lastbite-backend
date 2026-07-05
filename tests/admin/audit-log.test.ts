import { describe, it, expect, beforeEach } from 'vitest';
import { createAuditLog, listAuditLogs } from '../../src/services/auditLogService.js';
import { prisma } from '../setup.js';
import bcrypt from 'bcryptjs';

describe('AuditLogService', () => {
  let adminId: string;

  beforeEach(async () => {
    const admin = await prisma.user.create({
      data: {
        email: 'audit-test-admin@test.com',
        name: 'Test Admin',
        passwordHash: await bcrypt.hash('pass', 12),
        role: 'ADMIN',
        isVerified: true,
      },
    });
    adminId = admin.id;
  });

  it('should create an audit log entry', async () => {
    const log = await createAuditLog({
      actorId: adminId,
      action: 'mitra.verify',
      entity: 'mitra_profile',
      entityId: 'some-uuid',
      details: { previousStatus: 'PENDING', newStatus: 'VERIFIED' },
    });

    expect(log.id).toBeDefined();
    expect(log.action).toBe('mitra.verify');
    expect(log.entity).toBe('mitra_profile');
    expect(log.entityId).toBe('some-uuid');
    expect(log.details).toEqual({ previousStatus: 'PENDING', newStatus: 'VERIFIED' });
  });

  it('should list audit logs with pagination', async () => {
    await createAuditLog({ actorId: adminId, action: 'user.view', entity: 'user', entityId: 'u1' });
    await createAuditLog({ actorId: adminId, action: 'user.edit', entity: 'user', entityId: 'u2' });
    await createAuditLog({ actorId: adminId, action: 'product.remove', entity: 'product', entityId: 'p1' });

    const result = await listAuditLogs({ limit: 10 });
    expect(result.total).toBe(3);
    expect(result.logs).toHaveLength(3);
  });

  it('should filter audit logs by entity', async () => {
    await createAuditLog({ actorId: adminId, action: 'user.view', entity: 'user' });
    await createAuditLog({ actorId: adminId, action: 'product.remove', entity: 'product' });

    const result = await listAuditLogs({ entity: 'product' });
    expect(result.total).toBe(1);
    expect(result.logs[0].entity).toBe('product');
  });
});
