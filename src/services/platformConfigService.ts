import { prisma } from '../lib/prisma.js';

const CONFIG_KEY = 'platform_settings';

const defaultConfig = {
  commissionRate: 5,
  maxPickupHours: 2,
  categories: ['meals', 'bakery', 'drinks'],
  featureFlags: {
    reviewsEnabled: true,
    mapsEnabled: true,
    wishlistEnabled: true,
  },
  supportPhone: '0800-0000-0000',
  termsUrl: 'https://lastbite.id/terms',
};

export interface PlatformConfig {
  commissionRate: number;
  maxPickupHours: number;
  categories: string[];
  featureFlags: Record<string, boolean>;
  supportPhone: string;
  termsUrl: string;
}

export async function getConfig(): Promise<PlatformConfig> {
  const row = await prisma.platformConfig.findUnique({ where: { key: CONFIG_KEY } });
  if (!row) {
    return { ...defaultConfig };
  }
  return row.value as PlatformConfig;
}

export async function updateConfig(
  input: Partial<PlatformConfig>,
  adminId: string
): Promise<PlatformConfig> {
  const current = await getConfig();
  const merged = { ...current, ...input };

  await prisma.platformConfig.upsert({
    where: { key: CONFIG_KEY },
    create: {
      key: CONFIG_KEY,
      value: merged,
      updatedBy: adminId,
    },
    update: {
      value: merged,
      updatedBy: adminId,
    },
  });

  return merged;
}
