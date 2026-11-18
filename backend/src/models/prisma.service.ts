import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
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
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/** A client usable both outside and inside a transaction (keeps the omit typing). */
export type DbClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];
