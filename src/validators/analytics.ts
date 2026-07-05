import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  from: z.string().datetime({ message: 'Parameter from harus berupa ISO datetime' }),
  to: z.string().datetime({ message: 'Parameter to harus berupa ISO datetime' }),
  granularity: z.enum(['daily', 'weekly', 'monthly'], {
    errorMap: () => ({ message: 'Granularity harus daily, weekly, atau monthly' }),
  }).optional().default('daily'),
});
