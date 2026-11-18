-- Arabic copy for the catalog (optional; English stays the fallback)
ALTER TABLE "categories" ADD COLUMN "name_ar" TEXT, ADD COLUMN "description_ar" TEXT;
ALTER TABLE "products" ADD COLUMN "name_ar" TEXT, ADD COLUMN "short_description_ar" TEXT, ADD COLUMN "description_ar" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "name_ar" TEXT;
ALTER TABLE "order_items" ADD COLUMN "product_name_ar" TEXT, ADD COLUMN "variant_name_ar" TEXT;

-- Search finds products by their Arabic names and copy too.
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '') || ' ' || coalesce(NEW.name_ar, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.short_description, '') || ' ' || coalesce(NEW.short_description_ar, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '') || ' ' || coalesce(NEW.description_ar, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_search_vector_trigger ON "products";
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, short_description, description, name_ar, short_description_ar, description_ar
  ON "products"
  FOR EACH ROW
  EXECUTE FUNCTION products_search_vector_update();
