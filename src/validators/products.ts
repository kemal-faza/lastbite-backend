import { z } from 'zod';

export const productQuerySchema = z.object({
  category: z.enum(['meals', 'bakery', 'drinks']).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'oldest', 'distance_asc', 'stock_asc']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(500).optional(),
  maxPrice: z.coerce.number().int().positive().max(10000000).optional(),
  expiry: z.enum(['Hari Ini', '< 1 Jam', '< 3 Jam', '< 6 Jam']).optional(),
  ids: z.string().optional(),
  search: z.string().optional(),
}).refine(
  (data) => {
    if (data.radius !== undefined && (data.lat === undefined || data.lng === undefined)) {
      return false;
    }
    if ((data.lat !== undefined) !== (data.lng !== undefined)) {
      return false;
    }
    return true;
  },
  { message: 'lat dan lng harus disertakan bersama, dan radius membutuhkan lat/lng' }
);

export const createProductSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi').max(200, 'Nama produk maksimal 200 karakter'),
  description: z.string().max(1000, 'Deskripsi maksimal 1000 karakter').optional(),
  category: z.enum(['meals', 'bakery', 'drinks']),
  originalPrice: z.number().int().positive('Harga asli harus positif'),
  discountedPrice: z.number().int().positive('Harga diskon harus positif'),
  stock: z.number().int().min(0, 'Stok minimal 0'),
  imageUrl: z.string().min(1, 'URL gambar tidak valid').optional().nullable(),
  imageVariants: z
    .object({
      thumb: z.string(),
      card: z.string(),
      full: z.string(),
    })
    .optional()
    .nullable(),
  storeName: z.string().min(1, 'Nama toko wajib diisi').max(200),
  storeAddress: z.string().max(500).optional().nullable(),
  storeLat: z.number().optional().nullable(),
  storeLng: z.number().optional().nullable(),
  expiresAt: z.string().datetime('Format tanggal tidak valid'),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Query pencarian wajib diisi'),
  category: z.enum(['meals', 'bakery', 'drinks']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});
