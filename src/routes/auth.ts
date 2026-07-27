import { Router, type Request, type Response, type NextFunction } from 'express';
import { registerSchema, loginSchema, verifyOtpSchema, resendOtpSchema } from '../validators/auth.js';
import { register, login, refreshAccessToken, verifyOtp, resendOtp } from '../services/authService.js';

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const result = await register(parsed.data);
    res.status(201).json({
      user: result.user,
      message: 'Registrasi berhasil. Kode verifikasi telah dikirim ke email Anda.',
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const result = await login(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token wajib disertakan', code: 'VALIDATION_ERROR' });
      return;
    }

    const tokens = await refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/verify-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const result = await verifyOtp(parsed.data);
    res.json({ verified: result.verified, message: 'Verifikasi berhasil. Akun Anda telah aktif.' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/resend-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = resendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.errors.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    await resendOtp(parsed.data);
    res.json({ message: 'Kode verifikasi baru telah dikirim.' });
  } catch (err) {
    next(err);
  }
});
