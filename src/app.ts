import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { productsRouter } from './routes/products.js';
import { cartRouter } from './routes/cart.js';
import { ordersRouter } from './routes/orders.js';
import { uploadsRouter } from './routes/uploads.js';
import { mitraRouter } from './routes/mitra.js';
import { devicesRouter } from './routes/devices.js';
import { notificationsRouter } from './routes/notifications.js';
import { wishlistSubscriptionsRouter } from './routes/wishlist-subscriptions.js';
import { reviewsRouter } from './routes/reviews.js';
import { analyticsRouter } from './routes/analytics.js';
import { adminRouter } from './routes/admin.js';
import { searchRouter } from './routes/search.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireJson } from './middleware/contentType.js';
import { config } from './config.js';
import swaggerUi from 'swagger-ui-express';
import { load } from 'js-yaml';
import fs from 'node:fs';

function loadOpenApiSpec(): Record<string, unknown> | undefined {
  try {
    const file = path.resolve(process.cwd(), 'openapi.yaml');
    return load(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Silakan coba lagi dalam 1 menit.', code: 'RATE_LIMITED' },
});

export function createApp() {
  const app = express();

  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
  }));
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(express.json({ limit: config.upload.jsonBodyLimit }));
  app.use(requireJson);

  // Serve uploaded files statically (GET /uploads/filename)
  app.use('/uploads', express.static(path.resolve('uploads')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/auth', authLimiter, authRouter);
  app.use('/users', usersRouter);
  app.use('/products', productsRouter);
  app.use('/cart', cartRouter);
  app.use('/orders', ordersRouter);
  app.use('/uploads', uploadsRouter);
  app.use('/mitra', mitraRouter);
  app.use('/devices', devicesRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/wishlist-subscriptions', wishlistSubscriptionsRouter);
  app.use('/reviews', reviewsRouter);
  app.use('/mitra/analytics', analyticsRouter);
  app.use('/admin', adminRouter);
  app.use('/products/trending', searchRouter);

  // ---- API documentation (Swagger UI) ----
  const openApiSpec = loadOpenApiSpec();
  if (openApiSpec) {
    // Swagger UI injects an inline init script; relax helmet's CSP for its routes.
    app.use('/docs', (_req, res, next) => {
      res.removeHeader('Content-Security-Policy');
      next();
    });
    app.get('/openapi.json', (_req, res) => {
      res.json(openApiSpec);
    });
    app.use(
      '/docs',
      swaggerUi.serve,
      swaggerUi.setup(openApiSpec, {
        customSiteTitle: 'LastBite API Docs',
        swaggerOptions: { persistAuth: true },
      }),
    );
  }

  app.use(errorHandler);

  return app;
}
