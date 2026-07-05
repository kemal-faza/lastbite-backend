import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signAccessToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiry,
    jwtid: crypto.randomUUID(),
  });
}

export function signRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiry,
    jwtid: crypto.randomUUID(),
  });
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, config.jwtRefreshSecret) as { userId: string };
}
