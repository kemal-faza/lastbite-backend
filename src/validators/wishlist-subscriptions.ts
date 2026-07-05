import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  productId: z.string().uuid('ID produk tidak valid'),
});
