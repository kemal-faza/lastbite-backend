import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth, requireMitra } from '../middleware/auth.js';
import { getSalesTrend, getRevenueSummary, getProductPerformance, getPeakHours, generateAnalyticsCsv, AnalyticsError } from '../services/mitraAnalyticsService.js';
import type { RevenueSummary } from '../services/mitraAnalyticsService.js';
import { analyticsQuerySchema } from '../validators/analytics.js';
import { verifyAccessToken } from '../lib/jwt.js';

export const analyticsRouter = Router();

// GET /mitra/analytics/export - Export analytics as CSV (supports query token for browser download)
analyticsRouter.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const decoded = verifyAccessToken(authHeader.slice(7));
      userId = decoded.userId;
    } else if (typeof req.query.token === 'string') {
      const decoded = verifyAccessToken(req.query.token);
      userId = decoded.userId;
    }

    if (!userId) {
      res.status(401).json({ error: 'Akses ditolak. Silakan login terlebih dahulu.', code: 'UNAUTHORIZED' });
      return;
    }

    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { from, to } = parsed.data;
    const csv = await generateAnalyticsCsv(userId, new Date(from), new Date(to));

    const filename = `lastbite-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.use(requireAuth);

analyticsRouter.get('/sales', requireMitra, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { from, to, granularity } = parsed.data;
    const trend = await getSalesTrend(req.user!.userId, new Date(from), new Date(to), granularity);
    res.json({ trend });
  } catch (err) {
    if (err instanceof AnalyticsError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// GET /mitra/analytics/revenue - Revenue summary for date range
analyticsRouter.get('/revenue', requireMitra, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { from, to } = parsed.data;
    const summary = await getRevenueSummary(req.user!.userId, new Date(from), new Date(to));
    res.json({ summary });
  } catch (err) {
    next(err);
  }
});

// GET /mitra/analytics/products - Product performance ranking
analyticsRouter.get('/products', requireMitra, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { from, to } = parsed.data;
    const products = await getProductPerformance(req.user!.userId, new Date(from), new Date(to));
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// GET /mitra/analytics/peak-hours - Hourly order distribution
analyticsRouter.get('/peak-hours', requireMitra, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { from, to } = parsed.data;
    const hours = await getPeakHours(req.user!.userId, new Date(from), new Date(to));
    res.json({ hours });
  } catch (err) {
    next(err);
  }
});
