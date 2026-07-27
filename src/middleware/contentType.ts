import type { Request, Response, NextFunction } from 'express';

export function requireJson(req: Request, res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const contentType = req.headers['content-type'];

  // No body (e.g. PATCH with no payload, or a trigger-style POST) — nothing to validate.
  if (!contentType) {
    return next();
  }

  // File uploads are multipart and handled by multer, not JSON.
  if (contentType.toLowerCase().startsWith('multipart/form-data')) {
    return next();
  }

  // Only reject when a body is present but is not JSON.
  if (!req.is('application/json')) {
    res.status(415).json({
      error: 'Content-Type harus application/json',
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    return;
  }

  next();
}
