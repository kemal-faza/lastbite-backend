import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { createAuditLog } from '../services/auditLogService.js';
import { listMitraVerifications, verifyMitra } from '../services/adminMitraService.js';
import { verifyMitraSchema, paginationSchema, userUpdateSchema } from '../validators/admin.js';
import { listUsers, getUserDetail, updateUser } from '../services/adminUserService.js';
import { listAllProducts, toggleProduct } from '../services/adminProductService.js';
import { getConfig, updateConfig as updatePlatformConfig } from '../services/platformConfigService.js';
import { getDashboardStats } from '../services/adminDashboardService.js';

export const adminRouter = Router();

// All admin routes require admin role
adminRouter.use(requireAdmin);

// ---- Dashboard ----

adminRouter.get('/dashboard', async (_req, res) => {
  const stats = await getDashboardStats();
  res.json(stats);
});

// ---- User Management ----

adminRouter.get('/users', async (req, res) => {
  const query = paginationSchema.parse(req.query);
  const role = req.query.role as import('@prisma/client').UserRole | undefined;
  const search = req.query.search as string | undefined;
  const result = await listUsers({ role, search, page: query.page, limit: query.limit });
  res.json(result);
});

adminRouter.get('/users/:id', async (req, res) => {
  const user = await getUserDetail(req.params.id);
  res.json(user);
});

adminRouter.patch('/users/:id', async (req, res) => {
  const data = userUpdateSchema.parse(req.body);
  const user = await updateUser(req.params.id, data);

  await createAuditLog({
    actorId: req.user!.userId,
    action: 'user.edit',
    entity: 'user',
    entityId: req.params.id,
    details: data,
  });

  res.json(user);
});

// ---- Product Moderation ----

adminRouter.get('/products', async (req, res) => {
  const query = paginationSchema.parse(req.query);
  const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
  const search = req.query.search as string | undefined;
  const result = await listAllProducts({ isActive, search, page: query.page, limit: query.limit });
  res.json(result);
});

adminRouter.patch('/products/:id', async (req, res) => {
  const { isActive } = req.body;
  const result = await toggleProduct(req.params.id, isActive);

  await createAuditLog({
    actorId: req.user!.userId,
    action: isActive ? 'product.activate' : 'product.deactivate',
    entity: 'product',
    entityId: req.params.id,
    details: { name: result.name },
  });

  res.json(result);
});

// ---- Platform Config ----

adminRouter.get('/config', async (_req, res) => {
  const config = await getConfig();
  res.json(config);
});

adminRouter.patch('/config', async (req, res) => {
  const config = await updatePlatformConfig(req.body, req.user!.userId);

  await createAuditLog({
    actorId: req.user!.userId,
    action: 'config.update',
    entity: 'platform_config',
    details: req.body,
  });

  res.json(config);
});

// ---- Mitra Verification ----

adminRouter.get('/mitra-verifications', async (req, res) => {
  const query = paginationSchema.parse(req.query);
  const status = req.query.status as 'PENDING' | 'VERIFIED' | 'REJECTED' | undefined;
  const result = await listMitraVerifications({ status, page: query.page, limit: query.limit });
  res.json(result);
});

adminRouter.patch('/mitra-verifications/:id', async (req, res) => {
  const { status } = verifyMitraSchema.parse(req.body);
  const result = await verifyMitra(req.params.id, status, req.user!.userId);

  await createAuditLog({
    actorId: req.user!.userId,
    action: status === 'VERIFIED' ? 'mitra.verify.approve' : 'mitra.verify.reject',
    entity: 'mitra_profile',
    entityId: req.params.id,
    details: { storeName: result.storeName, newStatus: status },
  });

  res.json(result);
});
