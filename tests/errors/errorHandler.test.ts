import { describe, it, expect, vi } from 'vitest';
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
});
