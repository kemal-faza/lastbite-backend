import { describe, it, expect } from 'vitest';
import { deriveImageVariants } from '../../src/services/imageVariants.js';

describe('deriveImageVariants', () => {
  it('should return null for null input', () => {
    expect(deriveImageVariants(null)).toBeNull();
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
});
