import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { MitraProfileResponse } from '../types/index.js';
import { geocodeAddress, GeocodingError } from './geocodingService.js';

export class MitraError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MitraError';
  }
}

function toMitraProfileResponse(p: {
  id: string;
  userId: string;
  storeName: string;
  storeDescription: string | null;
  storeAddress: string | null;
  storeLat: number | null;
  storeLng: number | null;
  verificationStatus: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): MitraProfileResponse {
  const toISO = (v: Date | string) => v instanceof Date ? v.toISOString() : v;
  return {
    id: p.id,
    userId: p.userId,
    storeName: p.storeName,
    storeDescription: p.storeDescription,
    storeAddress: p.storeAddress,
    storeLat: p.storeLat,
    storeLng: p.storeLng,
    verificationStatus: p.verificationStatus as 'PENDING' | 'VERIFIED' | 'REJECTED',
    createdAt: toISO(p.createdAt),
    updatedAt: toISO(p.updatedAt),
  };
}

export async function registerMitra(
  userId: string,
  input: {
    storeName: string;
    storeDescription?: string;
    storeAddress?: string;
    storeLat?: number | null;
    storeLng?: number | null;
  }
): Promise<MitraProfileResponse> {
  // Note: no separate findUnique check here -- TOCTOU race avoided by catching P2002
  try {
    const [profile] = await prisma.$transaction([
      prisma.mitraProfile.create({
        data: {
          userId,
          storeName: input.storeName,
          storeDescription: input.storeDescription ?? null,
          storeAddress: input.storeAddress ?? null,
          storeLat: input.storeLat ?? null,
          storeLng: input.storeLng ?? null,
          verificationStatus: 'PENDING', // Admin verifies in M9
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { role: 'MITRA' },
      }),
    ]);

    return toMitraProfileResponse(profile);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new MitraError('Anda sudah terdaftar sebagai Mitra', 'ALREADY_MITRA');
    }
    throw err;
  }
}

export async function getMitraProfile(userId: string): Promise<MitraProfileResponse> {
  const profile = await prisma.mitraProfile.findUnique({ where: { userId } });
  if (profile) {
    return toMitraProfileResponse(profile);
  }

  // Profile tidak ditemukan — cek apakah user masih punya role MITRA
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === 'MITRA') {
    // Self-heal: auto-create minimal profile agar user tidak stuck di "Daftar Mitra"
    const firstProduct = await prisma.product.findFirst({
      where: { mitraId: userId },
      select: { storeName: true },
      orderBy: { createdAt: 'desc' },
    });

    const newProfile = await prisma.mitraProfile.create({
      data: {
        userId,
        storeName: firstProduct?.storeName ?? 'Mitra LastBite',
        storeDescription: null,
        storeAddress: null,
        storeLat: null,
        storeLng: null,
        verificationStatus: 'VERIFIED',
      },
    });

    console.warn(`[MITRA-SELF-HEAL] Auto-created profile for user ${userId} (role=MITRA, profile missing)`);
    return toMitraProfileResponse(newProfile);
  }

  throw new MitraError('Profil mitra tidak ditemukan', 'MITRA_NOT_FOUND');
}

export async function updateMitraProfile(
  userId: string,
  input: {
    storeName?: string;
    storeDescription?: string | null;
    storeAddress?: string | null;
    storeLat?: number | null;
    storeLng?: number | null;
  }
): Promise<MitraProfileResponse> {
  try {
    const profile = await prisma.mitraProfile.update({
      where: { userId },
      data: {
        ...(input.storeName !== undefined && { storeName: input.storeName }),
        ...(input.storeDescription !== undefined && { storeDescription: input.storeDescription }),
        ...(input.storeAddress !== undefined && { storeAddress: input.storeAddress }),
        ...(input.storeLat !== undefined && { storeLat: input.storeLat }),
        ...(input.storeLng !== undefined && { storeLng: input.storeLng }),
      },
    });

    return toMitraProfileResponse(profile);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new MitraError('Profil mitra tidak ditemukan', 'MITRA_NOT_FOUND');
    }
    throw err;
  }
}

export async function updateMitraLocation(
  userId: string,
  input: {
    lat?: number;
    lng?: number;
    address?: string;
  }
): Promise<MitraProfileResponse> {
  const existing = await prisma.mitraProfile.findUnique({ where: { userId } });
  if (!existing) {
    throw new MitraError('Profil mitra tidak ditemukan', 'MITRA_NOT_FOUND');
  }

  let lat = input.lat ?? existing.storeLat;
  let lng = input.lng ?? existing.storeLng;
  let address = input.address ?? existing.storeAddress;

  if (input.address && input.lat === undefined && input.lng === undefined) {
    try {
      const geoResult = await geocodeAddress(input.address);
      lat = geoResult.lat;
      lng = geoResult.lng;
      address = geoResult.formattedAddress;
    } catch (err) {
      if (err instanceof GeocodingError) {
        throw new MitraError(err.message, 'GEOCODING_FAILED');
      }
      throw err;
    }
  }

  const profile = await prisma.mitraProfile.update({
    where: { userId },
    data: {
      storeLat: lat ?? null,
      storeLng: lng ?? null,
      storeAddress: address ?? null,
    },
  });

  return toMitraProfileResponse(profile);
}
