import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '../middleware/auth.js';
import { createAuditLog } from '../services/auditLogService.js';
import { listMitraVerifications, verifyMitra } from '../services/adminMitraService.js';
import { verifyMitraSchema, paginationSchema, userUpdateSchema, platformConfigUpdateSchema } from '../validators/admin.js';
import { listUsers, getUserDetail, updateUser } from '../services/adminUserService.js';
import { listAllProducts, toggleProduct } from '../services/adminProductService.js';
import { getConfig, updateConfig as updatePlatformConfig } from '../services/platformConfigService.js';
import { getDashboardStats } from '../services/adminDashboardService.js';

export const adminRouter = Router();

// All admin routes require admin role
adminRouter.use(requireAdmin);

// ---- Dashboard ----

adminRouter.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// ---- User Management ----

adminRouter.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const role = req.query.role as import('@prisma/client').UserRole | undefined;
    const search = req.query.search as string | undefined;
    const result = await listUsers({ role, search, page: parsed.data.page, limit: parsed.data.limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = z.string().uuid().safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'ID pengguna tidak valid', code: 'VALIDATION_ERROR' });
      return;
    }
    const user = await getUserDetail(idParsed.data);
    res.json(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Pengguna tidak ditemukan', code: 'USER_NOT_FOUND' });
      return;
    }
    next(err);
  }
});

adminRouter.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = z.string().uuid().safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'ID pengguna tidak valid', code: 'VALIDATION_ERROR' });
      return;
    }
    const bodyParsed = userUpdateSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({
        error: bodyParsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const user = await updateUser(idParsed.data, bodyParsed.data);

    await createAuditLog({
      actorId: req.user!.userId,
      action: 'user.edit',
      entity: 'user',
      entityId: idParsed.data,
      details: bodyParsed.data,
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ---- Product Moderation ----

adminRouter.get('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const search = req.query.search as string | undefined;
    const result = await listAllProducts({ isActive, search, page: parsed.data.page, limit: parsed.data.limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const toggleProductSchema = z.object({
  isActive: z.boolean(),
});

adminRouter.patch('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = z.string().uuid().safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'ID produk tidak valid', code: 'VALIDATION_ERROR' });
      return;
    }
    const bodyParsed = toggleProductSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({
        error: bodyParsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const result = await toggleProduct(idParsed.data, bodyParsed.data.isActive);

    await createAuditLog({
      actorId: req.user!.userId,
      action: bodyParsed.data.isActive ? 'product.activate' : 'product.deactivate',
      entity: 'product',
      entityId: idParsed.data,
      details: { name: result.name },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---- Platform Config ----

adminRouter.get('/config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bodyParsed = platformConfigUpdateSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({
        error: bodyParsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const config = await updatePlatformConfig(bodyParsed.data, req.user!.userId);

    await createAuditLog({
      actorId: req.user!.userId,
      action: 'config.update',
      entity: 'platform_config',
      details: req.body,
    });

    res.json(config);
  } catch (err) {
    next(err);
  }
});

// ---- Mitra Verification ----

adminRouter.get('/mitra-verifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const status = req.query.status as 'PENDING' | 'VERIFIED' | 'REJECTED' | undefined;
    const result = await listMitraVerifications({ status, page: parsed.data.page, limit: parsed.data.limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/mitra-verifications/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = z.string().uuid().safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'ID verifikasi tidak valid', code: 'VALIDATION_ERROR' });
      return;
    }
    const bodyParsed = verifyMitraSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({
        error: bodyParsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const result = await verifyMitra(idParsed.data, bodyParsed.data.status, req.user!.userId);

    await createAuditLog({
      actorId: req.user!.userId,
      action: bodyParsed.data.status === 'VERIFIED' ? 'mitra.verify.approve' : 'mitra.verify.reject',
      entity: 'mitra_profile',
      entityId: idParsed.data,
      details: { storeName: result.storeName, newStatus: bodyParsed.data.status },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});
