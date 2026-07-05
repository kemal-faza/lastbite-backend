import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createSubscriptionSchema } from '../validators/wishlist-subscriptions.js';
import { prisma } from '../lib/prisma.js';

export const wishlistSubscriptionsRouter = Router();

wishlistSubscriptionsRouter.use(requireAuth);

wishlistSubscriptionsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const subscription = await prisma.wishlistSubscription.upsert({
      where: {
        userId_productId: {
          userId: req.user!.userId,
          productId: parsed.data.productId,
        },
      },
      update: {},
      create: { userId: req.user!.userId, productId: parsed.data.productId },
    });

    res.status(201).json({ subscription });
  } catch (err) {
    next(err);
  }
});

wishlistSubscriptionsRouter.delete('/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.wishlistSubscription.deleteMany({
      where: { userId: req.user!.userId, productId: req.params.productId },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

wishlistSubscriptionsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subs = await prisma.wishlistSubscription.findMany({
      where: { userId: req.user!.userId },
      select: { productId: true },
    });
    res.json({ productIds: subs.map((s) => s.productId) });
  } catch (err) {
    next(err);
  }
});
