import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { registerDevice, DeviceError } from '../services/deviceService.js';
import { registerDeviceSchema } from '../validators/devices.js';

export const devicesRouter = Router();

devicesRouter.use(requireAuth);

devicesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const device = await registerDevice(req.user!.userId, parsed.data.token, parsed.data.platform);
    const status = device.createdAt.getTime() === device.updatedAt.getTime() ? 201 : 200;
    res.status(status).json({ device });
  } catch (err) {
    if (err instanceof DeviceError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});
