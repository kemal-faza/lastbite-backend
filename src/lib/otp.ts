import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const OTP_SALT_ROUNDS = 6; // Lower than password (12) — OTP is short-lived (5 min)

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, OTP_SALT_ROUNDS);
}

export async function verifyOtpCode(plainCode: string, hashedCode: string): Promise<boolean> {
  if (!hashedCode) return false;

  // New format: bcrypt hash (starts with $2a$ / $2b$)
  if (hashedCode.startsWith('$2')) {
    return bcrypt.compare(plainCode, hashedCode);
  }

  // Legacy plaintext OTP (transition window only) — compare in constant time.
  const a = Buffer.from(plainCode);
  const b = Buffer.from(hashedCode);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
