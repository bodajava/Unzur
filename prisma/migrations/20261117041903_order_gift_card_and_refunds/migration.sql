-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "gift_card_id" UUID;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "refunded_piasters" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "orders_gift_card_id_idx" ON "orders"("gift_card_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
