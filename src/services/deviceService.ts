import { prisma } from '../lib/prisma.js';

const VALID_PLATFORMS = ['web', 'ios', 'android'] as const;

export class DeviceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DeviceError';
  }
}

export async function registerDevice(userId: string, token: string, platform = 'web') {
  if (!VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
    throw new DeviceError(
      `Platform tidak valid. Gunakan: ${VALID_PLATFORMS.join(', ')}`,
      'INVALID_PLATFORM'
    );
  }

  return prisma.deviceToken.upsert({
    where: { userId_token: { userId, token } },
    update: { platform, updatedAt: new Date() },
    create: { userId, token, platform },
  });
}
