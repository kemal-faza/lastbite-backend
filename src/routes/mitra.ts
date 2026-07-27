import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireMitra } from '../middleware/auth.js';
import { registerMitra, getMitraProfile, updateMitraProfile, updateMitraLocation, MitraError } from '../services/mitraService.js';
import { getMitraProducts, updateMitraProduct, deleteMitraProduct, MitraProductError } from '../services/mitraProductService.js';
import { getMitraStats } from '../services/mitraStatsService.js';
import { getStoreOrders, updateOrderStatus, MitraOrderError } from '../services/mitraOrderService.js';
import { registerMitraSchema, updateMitraProfileSchema, locationUpdateSchema, updateMitraProductSchema, updateOrderStatusSchema } from '../validators/mitra.js';

export const mitraRouter = Router();

// All mitra routes require authentication
mitraRouter.use(requireAuth);

// POST /mitra/register - Register as Mitra
mitraRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerMitraSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const profile = await registerMitra(req.user!.userId, parsed.data);
    res.status(201).json({ profile });
  } catch (err) {
    if (err instanceof MitraError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// GET /mitra/me - Get own mitra profile
mitraRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getMitraProfile(req.user!.userId);
    res.json({ profile });
  } catch (err) {
    if (err instanceof MitraError) {
      res.status(404).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// PATCH /mitra/me - Update own mitra profile
mitraRouter.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateMitraProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const profile = await updateMitraProfile(req.user!.userId, parsed.data);
    res.json({ profile });
  } catch (err) {
    if (err instanceof MitraError) {
      res.status(404).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// PATCH /mitra/me/location - Update store location with optional geocoding
mitraRouter.patch('/me/location', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = locationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const profile = await updateMitraLocation(req.user!.userId, parsed.data);
    res.json({ profile });
  } catch (err) {
    if (err instanceof MitraError) {
      const status = err.code === 'GEOCODING_FAILED' ? 400 : 404;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// GET /mitra/products - List own products
mitraRouter.get('/products', requireMitra, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await getMitraProducts(req.user!.userId);
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// PATCH /mitra/products/:id - Update own product
mitraRouter.patch('/products/:id', requireMitra, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateMitraProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const idParsed = z.string().uuid().safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'ID produk tidak valid', code: 'VALIDATION_ERROR' });
      return;
    }
    const product = await updateMitraProduct(req.user!.userId, idParsed.data, parsed.data);
    res.json({ product });
  } catch (err) {
    if (err instanceof MitraProductError) {
      res.status(404).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// DELETE /mitra/products/:id - Soft-delete own product
mitraRouter.delete('/products/:id', requireMitra, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = z.string().uuid().safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'ID produk tidak valid', code: 'VALIDATION_ERROR' });
      return;
    }
    await deleteMitraProduct(req.user!.userId, idParsed.data);
    res.status(204).end();
  } catch (err) {
    if (err instanceof MitraProductError) {
      res.status(404).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// GET /mitra/stats - Get mitra stats (stock, sold, remaining, active orders)
mitraRouter.get('/stats', requireMitra, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getMitraStats(req.user!.userId);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

// GET /mitra/orders - List incoming orders for mitra's products
mitraRouter.get('/orders', requireMitra, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await getStoreOrders(req.user!.userId);
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// PATCH /mitra/orders/:id/status - Update order status
mitraRouter.patch('/orders/:id/status', requireMitra, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const order = await updateOrderStatus(req.user!.userId, req.params.id as string, parsed.data.status);
    res.json({ order });
  } catch (err) {
    if (err instanceof MitraOrderError) {
      const status = err.code === 'INVALID_TRANSITION' ? 400 : 404;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});
