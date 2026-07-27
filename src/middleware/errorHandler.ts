import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';

const isDev = process.env.NODE_ENV !== 'production';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  if (isDev) {
    console.error('[Error]', err.message, err.stack);
  } else {
    console.error('[Error]', err.constructor.name);
  }

  res.status(500).json({
    error: 'Terjadi kesalahan pada server',
    code: 'INTERNAL_ERROR',
  });
}
