import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { ShippingZoneEntity } from '../schemas/shipping-zone.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class ShippingZoneRepository extends BaseRepository<
  ShippingZoneEntity,
  Prisma.ShippingZoneWhereInput,
  Prisma.ShippingZoneWhereUniqueInput,
  Prisma.ShippingZoneUncheckedCreateInput,
  Prisma.ShippingZoneUncheckedUpdateInput,
  Prisma.ShippingZoneOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.shippingZone;
  }

  /** Active zone by governorate (English key or Arabic name), case-insensitive. */
  findActiveByGovernorate(governorate: string): Promise<ShippingZoneEntity | null> {
    return this.db.shippingZone.findFirst({
      where: {
        isActive: true,
        OR: [
          { governorate: { equals: governorate, mode: 'insensitive' } },
          { nameAr: governorate },
        ],
      },
    });
  }

  findByGovernorateInsensitive(governorate: string, excludeId?: string): Promise<ShippingZoneEntity | null> {
    return this.db.shippingZone.findFirst({
      where: {
        governorate: { equals: governorate, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async hasOrders(id: string): Promise<boolean> {
    return (await this.db.order.count({ where: { shippingZoneId: id }, take: 1 })) > 0;
  }
}
