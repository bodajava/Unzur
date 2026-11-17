import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { AddressEntity } from '../schemas/address.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class AddressRepository extends BaseRepository<
  AddressEntity,
  Prisma.AddressWhereInput,
  Prisma.AddressWhereUniqueInput,
  Prisma.AddressUncheckedCreateInput,
  Prisma.AddressUncheckedUpdateInput,
  Prisma.AddressOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.address;
  }

  findForUser(userId: string): Promise<AddressEntity[]> {
    return this.db.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** Only the owner's address (ownership check). */
  findOwned(id: string, userId: string): Promise<AddressEntity | null> {
    return this.db.address.findFirst({ where: { id, userId } });
  }

  /**
   * Makes `addressId` the only default. Call inside a transaction after
   * UserRepository.lockForUpdate(userId), so concurrent switches cannot both win.
   */
  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    await this.db.address.updateMany({
      where: { userId, isDefault: true, id: { not: addressId } },
      data: { isDefault: false },
    });
    await this.db.address.updateMany({ where: { id: addressId, userId }, data: { isDefault: true } });
  }

  findMostRecent(userId: string): Promise<AddressEntity | null> {
    return this.db.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
}
