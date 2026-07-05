import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { toUserResponse } from '../lib/userResponse.js';
import type { UserResponse } from '../types/index.js';

export class UserNotFoundError extends Error {
  constructor() {
    super('Pengguna tidak ditemukan');
    this.name = 'UserNotFoundError';
  }
}

export async function getProfile(userId: string): Promise<UserResponse> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UserNotFoundError();
  }
  return toUserResponse(user);
}

export async function updateProfile(
  userId: string,
  data: { name?: string; phone?: string }
): Promise<UserResponse> {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
    });
    return toUserResponse(user);
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new UserNotFoundError();
    }
    throw err;
  }
}
