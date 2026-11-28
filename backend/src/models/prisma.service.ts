import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Secret hashes are omitted from every query by default. Repositories that
 * genuinely need one opt in per query: omit: { passwordHash: false }.
 * Only repositories (models/repositories) may inject this service.
 */
const SECRET_FIELDS_OMIT = {
  user: { passwordHash: true },
  refreshToken: { tokenHash: true },
  otp: { codeHash: true },
} as const;

function createClientOptions(config: ConfigService) {
  return {
    adapter: new PrismaPg({ connectionString: config.getOrThrow<string>('DATABASE_URL') }),
    omit: SECRET_FIELDS_OMIT,
  };
}

/**
 * Additive columns the server applies itself on start-up, before any request
 * (each also has its migration). Production then never depends on someone
 * running `prisma migrate deploy` by hand. Must stay idempotent.
 */
const SCHEMA_PATCHES = [
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "size_chart" JSONB`,
  `ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "choice" TEXT`,
  `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "choice" TEXT`,
  // One cart line per (product, version, choice): the Arabic and the English copy are two lines.
  `CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_id_product_id_variant_id_choice_key" ON "cart_items"("cart_id", "product_id", "variant_id", "choice") NULLS NOT DISTINCT`,
  `DROP INDEX IF EXISTS "cart_items_cart_id_product_id_variant_id_key"`,
];

@Injectable()
export class PrismaService
  extends PrismaClient<ReturnType<typeof createClientOptions>>
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super(createClientOptions(config));
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    for (const sql of SCHEMA_PATCHES) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch (error) {
        new Logger(PrismaService.name).error(`Schema patch failed (${sql}): ${(error as Error).message}`);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/** A client usable both outside and inside a transaction (keeps the omit typing). */
export type DbClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];
