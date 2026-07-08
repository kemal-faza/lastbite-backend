import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/lib/prisma.js';
import { generateVariants } from '../src/services/uploadService.js';
import { config } from '../src/config.js';

/**
 * One-time migration: generate variants for existing image uploads.
 *
 * Run: npx tsx scripts/migrate-images.ts [--dry-run]
 *
 * For each product with imageUrl but no variants:
 * - Local mode: read file from localDir, generate variants, write to products/{key}/
 * - S3 mode: download from S3, generate variants, upload back
 *
 * Idempotent: skips products that already have a /full.jpg in the new convention.
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`[migrate] Starting migration (${dryRun ? 'DRY RUN' : 'LIVE'})`);
  console.log(`[migrate] Provider: ${config.upload.provider}`);

  const products = await prisma.product.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, name: true, imageUrl: true },
  });

  console.log(`[migrate] Found ${products.length} products with images`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of products) {
    if (!product.imageUrl) continue;

    // Skip if already in new convention (ends with /full.jpg or /full)
    if (/\/full(?:\.jpg)?$/.test(product.imageUrl)) {
      console.log(`[migrate] SKIP ${product.id} (${product.name}): already migrated`);
      skipped++;
      continue;
    }

    try {
      if (config.upload.provider === 'local') {
        await migrateLocal(product.imageUrl, product.id, product.name, dryRun);
      } else {
        await migrateS3(product.imageUrl, product.id, product.name, dryRun);
      }
      migrated++;
    } catch (err) {
      console.error(`[migrate] FAIL ${product.id} (${product.name}):`, err);
      failed++;
    }
  }

  console.log(`[migrate] Done. Migrated: ${migrated}, Skipped: ${skipped}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function migrateLocal(imageUrl: string, productId: string, productName: string, dryRun: boolean) {
  // imageUrl format: /uploads/1700000000-abc.jpg or /uploads/abc.jpg
  const filename = path.basename(imageUrl); // e.g. 1700000000-abc.jpg
  const sourcePath = path.resolve(config.upload.localDir, filename);

  console.log(`[migrate] Processing ${productId} (${productName}): ${filename}`);

  if (dryRun) {
    console.log(`[migrate]   DRY RUN: would read ${sourcePath} and create variants`);
    return;
  }

  const buffer = await fs.readFile(sourcePath);
  const variants = await generateVariants(buffer);

  const baseName = filename.replace(/\.[^.]+$/, ''); // strip extension
  const productDir = path.resolve(config.upload.localDir, 'products', baseName);
  await fs.mkdir(productDir, { recursive: true });

  await Promise.all([
    fs.writeFile(path.join(productDir, 'thumb.jpg'), variants.thumb),
    fs.writeFile(path.join(productDir, 'card.jpg'), variants.card),
    fs.writeFile(path.join(productDir, 'full.jpg'), variants.full),
  ]);

  console.log(`[migrate]   Created: ${productDir}/thumb.jpg, card.jpg, full.jpg`);
  // Note: we do NOT delete the original file. The product.imageUrl still points to it.
  // deriveImageVariants() will handle the fallback to the original URL.
}

async function migrateS3(imageUrl: string, productId: string, productName: string, dryRun: boolean) {
  const { S3Client, GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');

  console.log(`[migrate] Processing ${productId} (${productName}): ${imageUrl}`);

  if (dryRun) {
    console.log(`[migrate]   DRY RUN: would download and re-upload variants`);
    return;
  }

  const s3Config = config.upload.s3;
  const client = new S3Client({
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
    },
    ...(s3Config.endpoint ? { endpoint: s3Config.endpoint, forcePathStyle: true } : {}),
  });

  // Extract key from URL
  const url = new URL(imageUrl);
  const oldKey = url.pathname.slice(1); // strip leading /

  // Download original
  const getRes = await client.send(new GetObjectCommand({
    Bucket: s3Config.bucket,
    Key: oldKey,
  }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of getRes.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // Generate variants
  const variants = await generateVariants(buffer);

  // Upload variants
  const baseKey = `products/${path.basename(oldKey, path.extname(oldKey))}`;
  const baseUrl = s3Config.publicUrl || `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com`;

  await Promise.all([
    client.send(new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: `${baseKey}/thumb.jpg`,
      Body: variants.thumb,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    })),
    client.send(new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: `${baseKey}/card.jpg`,
      Body: variants.card,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    })),
    client.send(new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: `${baseKey}/full.jpg`,
      Body: variants.full,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    })),
  ]);

  console.log(`[migrate]   Uploaded: ${baseUrl}/${baseKey}/{thumb,card,full}.jpg`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] Fatal error:', err);
    process.exit(1);
  });
