import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  verifyPickup,
  hasOrderHistory,
  OrderError,
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
    if (err instanceof OrderError) {
      const statusMap: Record<string, number> = {
        CART_EMPTY: 400,
        PRODUCT_UNAVAILABLE: 409,
        INSUFFICIENT_STOCK: 409,
        PICKUP_CODE_ERROR: 500,
      };
      const status = statusMap[err.code] || 400;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// GET /orders - get all user orders
ordersRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await getUserOrders(req.user!.userId);
    res.json({ orders });
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
    if (err instanceof OrderError) {
      const statusMap: Record<string, number> = {
        ORDER_NOT_FOUND: 404,
      };
      const status = statusMap[err.code] || 404;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
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
    if (err instanceof OrderError) {
      const statusMap: Record<string, number> = {
        ORDER_NOT_FOUND: 404,
        INVALID_STATUS: 409,
        INVALID_PICKUP_CODE: 400,
        PICKUP_EXPIRED: 400,
      };
      const status = statusMap[err.code] || 400;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});
