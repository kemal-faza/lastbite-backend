import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Static validation of seed.ts imageUrl values.
// Tests the seed file directly rather than the database to avoid interference
// from the global test setup's beforeEach (which clears all data).

describe('Seed Image URLs', () => {
  it('all product imageUrls in seed file should reference existing upload files', () => {
    const seedContent = fs.readFileSync('prisma/seed.ts', 'utf-8');

    // Match all imageUrl assignments in getDefaultProducts()
    const imageUrlRegex = /imageUrl:\s*"(\/[^"]+)"/g;
    const matches = Array.from(seedContent.matchAll(imageUrlRegex));

    expect(matches.length).toBe(8);

    const uploadsDir = path.resolve('uploads');

    for (const match of matches) {
      const imageUrl = match[1];
      // imageUrl must start with /uploads/
      expect(
        imageUrl,
        `imageUrl "${imageUrl}" must start with /uploads/`
      ).toMatch(/^\/uploads\//);

      const filename = imageUrl.replace('/uploads/', '');
      const filePath = path.join(uploadsDir, filename);
      expect(
        fs.existsSync(filePath),
        `file "${filename}" must exist in uploads/`
      ).toBe(true);
    }
  });

  it('should have exactly 8 products with imageUrl', () => {
    const seedContent = fs.readFileSync('prisma/seed.ts', 'utf-8');
    const imageUrlRegex = /imageUrl:\s*"(\/[^"]+)"/g;
    const matches = Array.from(seedContent.matchAll(imageUrlRegex));
    expect(matches.length).toBe(8);
  });
});
