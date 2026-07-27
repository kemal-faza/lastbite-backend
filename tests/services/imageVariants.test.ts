import { describe, it, expect } from 'vitest';
import { deriveImageVariants } from '../../src/services/imageVariants.js';
import { longString } from '../support/edgeCases.js';

describe('deriveImageVariants', () => {
  it('should return null for null input', () => {
    expect(deriveImageVariants(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(deriveImageVariants(undefined)).toBeNull();
  });

  it('should return all 3 variants pointing to same URL for legacy data', () => {
    const url = '/uploads/1700000000-abc.jpg';
    const result = deriveImageVariants(url);

    expect(result).toEqual({
      thumb: url,
      card: url,
      full: url,
    });
  });

  it('should preserve absolute legacy URLs unchanged (not ending with /full.jpg)', () => {
    const url = 'https://lastbite-uploads.sgp1.cdn.digitaloceanspaces.com/uploads/1700000000-abc.jpg';
    const result = deriveImageVariants(url);

    expect(result).toEqual({
      thumb: url,
      card: url,
      full: url,
    });
  });

  it('should derive from new key convention with full suffix', () => {
    const url = '/uploads/products/1700000000-abc/full.jpg';
    const result = deriveImageVariants(url);

    expect(result?.thumb).toBe('/uploads/products/1700000000-abc/thumb.jpg');
    expect(result?.card).toBe('/uploads/products/1700000000-abc/card.jpg');
    expect(result?.full).toBe('/uploads/products/1700000000-abc/full.jpg');
  });

  it('should derive from S3 key convention with full suffix', () => {
    const url = 'https://lastbite-uploads.sgp1.cdn.digitaloceanspaces.com/products/1700000000-abc/full.jpg';
    const result = deriveImageVariants(url);

    expect(result?.thumb).toBe('https://lastbite-uploads.sgp1.cdn.digitaloceanspaces.com/products/1700000000-abc/thumb.jpg');
    expect(result?.card).toBe('https://lastbite-uploads.sgp1.cdn.digitaloceanspaces.com/products/1700000000-abc/card.jpg');
    expect(result?.full).toBe('https://lastbite-uploads.sgp1.cdn.digitaloceanspaces.com/products/1700000000-abc/full.jpg');
  });

  // ── Edge cases ──────────────────────────────────────────────────

  it('should return null for empty string (falsy)', () => {
    const result = deriveImageVariants('');
    expect(result).toBeNull();
  });

  it('should derive variants from URL ending with /full (without .jpg)', () => {
    const url = '/uploads/products/1700000000-abc/full';
    const result = deriveImageVariants(url);

    expect(result?.thumb).toBe('/uploads/products/1700000000-abc/thumb.jpg');
    expect(result?.card).toBe('/uploads/products/1700000000-abc/card.jpg');
    expect(result?.full).toBe('/uploads/products/1700000000-abc/full');
  });

  it('should handle non-image URL extensions in legacy mode', () => {
    const url = '/uploads/1700000000-abc.png';
    const result = deriveImageVariants(url);
    // Legacy: all 3 variants point to same URL
    expect(result).toEqual({ thumb: url, card: url, full: url });
  });

  it('should handle very long URL', () => {
    const longUrl = `/uploads/products/${longString(500)}/full.jpg`;
    const result = deriveImageVariants(longUrl);
    expect(result).not.toBeNull();
    expect(result?.thumb).toContain('/thumb.jpg');
    expect(result?.card).toContain('/card.jpg');
    expect(result?.full).toBe(longUrl);
  });

  it('should handle URL with special characters', () => {
    const url = '/uploads/products/product_123-456@789/full.jpg';
    const result = deriveImageVariants(url);
    expect(result?.thumb).toBe('/uploads/products/product_123-456@789/thumb.jpg');
    expect(result?.card).toBe('/uploads/products/product_123-456@789/card.jpg');
    expect(result?.full).toBe(url);
  });

  it('should handle nested subdirectory URLs', () => {
    const url = '/uploads/products/2024/01/15/abc123/full.jpg';
    const result = deriveImageVariants(url);
    expect(result?.thumb).toBe('/uploads/products/2024/01/15/abc123/thumb.jpg');
    expect(result?.card).toBe('/uploads/products/2024/01/15/abc123/card.jpg');
    expect(result?.full).toBe(url);
  });
});
