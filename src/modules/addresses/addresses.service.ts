import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizePhone } from '../../common/utilities/phone.js';
import { AddressRepository } from '../../models/repositories/address.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import { UserRepository } from '../../models/repositories/user.repository.js';
import type { AddressEntity } from '../../models/schemas/address.schema.js';
import type { CreateAddressDto, UpdateAddressDto } from './dto/index.js';

export const MAX_ADDRESSES = 20;

/**
 * Address book (10.3–10.7). Every change that touches isDefault runs in a
 * transaction holding the user row lock, so there is always at most one default.
 */
@Injectable()
export class AddressesService {
  constructor(
    private readonly addresses: AddressRepository,
    private readonly users: UserRepository,
    private readonly tx: TransactionManager,
  ) {}

  list(userId: string): Promise<AddressEntity[]> {
    return this.addresses.findForUser(userId);
  }

  async create(userId: string, dto: CreateAddressDto): Promise<AddressEntity> {
    return this.tx.run(async (tx) => {
      await this.users.withTx(tx).lockForUpdate(userId);
      const repo = this.addresses.withTx(tx);
      const count = await repo.count({ userId });
      if (count >= MAX_ADDRESSES) throw new BadRequestException(`You can save up to ${MAX_ADDRESSES} addresses`);
      const { isDefault, ...fields } = dto;
      const created = await repo.create({ ...fields, phone: normalizePhone(dto.phone), userId, isDefault: false });
      // The first address is always the default.
      if (isDefault || count === 0) await repo.setDefaultAddress(userId, created.id);
      return (await repo.findById(created.id))!;
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto): Promise<AddressEntity> {
    return this.tx.run(async (tx) => {
      await this.users.withTx(tx).lockForUpdate(userId);
      const repo = this.addresses.withTx(tx);
      if (!(await repo.findOwned(id, userId))) throw new NotFoundException('Address not found');
      const { isDefault, ...fields } = dto;
      await repo.updateById(id, { ...fields, ...(dto.phone ? { phone: normalizePhone(dto.phone) } : {}) });
      if (isDefault) await repo.setDefaultAddress(userId, id);
      return (await repo.findById(id))!;
    });
  }

  /** Deleting the default promotes the most recent remaining address. */
  async remove(userId: string, id: string): Promise<{ id: string; deleted: true; newDefaultId: string | null }> {
    return this.tx.run(async (tx) => {
      await this.users.withTx(tx).lockForUpdate(userId);
      const repo = this.addresses.withTx(tx);
      const address = await repo.findOwned(id, userId);
      if (!address) throw new NotFoundException('Address not found');
      await repo.delete({ id });
      let newDefaultId: string | null = null;
      if (address.isDefault) {
        const next = await repo.findMostRecent(userId);
        if (next) {
          await repo.setDefaultAddress(userId, next.id);
          newDefaultId = next.id;
        }
      }
      return { id, deleted: true, newDefaultId };
    });
  }

  async setDefault(userId: string, id: string): Promise<AddressEntity> {
    return this.tx.run(async (tx) => {
      await this.users.withTx(tx).lockForUpdate(userId);
      const repo = this.addresses.withTx(tx);
      if (!(await repo.findOwned(id, userId))) throw new NotFoundException('Address not found');
      await repo.setDefaultAddress(userId, id);
      return (await repo.findById(id))!;
    });
  }
}
