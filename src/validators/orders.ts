import { z } from 'zod';

export const createOrderSchema = z.object({
  buyerName: z.string().min(1, 'Nama wajib diisi').max(100),
  buyerPhone: z.string().min(6, 'Nomor telepon wajib diisi').max(20),
  notes: z.string().max(500).optional(),
});

export const verifyPickupSchema = z.object({
  pickupCode: z.string().min(1, 'Kode pickup wajib diisi').max(20),
});
