-- CreateIndex
CREATE INDEX "orders_userId_status_idx" ON "orders"("userId", "status");

-- CreateIndex
CREATE INDEX "products_expiresAt_idx" ON "products"("expiresAt");

-- CreateIndex
CREATE INDEX "products_discountedPrice_idx" ON "products"("discountedPrice");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "products_storeName_idx" ON "products"("storeName");

-- CreateIndex
CREATE INDEX "products_storeLat_storeLng_idx" ON "products"("storeLat", "storeLng");

-- CreateIndex
CREATE INDEX "products_isActive_category_createdAt_idx" ON "products"("isActive", "category", "createdAt" DESC);
