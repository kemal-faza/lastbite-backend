import { prisma } from '../lib/prisma.js';
import type { Prisma, UserRole } from '@prisma/client';

export interface ListUsersInput {
  role?: UserRole;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listUsers(input: ListUsersInput = {}) {
  const { role, search, page = 1, limit = 20 } = input;
  const where: Prisma.UserWhereInput = {};

  if (role) where.role = role;
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { orders: true, products: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      isVerified: u.isVerified,
      orderCount: u._count.orders,
      productCount: u._count.products,
      createdAt: u.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      mitraProfile: {
        select: { id: true, storeName: true, verificationStatus: true },
      },
      _count: { select: { orders: true, products: true } },
    },
  });

  return {
    ...user,
    mitraProfile: user.mitraProfile,
    orderCount: user._count.orders,
    productCount: user._count.products,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function updateUser(
  userId: string,
  data: { name?: string; phone?: string; isVerified?: boolean }
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      isVerified: true,
      createdAt: true,
    },
  });

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
  };
}
