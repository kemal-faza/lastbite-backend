import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export interface CreateAuditLogInput {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export async function createAuditLog(input: CreateAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      details: input.details as Prisma.InputJsonValue | undefined,
    },
  });
}

export interface ListAuditLogsInput {
  actorId?: string;
  entity?: string;
  page?: number;
  limit?: number;
}

export async function listAuditLogs(input: ListAuditLogsInput = {}) {
  const { actorId, entity, page = 1, limit = 50 } = input;
  const where: Prisma.AuditLogWhereInput = {};
  if (actorId) where.actorId = actorId;
  if (entity) where.entity = entity;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      details: log.details as Record<string, unknown> | null,
      createdAt: log.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
