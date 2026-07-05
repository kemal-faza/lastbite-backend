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
      res.status(201).json({ url: result.url, key: result.key });
    } catch (err) {
      if (err instanceof UploadError) {
        res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
        return;
      }
      next(err);
    }
  }
);
