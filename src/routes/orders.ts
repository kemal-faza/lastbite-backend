import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  verifyPickup,
  cancelExpiredOrder,
  hasOrderHistory,
} from '../services/orderService.js';
import { createOrderSchema, verifyPickupSchema } from '../validators/orders.js';

export const ordersRouter = Router();

// All order routes require auth
ordersRouter.use(requireAuth);

// POST /orders - create order from cart
ordersRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const order = await createOrder(req.user!.userId, parsed.data);
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

// GET /orders - get all user orders (paginated)
const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

ordersRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = orderListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const result = await getUserOrders(req.user!.userId, parsed.data.page, parsed.data.limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /orders/has-history - check if user has any past orders
ordersRouter.get('/has-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hasHistory = await hasOrderHistory(req.user!.userId);
    res.json({ hasHistory });
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id - get order by id
ordersRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = z.string().uuid().safeParse(req.params.id);
    if (!paramParsed.success) {
      res.status(400).json({
        error: 'ID pesanan tidak valid',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const order = await getOrderById(req.user!.userId, paramParsed.data);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/verify-pickup - verify pickup code
ordersRouter.post('/:id/verify-pickup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = z.string().uuid().safeParse(req.params.id);
    if (!paramParsed.success) {
      res.status(400).json({
        error: 'ID pesanan tidak valid',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const parsed = verifyPickupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const order = await verifyPickup(req.user!.userId, paramParsed.data, parsed.data.pickupCode);
    res.json({ order, message: 'Pickup berhasil diverifikasi' });
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/cancel-expired - auto-cancel order with expired pickup code (food-saver)
ordersRouter.post('/:id/cancel-expired', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = z.string().min(1).safeParse(req.params.id);
    if (!paramParsed.success) {
      res.status(400).json({ error: 'ID pesanan tidak valid', code: 'VALIDATION_ERROR' });
      return;
    }

    const order = await cancelExpiredOrder(req.user!.userId, paramParsed.data);
    res.json({ order, message: 'Pesanan dibatalkan karena kode pickup kedaluwarsa' });
  } catch (err) {
    next(err);
  }
});
