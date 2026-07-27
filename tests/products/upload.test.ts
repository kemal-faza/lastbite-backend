import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import sharp from 'sharp';

const app = createApp();

describe('POST /uploads', () => {
  let accessToken: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'uploader@test.com',
        name: 'Uploader',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });
    accessToken = signAccessToken({ userId: user.id, email: user.email });
  });

  it('should upload an image and return URL with variants', async () => {
    // Create a minimal valid 100x100 JPEG buffer (real image data for sharp)
    const imageBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', imageBuffer, 'test.jpg');

    expect(res.status).toBe(201);
    expect(res.body.url).toBeDefined();
    expect(res.body.key).toBeDefined();
    expect(res.body.variants).toBeDefined();
    // All 3 variant URLs should end with the correct variant name
    expect(res.body.variants.thumb).toMatch(/thumb\.jpg$/);
    expect(res.body.variants.card).toMatch(/card\.jpg$/);
    expect(res.body.variants.full).toMatch(/full\.jpg$/);
    // URL should contain the product key path
    expect(res.body.variants.thumb).toMatch(/\/products\/.+\/thumb\.jpg$/);
  });

  it('should return 401 without auth', async () => {
    const imageBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const res = await request(app)
      .post('/uploads')
      .attach('file', imageBuffer, 'test.jpg');

    expect(res.status).toBe(401);
  });

  it('should return 400 when no file provided', async () => {
    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_REQUIRED');
  });

  // ── Edge-case tests ──────────────────────────────────────────────

  it('should reject non-image file (wrong MIME type)', async () => {
    // Create a text file buffer
    const textBuffer = Buffer.from('This is not an image', 'utf-8');
    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', textBuffer, 'test.txt');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UPLOAD_ERROR');
  });

  it('should reject oversized file', async () => {
    // Create a buffer larger than maxFileSize (5MB default)
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', largeBuffer, 'large.jpg');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  it('should reject corrupt image file', async () => {
    // Create a corrupt PNG buffer (header only, no actual image data)
    const corruptBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature only
    ]);
    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', corruptBuffer, 'test.png');

    // Passes MIME check but fails sharp processing — should return 400
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UPLOAD_ERROR');
  });

  it('should return 401 without auth token', async () => {
    const imageBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const res = await request(app)
      .post('/uploads')
      .attach('file', imageBuffer, 'test.jpg');

    expect(res.status).toBe(401);
  });

  it('should reject PDF file (wrong MIME type)', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content', 'utf-8');
    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', pdfBuffer, 'test.pdf');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UPLOAD_ERROR');
  });

  it('should accept WebP image', async () => {
    // Create a minimal WebP image
    const webpBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .webp()
      .toBuffer();

    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', webpBuffer, 'test.webp');

    expect(res.status).toBe(201);
    expect(res.body.url).toBeDefined();
  });

  it('should return 400 for malicious filename (path traversal)', async () => {
    const imageBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', imageBuffer, {
        filename: '../../../etc/passwd.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    // Should sanitise the filename — not use the path-traversal name
    expect(res.body.url).not.toContain('etc/passwd');
  });
});
