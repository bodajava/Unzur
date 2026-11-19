-- Customer photos on reviews (public URLs), up to 4 per review.
ALTER TABLE "reviews" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
