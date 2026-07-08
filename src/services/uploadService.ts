import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate 3 variants (thumb/card/full) of an image buffer using sharp.
 * Returns JPEG buffers at configured widths with quality 80.
 * Does not enlarge images smaller than variant width.
 */
export async function generateVariants(
  buffer: Buffer
): Promise<{ thumb: Buffer; card: Buffer; full: Buffer }> {
  const { thumb, card, full, quality } = config.upload.imageVariants;

  const [thumbBuf, cardBuf, fullBuf] = await Promise.all([
    sharp(buffer)
      .resize(thumb, null, { withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer(),
    sharp(buffer)
      .resize(card, null, { withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer(),
    sharp(buffer)
      .resize(full, null, { withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer(),
  ]);

  return { thumb: thumbBuf, card: cardBuf, full: fullBuf };
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

export interface UploadResult {
  url: string;
  key: string;
  variants: {
    thumb: string;
    card: string;
    full: string;
  };
}

async function uploadToLocal(file: Express.Multer.File): Promise<UploadResult> {
  const uploadDir = path.resolve(config.upload.localDir);
  await fs.mkdir(uploadDir, { recursive: true });

  const ext = '.jpg'; // Always save as JPEG after processing
  const baseName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const productDir = path.join(uploadDir, 'products', baseName);
  await fs.mkdir(productDir, { recursive: true });

  // Generate variants from the original buffer
  const variants = await generateVariants(file.buffer);

  // Write all 3 variants in parallel
  await Promise.all([
    fs.writeFile(path.join(productDir, `thumb${ext}`), variants.thumb),
    fs.writeFile(path.join(productDir, `card${ext}`), variants.card),
    fs.writeFile(path.join(productDir, `full${ext}`), variants.full),
  ]);

  return {
    url: `/uploads/products/${baseName}/full${ext}`,
    key: `products/${baseName}`,
    variants: {
      thumb: `/uploads/products/${baseName}/thumb${ext}`,
      card: `/uploads/products/${baseName}/card${ext}`,
      full: `/uploads/products/${baseName}/full${ext}`,
    },
  };
}

async function uploadToS3(file: Express.Multer.File): Promise<UploadResult> {
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

  const ext = path.extname(file.originalname);
  const key = `products/${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;

  await client.send(new PutObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read',
  }));

  const url = s3Config.publicUrl
    ? `${s3Config.publicUrl}/${key}`
    : `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${key}`;

  return { url, key };
}

export async function uploadFile(file: Express.Multer.File): Promise<UploadResult> {
  if (config.upload.provider === 's3') {
    return uploadToS3(file);
  }
  return uploadToLocal(file);
}
