import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/lib/prisma.js';
import { generateVariants } from '../src/services/uploadService.js';
import { config } from '../src/config.js';

const S3_PUBLIC_URL = config.upload.s3.publicUrl || `https://${config.upload.s3.bucket}.s3.${config.upload.s3.region}.amazonaws.com`;

/**
 * One-time migration: upload existing local images + variants to DO Spaces
 * and update product.imageUrl in database.
 *
 * Steps per product:
 *   1. Skip if imageUrl already contains "digitaloceanspaces.com" (already migrated)
 *   2. Read original file from local uploads/ directory
 *   3. Generate 3 variants (thumb/card/full) via sharp
 *   4. Upload all 3 variants to DO Spaces at products/{key}/{variant}.jpg
 *   5. Update product.imageUrl to point to DO Spaces full variant URL
 *
 * Run: npx tsx scripts/migrate-to-do.ts [--dry-run]
 * Idempotent: skips products already pointing to DO Spaces.
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`[migrate-to-do] Starting migration (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  const products = await prisma.product.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, name: true, imageUrl: true },
  });

  console.log(`[migrate-to-do] Found ${products.length} products with images`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of products) {
    if (!product.imageUrl) continue;

    // Skip if already on DO Spaces
    if (product.imageUrl.includes('digitaloceanspaces.com')) {
      console.log(`[migrate-to-do] SKIP ${product.id} (${product.name}): already on DO Spaces`);
      skipped++;
      continue;
    }

    try {
      await migrateProduct(product.id, product.name, product.imageUrl, dryRun);
      migrated++;
    } catch (err) {
      console.error(`[migrate-to-do] FAIL ${product.id} (${product.name}):`, err);
      failed++;
    }
  }

  console.log(`[migrate-to-do] Done. Migrated: ${migrated}, Skipped: ${skipped}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

async function migrateProduct(productId: string, productName: string, imageUrl: string, dryRun: boolean) {
  // Determine local file path from imageUrl
  // Legacy format: /uploads/mie_ayam.png → read from uploads/mie_ayam.png
  // New convention: /uploads/products/{key}/full.jpg → read from uploads/products/{key}/full.jpg
  let sourcePath: string;
  let fileBase: string;

  const newConventionMatch = imageUrl.match(/^\/uploads\/products\/([^/]+)\/full\.jpg$/);
  if (newConventionMatch) {
    fileBase = newConventionMatch[1];
    sourcePath = path.resolve(config.upload.localDir, 'products', fileBase, 'full.jpg');
  } else {
    // Legacy: /uploads/filename.ext
    const filename = path.basename(imageUrl);
    fileBase = filename.replace(/\.[^.]+$/, '');
    sourcePath = path.resolve(config.upload.localDir, filename);
  }

  console.log(`[migrate-to-do] Processing ${productId} (${productName}): ${path.basename(imageUrl)}`);

  if (dryRun) {
    console.log(`[migrate-to-do]   DRY RUN: would read ${sourcePath}, generate variants, upload to DO Spaces, update DB`);
    return;
  }

  // Read original file
  const buffer = await fs.readFile(sourcePath);
  console.log(`[migrate-to-do]   Read ${sourcePath} (${(buffer.length / 1024).toFixed(1)} KB)`);

  // Generate 3 variants
  const variants = await generateVariants(buffer);
  console.log(`[migrate-to-do]   Generated variants: thumb(${variants.thumb.length}B), card(${variants.card.length}B), full(${variants.full.length}B)`);

  // Upload to DO Spaces
  const key = `products/${fileBase}`;

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3Config = config.upload.s3;

  const client = new S3Client({
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
    },
    ...(s3Config.endpoint ? { endpoint: s3Config.endpoint, forcePathStyle: true } : {}),
  });

  await Promise.all([
    client.send(new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: `${key}/thumb.jpg`,
      Body: variants.thumb,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable',
    })),
    client.send(new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: `${key}/card.jpg`,
      Body: variants.card,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable',
    })),
    client.send(new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: `${key}/full.jpg`,
      Body: variants.full,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable',
    })),
  ]);

  const newImageUrl = `${S3_PUBLIC_URL}/${key}/full.jpg`;
  console.log(`[migrate-to-do]   Uploaded to DO Spaces: ${S3_PUBLIC_URL}/${key}/{thumb,card,full}.jpg`);

  // Update database
  await prisma.product.update({
    where: { id: productId },
    data: { imageUrl: newImageUrl },
  });
  console.log(`[migrate-to-do]   Updated DB: imageUrl = ${newImageUrl}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate-to-do] Fatal error:', err);
    process.exit(1);
  });
