-- CreateEnum
CREATE TYPE "Category" AS ENUM ('meals', 'bakery', 'drinks');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FOOD_SAVER', 'MITRA');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'FOOD_SAVER';

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "Category" NOT NULL,
    "originalPrice" INTEGER NOT NULL,
    "discountedPrice" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "storeName" TEXT NOT NULL,
    "storeAddress" TEXT,
    "storeLat" DOUBLE PRECISION,
    "storeLng" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "mitraId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_mitraId_idx" ON "products"("mitraId");

-- CreateIndex
CREATE INDEX "products_isActive_idx" ON "products"("isActive");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_mitraId_fkey" FOREIGN KEY ("mitraId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
