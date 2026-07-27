import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET ?? (() => { throw new Error('FATAL: JWT_SECRET environment variable is required'); })(),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? (() => { throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is required'); })(),
  jwtAccessExpiry: '15m' as const,
  jwtRefreshExpiry: '7d' as const,
  otpExpiryMinutes: 5,
  otpLength: 6,
  bcryptSaltRounds: 12,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:8081').split(','),
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'test-project',
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
  upload: {
    provider: (process.env.UPLOAD_PROVIDER || 'local') as 'local' | 's3',
    localDir: process.env.UPLOAD_LOCAL_DIR || 'uploads',
    maxFileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10),
    jsonBodyLimit: process.env.JSON_BODY_LIMIT || '100kb',
    imageVariants: {
      thumb: parseInt(process.env.UPLOAD_VARIANT_THUMB_SIZE || '200', 10),
      card: parseInt(process.env.UPLOAD_VARIANT_CARD_SIZE || '400', 10),
      full: parseInt(process.env.UPLOAD_VARIANT_FULL_SIZE || '800', 10),
      quality: parseInt(process.env.UPLOAD_VARIANT_QUALITY || '80', 10),
    },
    s3: {
      region: process.env.S3_REGION || 'ap-southeast-1',
      bucket: process.env.S3_BUCKET || 'lastbite-uploads',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      endpoint: process.env.S3_ENDPOINT || undefined,
      publicUrl: process.env.S3_PUBLIC_URL || undefined,
    },
  },
} as const;
