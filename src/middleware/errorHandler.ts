import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
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

  // Multer errors: file too large, wrong type, etc.
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: 'Ukuran file terlalu besar. Maksimal 5MB.',
        code: 'FILE_TOO_LARGE',
      });
      return;
    }
    res.status(400).json({
      error: err.message,
      code: 'UPLOAD_ERROR',
    });
    return;
  }

  // Multer fileFilter rejects with "Format file tidak didukung" (plain Error)
  if (err.message === 'Format file tidak didukung. Gunakan JPEG, PNG, WebP, atau AVIF.') {
    res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
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
