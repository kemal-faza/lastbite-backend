# LastBite Backend

REST API LastBite — marketplace makanan/minuman menjelang kedaluwarsa. Express + Prisma,
PostgreSQL, TypeScript ESM. Spesifikasi API di `/docs` (Swagger UI) dan `/openapi.json`.

## Quick start

```bash
cp .env.example .env               # isi DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npm install
npx prisma migrate deploy
npm run dev                        # localhost:4000
```

`JWT_SECRET` dan `JWT_REFRESH_SECRET` wajib diisi — server fatal saat startup jika kosong.

## Commands

`npm run dev` — `tsx watch src/index.ts`, reload otomatis.  
`npm run build` — `tsc --strict`, type-check dan emit ke `dist/`.  
`npm start` — jalankan `node dist/index.js` (wajib build dulu).  
`npm test` — `vitest run` semua test. Jalankan satu file: `npx vitest run tests/auth/login.test.ts`.  
`npm run docs:validate` — lint `openapi.yaml`.

**Database**  
`npm run db:migrate` — `prisma migrate dev` (skema baru / development).  
`npm run db:generate` — `prisma generate` (setelah ubah schema.prisma).  
`npm run db:seed` — isi data awal (`tsx prisma/seed.ts`).  
`npm run db:refresh` — reset database, jalankan ulang semua migrasi.  
`npm run db:studio` — Prisma Studio GUI.

## Testing

Test menargetkan PostgreSQL asli, bukan in-memory. `DATABASE_URL` dibaca dari `.env.test`
(default: `lastbite_test` di localhost).

**Sebelum test pertama**, migrasi skema ke database test:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lastbite_test" \
  npx prisma migrate deploy
npm test
```

`tests/setup.ts` hanya truncate tabel antar test — ia tidak membuat skema. Test berjalan
berurutan (`fileParallelism: false`) karena berbagi satu database. Vitest menyetel
`AUTH_RATE_LIMIT_MAX=200` agar test auth tidak kena rate limiter.

## API

Spesifikasi dipertahankan manual di `openapi.yaml` — setiap perubahan route dicerminkan
ke file tersebut. Semua respons error berbentuk `{ error, code }`. Gunakan `AppError`
(`errors/AppError.ts`) untuk error domain.

Buat HTML statis untuk dibagikan: `npx redocly build-docs openapi.yaml -o docs/api.html`.

`http://localhost:4000`

| Prefix | |
|---|---|
| `/auth` | Register, login, OTP verifikasi, refresh token |
| `/users` | Profil pengguna |
| `/products` | Katalog, pencarian, proximity |
| `/cart` | Keranjang |
| `/orders` | Pesanan & checkout |
| `/uploads` | Upload gambar (multipart) |
| `/mitra` | Profil, produk, & lokasi mitra |
| `/mitra/analytics` | Dashboard analitik mitra |
| `/devices` | Token perangkat FCM |
| `/notifications` | Push notification & inbox |
| `/wishlist-subscriptions` | Langganan stok produk |
| `/reviews` | Ulasan & rating |
| `/admin` | Verifikasi mitra, audit log, kelola platform |
| `/health` | `{ status: "ok" }` |

`/auth` dirate-limit 10 request per menit per IP (env: `AUTH_RATE_LIMIT_MAX`).

## Project layout

```
src/
  index.ts          entrypoint — buat app & jalankan background job
  app.ts            mount middleware, route, Swagger UI
  config.ts         parsing environment variables
  routes/           handler Express
  services/         logika bisnis
  validators/       skema request (Zod)
  middleware/        auth, contentType, errorHandler, upload
  lib/              prisma client, jwt, bcrypt, FCM
  jobs/             cron — batalkan pesanan kedaluwarsa (tiap 5 menit)
  errors/           AppError
prisma/
  schema.prisma     model database
  migrations/       file migrasi SQL
  seed.ts           data awal
scripts/            one-time scripts — `npx tsx scripts/…`
tests/              integrasi, vitest, butuh PostgreSQL
openapi.yaml        kontrak API
```

## Environment

`.env.example` adalah file referensi lengkap. Di bawah ini yang paling sering disentuh:

| | | |
|---|---|---|
| `DATABASE_URL` | — | Koneksi PostgreSQL |
| `JWT_SECRET` | — | Wajib. String acak, ≥64 karakter |
| `JWT_REFRESH_SECRET` | — | Wajib. Berbeda dari `JWT_SECRET` |
| `PORT` | `4000` | |
| `UPLOAD_PROVIDER` | `local` | `local` atau `s3` |
| `UPLOAD_LOCAL_DIR` | `uploads` | Hanya jika provider `local` |
| `UPLOAD_MAX_SIZE` | `5242880` | Byte |
| `UPLOAD_VARIANT_THUMB_SIZE` | `200` | px |
| `UPLOAD_VARIANT_CARD_SIZE` | `400` | px |
| `UPLOAD_VARIANT_FULL_SIZE` | `800` | px |
| `UPLOAD_VARIANT_QUALITY` | `80` | Kompresi JPEG |
| `S3_REGION` | — | |
| `S3_BUCKET` | — | |
| `S3_ACCESS_KEY_ID` | — | |
| `S3_SECRET_ACCESS_KEY` | — | |
| `S3_ENDPOINT` | — | Untuk DO Spaces, MinIO, dsb. |
| `S3_PUBLIC_URL` | — | URL CDN / public bucket |
| `GOOGLE_MAPS_API_KEY` | — | |
| `FIREBASE_PROJECT_ID` | `test-project` | Isi `test-project` untuk mock push |
| `FIREBASE_SERVICE_ACCOUNT` | — | JSON service account key |
| `AUTH_RATE_LIMIT_MAX` | `10` | Maks req `/auth`/menit/IP |
| `CORS_ORIGINS` | `localhost:3000,localhost:8081` | Pisah koma |

## Notes

- Semua teks tampil ke pengguna dan pesan error dalam Bahasa Indonesia.
- Tidak ada ESLint / Prettier. Gerbang kualitas: `tsc --strict`.
- `POST` / `PUT` / `PATCH` dengan body wajib `Content-Type: application/json`.
  Multipart upload dikecualikan. Middleware mengembalikan 415 jika tidak sesuai.
- Arsitektur: `routes → services → Prisma`. Validasi request di `validators/`.
