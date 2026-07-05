import { z } from 'zod';

export const registerDeviceSchema = z.object({
  token: z.string().min(1, 'Token tidak boleh kosong'),
  platform: z.enum(['web', 'ios', 'android']).optional(),
});
