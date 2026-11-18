-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "gift_card_id" UUID,
ALTER COLUMN "order_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "payments_gift_card_id_idx" ON "payments"("gift_card_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A payment belongs to exactly one thing: an order or a gift card purchase.
ALTER TABLE "payments" ADD CONSTRAINT "payments_target_check" CHECK (num_nonnulls("order_id", "gift_card_id") = 1);
