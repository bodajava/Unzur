-- One review per customer per product (12.2 returns 409 on a second one).
CREATE UNIQUE INDEX "reviews_user_id_product_id_key" ON "reviews"("user_id", "product_id");
