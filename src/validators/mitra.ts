import { z } from 'zod';

export const registerMitraSchema = z.object({
  storeName: z.string().trim().min(1, 'Nama toko wajib diisi').max(200, 'Nama toko maksimal 200 karakter'),
  storeDescription: z.string().max(1000, 'Deskripsi maksimal 1000 karakter').optional(),
  storeAddress: z.string().max(500, 'Alamat maksimal 500 karakter').optional(),
  storeLat: z.number().min(-90).max(90).optional().nullable(),
  storeLng: z.number().min(-180).max(180).optional().nullable(),
});

export const updateMitraProfileSchema = z.object({
  storeName: z.string().trim().min(1).max(200).optional(),
  storeDescription: z.string().max(1000).optional().nullable(),
  storeAddress: z.string().max(500).optional().nullable(),
  storeLat: z.number().min(-90).max(90).optional().nullable(),
  storeLng: z.number().min(-180).max(180).optional().nullable(),
});

export const locationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address: z.string().min(1).max(500).optional(),
}).refine(
  (data) => data.lat !== undefined || data.lng !== undefined || data.address !== undefined,
  { message: 'Berikan lat/lng atau address (alamat) untuk geocoding' }
);

export const updateMitraProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.enum(['meals', 'bakery', 'drinks']).optional(),
  originalPrice: z.number().int().positive().optional(),
  discountedPrice: z.number().int().positive().optional(),
  stock: z.number().int().min(0).optional(),
  imageUrl: z.string().min(1).optional().nullable(),
  imageVariants: z
    .object({
      thumb: z.string(),
      card: z.string(),
      full: z.string(),
    })
    .optional()
    .nullable(),
  storeName: z.string().min(1).max(200).optional(),
  storeAddress: z.string().max(500).optional().nullable(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PROCESSED', 'READY', 'PICKED_UP', 'CANCELLED'], {
    errorMap: () => ({ message: 'Status tidak valid' }),
  }),
});
