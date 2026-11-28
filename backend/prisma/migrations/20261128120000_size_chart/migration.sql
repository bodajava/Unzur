-- Size chart on a product: { enabled, title, options: [{ label, url }] } (up to 2 photos).
-- IF NOT EXISTS: the server also adds it on start-up (PrismaService), so either may run first.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "size_chart" JSONB;
