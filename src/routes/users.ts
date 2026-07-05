import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getProfile, updateProfile, UserNotFoundError } from '../services/userService.js';
import { updateProfileSchema } from '../validators/users.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getProfile(req.user!.userId);
    res.json({ user });
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      res.status(404).json({ error: err.message, code: 'USER_NOT_FOUND' });
      return;
    }
    next(err);
  }
});

usersRouter.patch('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const user = await updateProfile(req.user!.userId, parsed.data);
    res.json({ user });
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      res.status(404).json({ error: err.message, code: 'USER_NOT_FOUND' });
      return;
    }
    next(err);
  }
});
