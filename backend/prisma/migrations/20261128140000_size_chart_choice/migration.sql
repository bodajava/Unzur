-- The size-chart choice a customer picks (e.g. "عربي" / "English") on cart and order lines.
-- IF [NOT] EXISTS: the server also applies these on start-up (PrismaService), so either may run first.
ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "choice" TEXT;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "choice" TEXT;

-- One cart line per (product, version, choice); NULLS NOT DISTINCT keeps (cart, product, NULL, NULL) unique.
CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_id_product_id_variant_id_choice_key" ON "cart_items"("cart_id", "product_id", "variant_id", "choice") NULLS NOT DISTINCT;
DROP INDEX IF EXISTS "cart_items_cart_id_product_id_variant_id_key";
