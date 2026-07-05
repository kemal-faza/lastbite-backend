import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  CartError,
  DifferentStoreError,
  InsufficientStockError,
  ProductNotFoundError,
} from '../services/cartService.js';
import { addToCartSchema, updateCartItemSchema } from '../validators/cart.js';

export const cartRouter = Router();

// All cart routes require auth
cartRouter.use(requireAuth);

// GET /cart - get current cart
cartRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cart = await getCart(req.user!.userId);
    res.json({ cart });
  } catch (err) {
    next(err);
  }
});

// POST /cart - add item to cart
cartRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = addToCartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const cart = await addToCart(req.user!.userId, parsed.data.productId, parsed.data.quantity);
    res.json({ cart });
  } catch (err) {
    if (err instanceof DifferentStoreError || err instanceof InsufficientStockError) {
      res.status(409).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof ProductNotFoundError) {
      res.status(404).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// PATCH /cart/items/:productId - update item quantity
cartRouter.patch('/items/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateCartItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const paramParsed = z.string().uuid().safeParse(req.params.productId);
    if (!paramParsed.success) {
      res.status(400).json({
        error: 'ID produk tidak valid',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const productId = paramParsed.data;

    let cart;
    if (parsed.data.quantity === 0) {
      cart = await removeFromCart(req.user!.userId, productId);
    } else {
      cart = await updateCartItemQuantity(req.user!.userId, productId, parsed.data.quantity);
    }

    res.json({ cart });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      res.status(409).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof CartError) {
      res.status(404).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// DELETE /cart/items/:productId - remove item from cart
cartRouter.delete('/items/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = z.string().uuid().safeParse(req.params.productId);
    if (!paramParsed.success) {
      res.status(400).json({
        error: 'ID produk tidak valid',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const productId = paramParsed.data;
    const cart = await removeFromCart(req.user!.userId, productId);
    res.json({ cart });
  } catch (err) {
    next(err);
  }
});

// DELETE /cart - clear entire cart
cartRouter.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await clearCart(req.user!.userId);
    res.json({ message: 'Keranjang dikosongkan' });
  } catch (err) {
    next(err);
  }
});
