import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../../models/prisma.service.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';

/** Links guest orders to a user account after login/verification. */
@Injectable()
export class OrderClaimsService {
  private readonly claimByPhone: boolean;

  constructor(
    private readonly orders: OrderRepository,
    config: ConfigService,
  ) {
    this.claimByPhone = config.get<string>('CLAIM_GUEST_ORDERS_BY_PHONE') === 'true';
  }

  /**
   * Links unowned guest orders to a user by (verified) email, current guestId,
   * and phone only when CLAIM_GUEST_ORDERS_BY_PHONE=true (phones are not verified).
   */
  claimGuestOrders(
    user: { id: string; email: string; phone: string | null },
    guestId?: string,
    tx?: DbClient,
  ): Promise<number> {
    const match: Prisma.OrderWhereInput[] = [
      { customerEmail: { equals: user.email, mode: 'insensitive' } },
    ];
    if (guestId) match.push({ guestId });
    if (this.claimByPhone && user.phone) match.push({ customerPhone: user.phone });

    const repo = tx ? this.orders.withTx(tx) : this.orders;
    return repo.assignGuestOrdersToUser(user.id, match);
  }
}
