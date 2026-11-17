import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { StoreSettingEntity } from '../schemas/store-setting.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class StoreSettingRepository extends BaseRepository<
  StoreSettingEntity,
  Prisma.StoreSettingWhereInput,
  Prisma.StoreSettingWhereUniqueInput,
  Prisma.StoreSettingUncheckedCreateInput,
  Prisma.StoreSettingUncheckedUpdateInput,
  Prisma.StoreSettingOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.storeSetting;
  }

  findPublic(): Promise<StoreSettingEntity[]> {
    return this.db.storeSetting.findMany({ where: { isPublic: true }, orderBy: { key: 'asc' } });
  }

  findByKeys(keys: string[]): Promise<StoreSettingEntity[]> {
    return this.db.storeSetting.findMany({ where: { key: { in: keys } } });
  }

  /** null is stored as JSON null (the column itself is NOT NULL). */
  upsertByKey(key: string, raw: unknown, isPublic: boolean | undefined): Promise<StoreSettingEntity> {
    const value = raw === null ? Prisma.JsonNull : (raw as Prisma.InputJsonValue);
    return this.db.storeSetting.upsert({
      where: { key },
      create: { key, value, isPublic: isPublic ?? false },
      update: { value, ...(isPublic === undefined ? {} : { isPublic }) },
    });
  }
}
