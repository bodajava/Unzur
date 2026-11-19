import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { CacheService } from '../../common/utilities/caching/cache.service.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { StoreSettingRepository } from '../../models/repositories/store-setting.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import type { StoreSettingEntity } from '../../models/schemas/store-setting.schema.js';
import type { UpdateSettingsDto } from './dto/index.js';
import { SettingKey, settingValueError } from './setting-rules.js';

const PUBLIC_CACHE_KEY = 'settings:public';
const PUBLIC_CACHE_TTL = 300;

@Injectable()
export class SettingsService {
  constructor(
    private readonly settings: StoreSettingRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly cache: CacheService,
  ) {}

  /** 15.3 { key: value } for isPublic settings (cached 5 min, cleared on change). */
  publicMap(): Promise<Record<string, unknown>> {
    return this.cache.wrap(PUBLIC_CACHE_KEY, PUBLIC_CACHE_TTL, async () =>
      Object.fromEntries((await this.settings.findPublic()).map((s) => [s.key, s.value])),
    );
  }

  /** Free-shipping threshold in piasters, or null when not configured. */
  async freeShippingThreshold(): Promise<number | null> {
    const value = (await this.publicMap())[SettingKey.FREE_SHIPPING_THRESHOLD];
    return Number.isInteger(value) ? (value as number) : null;
  }

  /** A numeric setting (public or private), or the fallback when unset/invalid. */
  async getInt(key: string, fallback: number): Promise<number> {
    const [row] = await this.settings.findByKeys([key]);
    return Number.isInteger(row?.value) ? (row!.value as number) : fallback;
  }

  async getBool(key: string, fallback: boolean): Promise<boolean> {
    const [row] = await this.settings.findByKeys([key]);
    return typeof row?.value === 'boolean' ? row.value : fallback;
  }

  /** Any JSON setting (public or private), or null when unset. */
  async getJson<T>(key: string): Promise<T | null> {
    const [row] = await this.settings.findByKeys([key]);
    return (row?.value as T | undefined) ?? null;
  }

  async getString(key: string): Promise<string | null> {
    const [row] = await this.settings.findByKeys([key]);
    return typeof row?.value === 'string' && row.value.trim() ? row.value.trim() : null;
  }

  /** 15.4 */
  listAll(): Promise<StoreSettingEntity[]> {
    return this.settings.find(undefined, { orderBy: { key: 'asc' } });
  }

  /** 15.4 Bulk upsert in one transaction, one audit row per changed key. */
  async upsertMany(dto: UpdateSettingsDto, audit: AuditContext): Promise<StoreSettingEntity[]> {
    const keys = dto.settings.map((s) => s.key);
    if (new Set(keys).size !== keys.length) throw new BadRequestException('Duplicate keys in settings');
    const errors = dto.settings.map((s) => settingValueError(s.key, s.value)).filter((e): e is string => !!e);
    if (errors.length) throw new BadRequestException({ message: 'Invalid settings', errors });

    const before = new Map((await this.settings.findByKeys(keys)).map((s) => [s.key, s]));
    const saved = await this.tx.run(async (tx) => {
      const rows: StoreSettingEntity[] = [];
      for (const input of dto.settings) {
        const row = await this.settings
          .withTx(tx)
          .upsertByKey(input.key, input.value, input.isPublic);
        const old = before.get(input.key);
        await this.auditLogs.withTx(tx).record({
          ...audit,
          action: old ? 'SETTING_UPDATED' : 'SETTING_CREATED',
          entityType: 'StoreSetting',
          entityId: row.id,
          oldValues: old ? { key: old.key, value: old.value, isPublic: old.isPublic } : undefined,
          newValues: { key: row.key, value: row.value, isPublic: row.isPublic },
        });
        rows.push(row);
      }
      return rows;
    });
    await this.cache.del(PUBLIC_CACHE_KEY);
    return saved;
  }
}
