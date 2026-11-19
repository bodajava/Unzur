-- Typo-tolerant, Arabic-aware product search.
-- unzur_norm folds the spellings people mix up (أ/إ/آ → ا, ة → ه, ى → ي),
-- drops tashkeel and tatweel, and lowercases Latin letters, so "انضر",
-- "أنظر" and "انظر" compare alike. pg_trgm adds similarity for typos.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION unzur_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT translate(
    regexp_replace(lower(coalesce(t, '')), '[ًٌٍَُِّْـ]', '', 'g'),
    'أإآٱةى',
    'اااايهي'
  )
$$;

CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', unzur_norm(coalesce(NEW.name, '') || ' ' || coalesce(NEW.name_ar, ''))), 'A') ||
    setweight(to_tsvector('simple', unzur_norm(coalesce(NEW.short_description, '') || ' ' || coalesce(NEW.short_description_ar, ''))), 'B') ||
    setweight(to_tsvector('simple', unzur_norm(coalesce(NEW.description, '') || ' ' || coalesce(NEW.description_ar, ''))), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Rebuild every product's vector with the normalised text.
UPDATE "products" SET name = name;

CREATE INDEX IF NOT EXISTS products_name_norm_trgm_idx
  ON "products" USING gin (unzur_norm(coalesce(name, '') || ' ' || coalesce(name_ar, '')) gin_trgm_ops);
