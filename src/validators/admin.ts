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
