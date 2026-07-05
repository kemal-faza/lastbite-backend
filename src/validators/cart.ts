import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.string().uuid('ID produk tidak valid'),
  quantity: z.number().int().min(1).max(99).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(99),
});
