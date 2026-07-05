-- Add GIN index for full-text search
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Create or replace function to update search vector
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('indonesian', COALESCE(NEW."name", '')), 'A') ||
    setweight(to_tsvector('indonesian', COALESCE(NEW."description", '')), 'B') ||
    setweight(to_tsvector('indonesian', COALESCE(NEW."storeName", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS products_search_vector_trigger ON "products";
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "products"
  FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();

-- Create GIN index
CREATE INDEX IF NOT EXISTS products_search_idx ON "products" USING GIN ("searchVector");

-- Backfill existing rows
UPDATE "products" SET "searchVector" =
  setweight(to_tsvector('indonesian', COALESCE("name", '')), 'A') ||
  setweight(to_tsvector('indonesian', COALESCE("description", '')), 'B') ||
  setweight(to_tsvector('indonesian', COALESCE("storeName", '')), 'C');
