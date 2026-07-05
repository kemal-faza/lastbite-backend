import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating minimal 1').max(5, 'Rating maksimal 5'),
  comment: z.string().max(1000, 'Ulasan maksimal 1000 karakter').optional(),
  imageUrl: z.string().url('URL gambar tidak valid').optional(),
});

export const reviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
