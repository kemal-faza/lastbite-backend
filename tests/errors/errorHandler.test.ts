import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { AppError } from '../../src/errors/AppError.js';
import type { Request, Response, NextFunction } from 'express';

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnThis() as unknown as Response['status'];
  res.json = vi.fn().mockReturnThis() as unknown as Response['json'];
  return res;
}

describe('errorHandler', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('returns 500 INTERNAL_ERROR for plain Error', () => {
    const err = new Error('Something broke');
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns mapped statusCode + code for AppError', () => {
    const err = new AppError('Produk tidak ditemukan', 404, 'PRODUCT_NOT_FOUND');
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Produk tidak ditemukan',
      code: 'PRODUCT_NOT_FOUND',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns mapped statusCode + code for another AppError', () => {
    const err = new AppError('Stok habis', 409, 'INSUFFICIENT_STOCK');
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Stok habis',
      code: 'INSUFFICIENT_STOCK',
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('should not leak stack trace in production', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Secret details');
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonArg = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(jsonArg).not.toHaveProperty('stack');
    expect(jsonArg.error).toBe('Terjadi kesalahan pada server');
    expect(jsonArg.code).toBe('INTERNAL_ERROR');
  });

  it('should handle unknown error type (non-Error thrown)', () => {
    const weirdErr = 'string error';
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    // Cast to Error as the handler expects Error
    errorHandler(weirdErr as unknown as Error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' }),
    );
  });

  it('should handle AppError with default 500 status and INTERNAL_ERROR code', () => {
    const err = new AppError('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');

    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Something went wrong',
      code: 'INTERNAL_ERROR',
    });
  });

  it('should not include error message details in production', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Database connection string: postgres://user:pass@host/db');
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonArg = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // In production, the error message should be generic
    expect(jsonArg.error).toBe('Terjadi kesalahan pada server');
    expect(jsonArg.code).toBe('INTERNAL_ERROR');
  });

  it('should call console.error in non-production', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';

    const err = new Error('Debug error');
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
