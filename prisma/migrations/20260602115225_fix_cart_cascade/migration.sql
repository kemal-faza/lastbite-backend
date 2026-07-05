/*
  Warnings:

  - You are about to drop the column `searchVector` on the `products` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_productId_fkey";

-- DropIndex
DROP INDEX "products_search_idx";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "searchVector";

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
