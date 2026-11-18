import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { ShippingZoneRepository } from '../../models/repositories/shipping-zone.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import type { ShippingZoneEntity } from '../../models/schemas/shipping-zone.schema.js';
import type { DeleteResultModel } from '../../graphql/models/operation-result.model.js';
import { SettingsService } from '../settings/settings.service.js';
import type { CreateShippingZoneDto, UpdateShippingZoneDto } from './dto/index.js';
import type { ShippingRateModel } from './entities/shipping.model.js';

const ENTITY = 'ShippingZone';
const normalizeGovernorate = (value: string) => value.trim().replace(/\s+/g, ' ');

@Injectable()
export class ShippingService {
  constructor(
    private readonly zones: ShippingZoneRepository,
    private readonly settings: SettingsService,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
  ) {}

  // ───────────── 15.1 ─────────────

  async rate(governorate: string, cartSubtotal?: number): Promise<ShippingRateModel> {
    const zone = await this.zones.findActiveByGovernorate(normalizeGovernorate(governorate));
    if (!zone) throw new NotFoundException('We do not deliver to this governorate yet');

    const threshold = await this.settings.freeShippingThreshold();
    const isFreeShipping = threshold !== null && cartSubtotal !== undefined && cartSubtotal >= threshold;
    return {
      zoneId: zone.id,
      governorate: zone.governorate,
      nameAr: zone.nameAr,
      fee: isFreeShipping ? 0 : zone.fee,
      originalFee: zone.fee,
      isFreeShipping,
      freeShippingThreshold: threshold,
      amountToFreeShipping:
        threshold === null || cartSubtotal === undefined ? null : Math.max(0, threshold - cartSubtotal),
      estimatedDays: zone.estimatedDays,
    };
  }

  // ───────────── 15.2 Admin ─────────────

  list(): Promise<ShippingZoneEntity[]> {
    return this.zones.find(undefined, { orderBy: { governorate: 'asc' } });
  }

  async create(dto: CreateShippingZoneDto, audit: AuditContext): Promise<ShippingZoneEntity> {
    const governorate = normalizeGovernorate(dto.governorate);
    await this.assertUnique(governorate);
    return this.tx.run(async (tx) => {
      const zone = await this.zones.withTx(tx).create({
        governorate,
        nameAr: dto.nameAr ?? null,
        fee: dto.fee,
        estimatedDays: dto.estimatedDays,
        isActive: dto.isActive ?? true,
      });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'SHIPPING_ZONE_CREATED',
        entityType: ENTITY,
        entityId: zone.id,
        newValues: zone,
      });
      return zone;
    });
  }

  async update(id: string, dto: UpdateShippingZoneDto, audit: AuditContext): Promise<ShippingZoneEntity> {
    const existing = await this.get(id);
    const governorate = dto.governorate ? normalizeGovernorate(dto.governorate) : undefined;
    if (governorate) await this.assertUnique(governorate, id);

    return this.tx.run(async (tx) => {
      const zone = await this.zones.withTx(tx).updateById(id, {
        governorate,
        nameAr: dto.nameAr,
        fee: dto.fee,
        estimatedDays: dto.estimatedDays,
        isActive: dto.isActive,
      });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'SHIPPING_ZONE_UPDATED',
        entityType: ENTITY,
        entityId: id,
        oldValues: existing,
        newValues: zone,
      });
      return zone;
    });
  }

  /** Zones used by orders are deactivated so order history keeps them. */
  async remove(id: string, audit: AuditContext): Promise<DeleteResultModel> {
    const existing = await this.get(id);
    const used = await this.zones.hasOrders(id);
    await this.tx.run(async (tx) => {
      if (used) await this.zones.withTx(tx).updateById(id, { isActive: false });
      else await this.zones.withTx(tx).delete({ id });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: used ? 'SHIPPING_ZONE_DEACTIVATED' : 'SHIPPING_ZONE_DELETED',
        entityType: ENTITY,
        entityId: id,
        oldValues: existing,
      });
    });
    return used
      ? { id, deleted: false, deactivated: true, reason: 'Orders use this zone, so it was deactivated' }
      : { id, deleted: true };
  }

  private async get(id: string): Promise<ShippingZoneEntity> {
    const zone = await this.zones.findById(id);
    if (!zone) throw new NotFoundException('Shipping zone not found');
    return zone;
  }

  private async assertUnique(governorate: string, excludeId?: string): Promise<void> {
    if (await this.zones.findByGovernorateInsensitive(governorate, excludeId)) {
      throw new ConflictException('A shipping zone for this governorate already exists');
    }
  }
}
