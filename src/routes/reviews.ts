import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  createReview,
  getProductReviews,
  getMitraReviews,
  computeTrustBadges,
  ReviewError,
} from '../services/reviewService.js';
import { createReviewSchema, reviewQuerySchema } from '../validators/reviews.js';

export const reviewsRouter = Router();

// POST /orders/:id/review - create review for an order
reviewsRouter.post('/orders/:id/review', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = z.string().uuid().safeParse(req.params.id);
    if (!paramParsed.success) {
      res.status(400).json({
        error: 'ID pesanan tidak valid',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const review = await createReview(req.user!.userId, paramParsed.data, parsed.data);
    res.status(201).json({ review });
  } catch (err) {
    if (err instanceof ReviewError) {
      const statusMap: Record<string, number> = {
        ORDER_NOT_FOUND: 404,
        ORDER_NOT_PICKED_UP: 400,
        DUPLICATE_REVIEW: 409,
        ORDER_HAS_NO_ITEMS: 400,
      };
      const status = statusMap[err.code] || 400;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// GET /products/:id/reviews - get reviews for a product
reviewsRouter.get('/products/:id/reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = z.string().uuid().safeParse(req.params.id);
    if (!paramParsed.success) {
      res.status(400).json({
        error: 'ID produk tidak valid',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const queryParsed = reviewQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      res.status(400).json({
        error: queryParsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const result = await getProductReviews(paramParsed.data, queryParsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /mitra/:id/reviews - get reviews across all mitra products
reviewsRouter.get('/mitra/:id/reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = z.string().uuid().safeParse(req.params.id);
    if (!paramParsed.success) {
      res.status(400).json({
        error: 'ID mitra tidak valid',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const queryParsed = reviewQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      res.status(400).json({
        error: queryParsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const result = await getMitraReviews(paramParsed.data, queryParsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /products/:id/trust-badges - compute trust badges
reviewsRouter.get('/products/:id/trust-badges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = z.string().uuid().safeParse(req.params.id);
    if (!paramParsed.success) {
      res.status(400).json({
        error: 'ID produk tidak valid',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const badges = await computeTrustBadges(paramParsed.data);
    res.json({ badges });
  } catch (err) {
    next(err);
  }
});
