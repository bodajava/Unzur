import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentMethod } from '../../common/enums/index.js';
import { AppEvents, GiftCardIssuedEvent } from '../../common/events/index.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { isUniqueViolation } from '../../models/prisma-errors.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { GiftCardRepository } from '../../models/repositories/gift-card.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import { UserRepository } from '../../models/repositories/user.repository.js';
import type { GiftCardAdminRow, GiftCardEntity } from '../../models/schemas/gift-card.schema.js';
import { randomCode } from '../coupons/coupon-rules.js';
import { PaymentsService } from '../payments/payments.service.js';
import type { GiftCardQueryDto, IssueGiftCardDto, PurchaseGiftCardDto, UpdateGiftCardDto } from './dto/index.js';

const VALID_DAYS = 365;
const CODE_ATTEMPTS = 3;
const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/** GC-XXXX-XXXX-XXXX, ~2^60 combinations from an unambiguous alphabet. */
export const generateGiftCardCode = () => randomCode('GC-', [4, 4, 4]);

function summarize(card: GiftCardAdminRow, revealCode: boolean) {
  const { payments, _count, purchasedBy, ...rest } = card;
  return {
    ...rest,
    code: revealCode ? rest.code : null,
    source: card.purchasedById ? 'PURCHASE' : 'ADMIN',
    paymentStatus: payments[0]?.status ?? null,
    usedPiasters: card.initialBalance - card.currentBalance,
    ordersCount: _count.orders,
    purchasedBy,
  };
}

/**
 * 18.1 purchase (inactive until Paymob confirms; the code is emailed only
 * then) and 18.3 admin management.
 */
@Injectable()
export class GiftCardManagementService {
  constructor(
    private readonly giftCards: GiftCardRepository,
    private readonly users: UserRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
  ) {}

  // ───────────── 18.1 ─────────────

  async purchase(userId: string, dto: PurchaseGiftCardDto) {
    const method = dto.paymentMethod ?? PaymentMethod.PAYMOB_CARD;
    if (!this.payments.isOnlinePaymentAvailable(method)) {
      throw new ServiceUnavailableException('Online payment is not available right now');
    }
    const buyer = await this.users.findById(userId);
    if (!buyer) throw new NotFoundException('User not found');

    const card = await this.createWithUniqueCode({
      initialBalance: dto.amountPiasters,
      currentBalance: dto.amountPiasters,
      purchasedById: userId,
      recipientEmail: dto.recipientEmail ?? buyer.email,
      message: dto.message ?? null,
      expiresAt: inDays(VALID_DAYS),
      isActive: false, // becomes usable only after the Paymob webhook (PAID)
    });
    const payment = await this.payments.initiateForGiftCard(card, buyer, method);
    return {
      giftCard: {
        id: card.id,
        amountPiasters: card.initialBalance,
        recipientEmail: card.recipientEmail,
        expiresAt: card.expiresAt,
        status: 'PENDING_PAYMENT',
      },
      payment,
    };
  }

  /** Cards I bought; codes are shown once paid. */
  async mine(userId: string) {
    return (await this.giftCards.findPurchasedBy(userId)).map((c) => summarize(c, c.isActive));
  }

  // ───────────── 18.3 ─────────────

  async list(query: GiftCardQueryDto): Promise<Paginated<ReturnType<typeof summarize>>> {
    const search = query.search?.trim();
    const page = await this.giftCards.paginateAdmin(
      {
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
        ...(search
          ? {
              OR: [
                { code: { contains: search.toUpperCase() } },
                { recipientEmail: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      query.page,
      query.limit,
    );
    return { items: page.items.map((c) => summarize(c, true)), meta: page.meta };
  }

  async issue(dto: IssueGiftCardDto, audit: AuditContext) {
    if (dto.expiresAt && dto.expiresAt <= new Date()) throw new BadRequestException('expiresAt must be in the future');
    const card = await this.createWithUniqueCode(
      {
        initialBalance: dto.amountPiasters,
        currentBalance: dto.amountPiasters,
        recipientEmail: dto.recipientEmail ?? null,
        message: dto.message ?? null,
        expiresAt: dto.expiresAt ?? inDays(VALID_DAYS),
        isActive: true,
      },
      audit,
    );
    if (card.recipientEmail) this.events.emit(AppEvents.GIFT_CARD_ISSUED, new GiftCardIssuedEvent(card.id));
    return summarize((await this.giftCards.findAdminById(card.id))!, true);
  }

  async update(id: string, dto: UpdateGiftCardDto, audit: AuditContext) {
    const card = await this.giftCards.findById(id);
    if (!card) throw new NotFoundException('Gift card not found');
    if (dto.isActive === undefined && !dto.expiresAt) throw new BadRequestException('Send isActive and/or expiresAt');
    await this.tx.run(async (tx) => {
      await this.giftCards.withTx(tx).updateById(id, { isActive: dto.isActive, expiresAt: dto.expiresAt });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: dto.isActive === false ? 'GIFT_CARD_DEACTIVATED' : dto.isActive ? 'GIFT_CARD_ACTIVATED' : 'GIFT_CARD_UPDATED',
        entityType: 'GiftCard',
        entityId: id,
        oldValues: { isActive: card.isActive, expiresAt: card.expiresAt },
        newValues: { isActive: dto.isActive, expiresAt: dto.expiresAt },
      });
    });
    return summarize((await this.giftCards.findAdminById(id))!, true);
  }

  private async createWithUniqueCode(
    data: Omit<Parameters<GiftCardRepository['create']>[0], 'code'>,
    audit?: AuditContext,
  ): Promise<GiftCardEntity> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.tx.run(async (tx) => {
          const card = await this.giftCards.withTx(tx).create({ ...data, code: generateGiftCardCode() });
          if (audit) {
            await this.auditLogs.withTx(tx).record({
              ...audit,
              action: 'GIFT_CARD_ISSUED',
              entityType: 'GiftCard',
              entityId: card.id,
              newValues: { amount: card.initialBalance, recipientEmail: card.recipientEmail, expiresAt: card.expiresAt },
            });
          }
          return card;
        });
      } catch (error) {
        if (isUniqueViolation(error) && attempt < CODE_ATTEMPTS) continue;
        throw error;
      }
    }
  }
}
