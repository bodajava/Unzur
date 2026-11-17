import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../prisma.service.js';
import type { PaymentEntity } from '../schemas/payment.schema.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class PaymentRepository extends BaseRepository<
  PaymentEntity,
  Prisma.PaymentWhereInput,
  Prisma.PaymentWhereUniqueInput,
  Prisma.PaymentUncheckedCreateInput,
  Prisma.PaymentUncheckedUpdateInput,
  Prisma.PaymentOrderByWithRelationInput
> {
  protected delegate(db: DbClient) {
    return db.payment;
  }

  findByTransactionId(paymobTransactionId: string): Promise<PaymentEntity | null> {
    return this.db.payment.findUnique({ where: { paymobTransactionId } });
  }

  findByPaymobOrderId(paymobOrderId: string): Promise<PaymentEntity | null> {
    return this.db.payment.findUnique({ where: { paymobOrderId } });
  }

  findForOrder(orderId: string): Promise<PaymentEntity[]> {
    return this.db.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
  }

  /** Latest attempt still waiting for Paymob. */
  findLatestPending(orderId: string): Promise<PaymentEntity | null> {
    return this.db.payment.findFirst({
      where: { orderId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** The captured payment that can still be refunded. */
  findRefundable(orderId: string): Promise<PaymentEntity | null> {
    return this.db.payment.findFirst({
      where: { orderId, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] }, paymobTransactionId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
