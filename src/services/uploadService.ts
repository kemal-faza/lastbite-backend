import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

export interface UploadResult {
  url: string;
  key: string;
}

async function uploadToLocal(file: Express.Multer.File): Promise<UploadResult> {
  const uploadDir = path.resolve(config.upload.localDir);
  await fs.mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.originalname);
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
  const destPath = path.join(uploadDir, filename);

  await fs.writeFile(destPath, file.buffer);

  return { url: `/uploads/${filename}`, key: filename };
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
