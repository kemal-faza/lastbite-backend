import type { ImageVariants } from '../types/index.js';

/**
 * Derive imageVariants from imageUrl for backward compatibility.
 *
 * - null/undefined input → null
 * - URLs following new convention (ends with /full.jpg or /full) → derive thumb/card/full
 * - Legacy URLs (any other format) → all 3 variants point to the same URL
 *
 * New convention: {baseUrl}/products/{key}/{thumb|card|full}.jpg
 */
export function deriveImageVariants(imageUrl: string | null | undefined): ImageVariants | null {
  if (!imageUrl) return null;

  // Match new key convention: anything ending in /full.jpg or /full
  const fullMatch = imageUrl.match(/^(.*)\/full(?:\.jpg)?$/);
  if (fullMatch) {
    const base = fullMatch[1];
    return {
      thumb: `${base}/thumb.jpg`,
      card: `${base}/card.jpg`,
      full: imageUrl,
    };
  }

  // Legacy data: all 3 variants point to the same URL
  return {
    thumb: imageUrl,
    card: imageUrl,
    full: imageUrl,
  };
}
