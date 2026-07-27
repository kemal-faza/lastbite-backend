import type { Request, Response, NextFunction } from 'express';

export function requireJson(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
    res.status(415).json({
      error: 'Content-Type harus application/json',
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    return;
  }
  next();
}
