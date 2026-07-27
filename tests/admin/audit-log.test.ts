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

  // ── Edge cases ──────────────────────────────────────────────────

  it('should return empty list when no audit logs exist', async () => {
    // DB is wiped in beforeEach, so no logs should exist
    const result = await listAuditLogs({ limit: 10 });
    expect(result.total).toBe(0);
    expect(result.logs).toHaveLength(0);
  });

  it('should handle pagination with page=1 limit=1', async () => {
    await createAuditLog({ actorId: adminId, action: 'user.view', entity: 'user' });
    await createAuditLog({ actorId: adminId, action: 'user.edit', entity: 'user' });

    const result = await listAuditLogs({ page: 1, limit: 1 });
    expect(result.total).toBe(2);
    expect(result.logs).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(1);
  });

  it('should handle entityId being undefined gracefully', async () => {
    const log = await createAuditLog({
      actorId: adminId,
      action: 'user.view',
      entity: 'user',
      // entityId intentionally omitted
    });

    expect(log.id).toBeDefined();
    expect(log.entityId).toBeNull();
  });

  it('should handle empty details', async () => {
    const log = await createAuditLog({
      actorId: adminId,
      action: 'user.view',
      entity: 'user',
      entityId: 'u1',
      details: {},
    });

    expect(log.id).toBeDefined();
    expect(log.details).toEqual({});
  });

  it('should create audit log with minimal fields', async () => {
    const log = await createAuditLog({
      actorId: adminId,
      action: 'test.action',
      entity: 'test',
    });

    expect(log.id).toBeDefined();
    expect(log.action).toBe('test.action');
    expect(log.entity).toBe('test');
    expect(log.entityId).toBeNull();
    expect(log.details).toBeNull();
  });
});
