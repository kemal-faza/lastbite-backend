import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import { config } from '../../src/config.js';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const app = createApp();
const isLocalProvider = config.upload.provider === 'local';

describe('POST /uploads - variant generation integration', () => {
  let accessToken: string;
  const uploadDir = path.resolve('uploads');

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test@test.com',
        name: 'Test User',
        passwordHash: 'hash',
        role: 'MITRA',
        isVerified: true,
      },
    });
    accessToken = signAccessToken({ userId: user.id, email: user.email });
  });

  it('should generate 3 variant files on disk', { skip: !isLocalProvider }, async () => {
    // Create a real 1000x1000 test JPEG
    const imageBuffer = await sharp({
      create: { width: 1000, height: 1000, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const res = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', imageBuffer, 'test.jpg');

    expect(res.status).toBe(201);

    // Check that all 3 files exist on disk
    const variantRes = res.body.variants;
    const productKey = res.body.key;

    const thumbPath = path.join(uploadDir, variantRes.thumb.replace('/uploads/', ''));
    const cardPath = path.join(uploadDir, variantRes.card.replace('/uploads/', ''));
    const fullPath = path.join(uploadDir, variantRes.full.replace('/uploads/', ''));

    expect(await fs.stat(thumbPath)).toBeTruthy();
    expect(await fs.stat(cardPath)).toBeTruthy();
    expect(await fs.stat(fullPath)).toBeTruthy();

    // Verify file contents are valid JPEGs with correct widths
    const thumbMeta = await sharp(thumbPath).metadata();
    const cardMeta = await sharp(cardPath).metadata();
    const fullMeta = await sharp(fullPath).metadata();

    expect(thumbMeta.width).toBe(200);
    expect(cardMeta.width).toBe(400);
    expect(fullMeta.width).toBe(800);
    expect(thumbMeta.format).toBe('jpeg');
    expect(cardMeta.format).toBe('jpeg');
    expect(fullMeta.format).toBe('jpeg');
  });

  it('should return URLs that can be served by GET /uploads', { skip: !isLocalProvider }, async () => {
    const imageBuffer = await sharp({
      create: { width: 500, height: 500, channels: 3, background: { r: 50, g: 50, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    const uploadRes = await request(app)
      .post('/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', imageBuffer, 'test.jpg');

    expect(uploadRes.status).toBe(201);

    // GET the card variant
    const getRes = await request(app).get(uploadRes.body.variants.card);
    expect(getRes.status).toBe(200);
    expect(getRes.headers['content-type']).toMatch(/image\/jpeg/);
  });
});
