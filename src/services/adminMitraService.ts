import { prisma } from '../lib/prisma.js';
import type { VerificationStatus } from '@prisma/client';

export interface ListMitraVerificationsInput {
  status?: VerificationStatus;
  page?: number;
  limit?: number;
}

export async function listMitraVerifications(input: ListMitraVerificationsInput = {}) {
  const { status, page = 1, limit = 20 } = input;
  const where = status ? { verificationStatus: status } : {};

  const [profiles, total] = await Promise.all([
    prisma.mitraProfile.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true, phone: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.mitraProfile.count({ where }),
  ]);

  return {
    profiles: profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      storeName: p.storeName,
      storeDescription: p.storeDescription,
      storeAddress: p.storeAddress,
      storeLat: p.storeLat,
      storeLng: p.storeLng,
      verificationStatus: p.verificationStatus,
      user: {
        email: p.user.email,
        name: p.user.name,
        phone: p.user.phone,
        registeredAt: p.user.createdAt.toISOString(),
      },
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function verifyMitra(profileId: string, status: 'VERIFIED' | 'REJECTED', adminId: string) {
  const profile = await prisma.mitraProfile.update({
    where: { id: profileId },
    data: { verificationStatus: status },
    include: { user: { select: { email: true } } },
  });

  return {
    id: profile.id,
    storeName: profile.storeName,
    verificationStatus: profile.verificationStatus,
    email: profile.user.email,
  };
}
