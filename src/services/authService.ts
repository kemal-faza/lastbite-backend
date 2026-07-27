import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { getOtpSender } from '../lib/otpSender.js';
import { hashOtp, verifyOtpCode } from '../lib/otp.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { config } from '../config.js';
import { toUserResponse } from '../lib/userResponse.js';
import type { UserResponse, AuthTokens, LoginResponse } from '../types/index.js';

function generateOtpCode(): string {
  const min = Math.pow(10, config.otpLength - 1);
  const max = Math.pow(10, config.otpLength) - 1;
  return crypto.randomInt(min, max + 1).toString();
}

import { AppError } from '../errors/AppError.js';

export class EmailAlreadyExistsError extends AppError {
  constructor() {
    super('Email sudah terdaftar', 409, 'EMAIL_EXISTS');
    this.name = 'EmailAlreadyExistsError';
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Email atau password salah', 401, 'INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountNotVerifiedError extends AppError {
  constructor() {
    super('Akun belum diverifikasi. Silakan verifikasi OTP terlebih dahulu.', 403, 'ACCOUNT_NOT_VERIFIED');
    this.name = 'AccountNotVerifiedError';
  }
}

export class InvalidOtpError extends AppError {
  constructor() {
    super('Kode verifikasi tidak valid atau telah kedaluwarsa', 400, 'INVALID_OTP');
    this.name = 'InvalidOtpError';
  }
}

export class AccountAlreadyVerifiedError extends AppError {
  constructor() {
    super('Akun Anda sudah terverifikasi. Silakan masuk.', 400, 'ALREADY_VERIFIED');
    this.name = 'AccountAlreadyVerifiedError';
  }
}

export class UserNotFoundError extends AppError {
  constructor() {
    super('Pengguna tidak ditemukan', 404, 'USER_NOT_FOUND');
    this.name = 'UserNotFoundError';
  }
}

export class InvalidRefreshTokenError extends AppError {
  constructor() {
    super('Refresh token tidak valid', 401, 'INVALID_REFRESH_TOKEN');
    this.name = 'InvalidRefreshTokenError';
  }
}

export async function register(input: {
  email: string;
  name: string;
  phone?: string;
  password: string;
}): Promise<{ user: UserResponse }> {
  const normalizedEmail = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new EmailAlreadyExistsError();
  }

  const passwordHash = await hashPassword(input.password);
  const rawCode = generateOtpCode();
  const hashedCode = await hashOtp(rawCode);
  const verificationCodeExpiresAt = new Date(
    Date.now() + config.otpExpiryMinutes * 60 * 1000
  );

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.name,
      phone: input.phone || null,
      passwordHash,
      verificationCode: hashedCode,
      verificationCodeExpiresAt,
    },
  });

  await getOtpSender().sendOtp(user.email, rawCode);

  return { user: toUserResponse(user) };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<LoginResponse> {
  const normalizedEmail = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);
  if (!passwordValid) {
    throw new InvalidCredentialsError();
  }

  if (!user.isVerified) {
    throw new AccountNotVerifiedError();
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id });

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return {
    tokens: { accessToken, refreshToken },
    user: toUserResponse(user),
  };
}

export async function verifyOtp(input: { email: string; code: string }): Promise<{ verified: boolean }> {
  const normalizedEmail = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new UserNotFoundError();
  }

  if (user.isVerified) {
    return { verified: true };
  }

  if (
    !user.verificationCodeExpiresAt ||
    user.verificationCodeExpiresAt < new Date()
  ) {
    throw new InvalidOtpError();
  }

  const codeValid = await verifyOtpCode(input.code, user.verificationCode ?? '');
  if (!codeValid) {
    throw new InvalidOtpError();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null,
    },
  });

  return { verified: true };
}

export async function resendOtp(input: { email: string }): Promise<void> {
  const normalizedEmail = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new UserNotFoundError();
  }

  if (user.isVerified) {
    throw new AccountAlreadyVerifiedError();
  }

  const rawCode = generateOtpCode();
  const hashedCode = await hashOtp(rawCode);
  const verificationCodeExpiresAt = new Date(
    Date.now() + config.otpExpiryMinutes * 60 * 1000
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { verificationCode: hashedCode, verificationCodeExpiresAt },
  });

  await getOtpSender().sendOtp(user.email, rawCode);
}

export async function refreshAccessToken(token: string): Promise<AuthTokens> {
  let payload: { userId: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new InvalidRefreshTokenError();
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.refreshToken !== token) {
    throw new InvalidRefreshTokenError();
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id });

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return { accessToken, refreshToken };
}
