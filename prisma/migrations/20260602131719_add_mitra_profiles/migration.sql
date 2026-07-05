/*
  Warnings:

  - You are about to drop the column `searchVector` on the `products` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- DropIndex
DROP INDEX "products_search_idx";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "searchVector";

-- CreateTable
CREATE TABLE "mitra_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "storeDescription" TEXT,
    "storeAddress" TEXT,
    "storeLat" DOUBLE PRECISION,
    "storeLng" DOUBLE PRECISION,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mitra_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mitra_profiles_userId_key" ON "mitra_profiles"("userId");

-- AddForeignKey
ALTER TABLE "mitra_profiles" ADD CONSTRAINT "mitra_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
