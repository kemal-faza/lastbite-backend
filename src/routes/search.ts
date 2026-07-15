import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export const searchRouter = Router();

searchRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const queries = await prisma.searchQuery.findMany({
      orderBy: { count: 'desc' },
      take: limit,
      select: { query: true, count: true },
    });
    res.json({ queries });
  } catch (err) {
    next(err);
  }
});
