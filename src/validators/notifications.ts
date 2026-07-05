import { z } from 'zod';

export const getNotificationsQuerySchema = z.object({
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
});
