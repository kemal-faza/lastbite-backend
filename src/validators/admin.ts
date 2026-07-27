import { z } from 'zod';

export const verifyMitraSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  isVerified: z.boolean().optional(),
});

export const platformConfigUpdateSchema = z.object({
  commissionRate: z.number().int().min(0).max(100).optional(),
  supportPhone: z.string().max(100).optional(),
  categories: z.array(z.string().min(1).max(50)).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Setidaknya satu konfigurasi harus diubah' }
);
