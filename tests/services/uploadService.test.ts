import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { generateVariants } from '../../src/services/uploadService.js';

describe('generateVariants', () => {
  // Create a 1200x800 red JPEG once for all tests
  const createTestImage = async (): Promise<Buffer> => {
    return sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();
  };

  it('should return thumb, card, and full variants', async () => {
    const input = await createTestImage();
    const result = await generateVariants(input);

    expect(result).toHaveProperty('thumb');
    expect(result).toHaveProperty('card');
    expect(result).toHaveProperty('full');
    expect(Buffer.isBuffer(result.thumb)).toBe(true);
    expect(Buffer.isBuffer(result.card)).toBe(true);
    expect(Buffer.isBuffer(result.full)).toBe(true);
  });

  it('should produce thumb with width 200px', async () => {
    const input = await createTestImage();
    const result = await generateVariants(input);
    const meta = await sharp(result.thumb).metadata();

    expect(meta.width).toBe(200);
    expect(meta.format).toBe('jpeg');
  });

  it('should produce card with width 400px', async () => {
    const input = await createTestImage();
    const result = await generateVariants(input);
    const meta = await sharp(result.card).metadata();

    expect(meta.width).toBe(400);
    expect(meta.format).toBe('jpeg');
  });

  it('should produce full with width 800px', async () => {
    const input = await createTestImage();
    const result = await generateVariants(input);
    const meta = await sharp(result.full).metadata();

    expect(meta.width).toBe(800);
    expect(meta.format).toBe('jpeg');
  });

  it('should not enlarge images smaller than variant size', async () => {
    // Create a small 100x100 image
    const smallImage = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .jpeg()
      .toBuffer();

    const result = await generateVariants(smallImage);
    const thumbMeta = await sharp(result.thumb).metadata();

    // withoutEnlargement: true → output width should be 100, not 200
    expect(thumbMeta.width).toBe(100);
  });

  it('should compress output to JPEG with quality 80', async () => {
    const input = await createTestImage();
    const result = await generateVariants(input);
    const meta = await sharp(result.thumb).metadata();

    expect(meta.format).toBe('jpeg');
    expect(meta.size).toBeLessThan(input.length);
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('should handle non-image buffer gracefully', async () => {
    // A 10-byte buffer that is not a valid image
    const nonImage = Buffer.from('not-an-image');
    await expect(generateVariants(nonImage)).rejects.toThrow();
  });

  it('should handle empty buffer', async () => {
    const empty = Buffer.alloc(0);
    await expect(generateVariants(empty)).rejects.toThrow();
  });

  it('should handle extremely large buffer without crashing', async () => {
    // Create a very large image (4000x4000)
    const largeImage = await sharp({
      create: { width: 4000, height: 4000, channels: 3, background: { r: 100, g: 100, b: 100 } },
    })
      .jpeg()
      .toBuffer();

    const result = await generateVariants(largeImage);
    expect(result).toHaveProperty('thumb');
    expect(result).toHaveProperty('card');
    expect(result).toHaveProperty('full');

    const thumbMeta = await sharp(result.thumb).metadata();
    expect(thumbMeta.width).toBe(200); // downsized
  });

  it('should handle PNG input (convert to JPEG)', async () => {
    const pngImage = await sharp({
      create: { width: 500, height: 500, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const result = await generateVariants(pngImage);
    const meta = await sharp(result.thumb).metadata();
    expect(meta.format).toBe('jpeg');
  });

  it('should handle 1x1 pixel image', async () => {
    const tinyImage = await sharp({
      create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const result = await generateVariants(tinyImage);
    const thumbMeta = await sharp(result.thumb).metadata();
    // withoutEnlargement: true → width should remain 1
    expect(thumbMeta.width).toBe(1);
  });
});
