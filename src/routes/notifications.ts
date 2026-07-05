import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  getNotifications,
  markAsRead,
  NotificationError,
} from '../services/notificationService.js';
import { getNotificationsQuerySchema } from '../validators/notifications.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryParsed = getNotificationsQuerySchema.safeParse(req.query);
    const options = queryParsed.success ? queryParsed.data : {};
    const result = await getNotifications(req.user!.userId, {
      unreadOnly: options.unread,
      limit: options.limit,
      offset: options.offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = z.string().uuid().safeParse(req.params.id);
    if (!paramParsed.success) {
      res.status(400).json({ error: 'ID notifikasi tidak valid', code: 'VALIDATION_ERROR' });
      return;
    }

    const notification = await markAsRead(req.user!.userId, paramParsed.data);
    res.json({ notification });
  } catch (err) {
    if (err instanceof NotificationError) {
      res.status(404).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});
