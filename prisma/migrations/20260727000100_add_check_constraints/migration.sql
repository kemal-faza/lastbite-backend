-- Add DB-level CHECK constraints (defense-in-depth). The application already validates these
-- via Zod, but the database enforced nothing. Verified on 2026-07-27: 0 existing rows violate.
--
-- NOTE: these are additive safety nets. If business logic changes, adjust both the app validators
-- and these constraints together.

-- reviews.rating must be 1..5
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5);

-- products: prices and stock must be non-negative, and discountedPrice cannot exceed originalPrice
ALTER TABLE "products"
  ADD CONSTRAINT "products_prices_check" CHECK (
    "originalPrice" >= 0
    AND "discountedPrice" >= 0
    AND "stock" >= 0
    AND "discountedPrice" <= "originalPrice"
  );

-- orders: monetary amounts must be non-negative
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_check" CHECK ("totalAmount" >= 0 AND "savingAmount" >= 0);

-- cart_items / order_items: quantity must be positive
ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_check" CHECK ("quantity" > 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0);

-- search_queries: count must be positive
ALTER TABLE "search_queries"
  ADD CONSTRAINT "search_queries_count_check" CHECK ("count" > 0);
