import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import bcrypt from 'bcryptjs';

export interface TestAdmin {
  userId: string;
  email: string;
  accessToken: string;
}

export async function createAdminUser(email = 'admin@test.com'): Promise<TestAdmin> {
  const passwordHash = await bcrypt.hash('adminpass123', 12);
  const admin = await prisma.user.create({
    data: {
      email,
      name: 'Admin Test',
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
    },
  });
  return {
    userId: admin.id,
    email: admin.email,
    accessToken: signAccessToken({ userId: admin.id, email: admin.email }),
  };
}

export async function createFoodSaverUser(email = 'user@test.com') {
  const passwordHash = await bcrypt.hash('password', 12);
  return prisma.user.create({
    data: {
      email,
      name: 'Food Saver Test',
      passwordHash,
      role: 'FOOD_SAVER',
      isVerified: true,
    },
  });
}
