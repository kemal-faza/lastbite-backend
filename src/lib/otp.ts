import bcrypt from 'bcryptjs';

const OTP_SALT_ROUNDS = 6; // Lower than password (12) — OTP is short-lived (5 min)

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, OTP_SALT_ROUNDS);
}

export async function verifyOtpCode(plainCode: string, hashedCode: string): Promise<boolean> {
  return bcrypt.compare(plainCode, hashedCode);
}
