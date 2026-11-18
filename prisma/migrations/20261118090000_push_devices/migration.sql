-- CreateTable
CREATE TABLE "push_devices" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" UUID,
    "guest_id" TEXT,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "lang" TEXT NOT NULL DEFAULT 'ar',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");

-- CreateIndex
CREATE INDEX "push_devices_user_id_idx" ON "push_devices"("user_id");

-- CreateIndex
CREATE INDEX "push_devices_guest_id_idx" ON "push_devices"("guest_id");

-- CreateIndex
CREATE INDEX "push_devices_is_staff_idx" ON "push_devices"("is_staff");

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
