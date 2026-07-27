import multer from 'multer';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { uploadFile, UploadError } from '../services/uploadService.js';

export const uploadsRouter = Router();

uploadsRouter.post(
  '/',
  requireAuth,
  uploadMiddleware.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'File tidak ditemukan', code: 'FILE_REQUIRED' });
        return;
      }
      const result = await uploadFile(req.file);
      res.status(201).json({ url: result.url, key: result.key, variants: result.variants });
    } catch (err) {
      if (err instanceof UploadError) {
        res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
        return;
      }
      // Sharp processing errors (corrupt/invalid image data)
      if (err instanceof Error && err.message.includes('Input buffer')) {
        res.status(400).json({ error: 'Gagal memproses gambar. File mungkin rusak atau tidak valid.', code: 'UPLOAD_ERROR' });
        return;
      }
      next(err);
    }
  }
);
