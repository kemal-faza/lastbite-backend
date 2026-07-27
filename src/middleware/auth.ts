import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type JwtPayload } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Akses ditolak. Silakan login terlebih dahulu.', code: 'UNAUTHORIZED' });
    return;
  }

  const token = header.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Sesi telah berakhir. Silakan login kembali.', code: 'TOKEN_EXPIRED' });
  }
}

export function requireMitra(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    // Fast path: read role from JWT (available on new tokens)
    if (req.user?.role === 'MITRA') {
      return next();
    }

    // Fallback: old tokens without role — check DB
    prisma.user
      .findUnique({
        where: { id: req.user!.userId },
        select: { role: true },
      })
      .then((user) => {
        if (!user || user.role !== 'MITRA') {
          res.status(403).json({ error: 'Akses hanya untuk Mitra.', code: 'FORBIDDEN' });
          return;
        }
        next();
      })
      .catch(() => {
        res.status(500).json({ error: 'Gagal memverifikasi akses', code: 'INTERNAL_ERROR' });
      });
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    // Fast path: read role from JWT (available on new tokens)
    if (req.user?.role === 'ADMIN') {
      return next();
    }

    // Fallback: old tokens without role — check DB
    prisma.user
      .findUnique({
        where: { id: req.user!.userId },
        select: { role: true },
      })
      .then((user) => {
        if (!user || user.role !== 'ADMIN') {
          res.status(403).json({ error: 'Akses hanya untuk Admin.', code: 'FORBIDDEN' });
          return;
        }
        next();
      })
      .catch(() => {
        res.status(500).json({ error: 'Gagal memverifikasi akses', code: 'INTERNAL_ERROR' });
      });
  });
}
