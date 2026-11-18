import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { parseSortParam } from '../../common/dto/pagination-query.dto.js';
import { DiscountType } from '../../common/enums/index.js';
import { AppEvents, CouponCampaignEvent, type CouponCampaignRecipient } from '../../common/events/index.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { CartRepository } from '../../models/repositories/cart.repository.js';
import { CouponRepository } from '../../models/repositories/coupon.repository.js';
import { SubscriberRepository } from '../../models/repositories/subscriber.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import { UserRepository } from '../../models/repositories/user.repository.js';
import type { CartOwner } from '../../models/schemas/cart.schema.js';
import {
  COUPON_SORT_FIELDS,
  type CouponEntity,
  type CouponWithUsageCount,
} from '../../models/schemas/coupon.schema.js';
import { priceCartLines } from '../cart/cart-pricing.js';
import { CouponEvaluator } from './coupon-evaluator.service.js';
import { couponShapeError, couponStatus } from './coupon-rules.js';
import type {
  CouponQueryDto,
  CreateCouponDto,
  SendCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
} from './dto/index.js';
import type {
  CouponCampaignModel,
  CouponModel,
  CouponRemovalModel,
  CouponValidationModel,
} from './entities/coupon.model.js';

const ENTITY = 'Coupon';
/** Safety cap for one campaign. */
export const MAX_CAMPAIGN_RECIPIENTS = 5000;

function toModel(coupon: CouponWithUsageCount, now = new Date()): CouponModel {
  const { _count, ...row } = coupon;
  return {
    ...row,
    status: couponStatus(row, now),
    stats: {
      usedCount: row.usedCount,
      orders: _count.usages,
      remaining: row.usageLimit === null ? null : Math.max(0, row.usageLimit - row.usedCount),
    },
  };
}

function discountLabel(c: CouponEntity): { ar: string; en: string } {
  if (c.discountType === DiscountType.PERCENTAGE) {
    return { ar: `${c.discountValue}%`, en: `${c.discountValue}%` };
  }
  const egp = (c.discountValue / 100).toFixed(2).replace(/\.00$/, '');
  return { ar: `${egp} جنيه`, en: `EGP ${egp}` };
}

@Injectable()
export class CouponsService {
  constructor(
    private readonly coupons: CouponRepository,
    private readonly carts: CartRepository,
    private readonly users: UserRepository,
    private readonly subscribers: SubscriberRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly evaluator: CouponEvaluator,
    private readonly events: EventEmitter2,
  ) {}

  // ───────────── 6.1 Validate ─────────────

  async validate(dto: ValidateCouponDto, actor: Actor, userEmail?: string): Promise<CouponValidationModel> {
    const owner: CartOwner | null = actor.userId
      ? { userId: actor.userId }
      : actor.guestId
        ? { guestId: actor.guestId }
        : null;
    const cart = owner ? await this.carts.findDetailByOwner(owner) : null;
    const subtotal = dto.cartSubtotal ?? (cart ? priceCartLines(cart.items).subtotal : 0);

    const result = await this.evaluator.evaluate(dto.code, subtotal, {
      userId: actor.userId,
      guestId: actor.userId ? undefined : actor.guestId,
      email: userEmail ?? dto.email,
    });
    if (!result.ok) throw new BadRequestException(result.reason);

    let appliedToCart = false;
    if (dto.applyToCart) {
      if (!cart?.items.length) throw new BadRequestException('Your cart is empty');
      await this.carts.updateById(cart.id, { couponCode: result.coupon.code });
      appliedToCart = true;
    }
    const { coupon, discountAmount } = result;
    return {
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
      subtotal,
      discountAmount,
      totalAfterDiscount: subtotal - discountAmount,
      appliedToCart,
    };
  }

  // ───────────── 6.2 Admin list ─────────────

  async list(query: CouponQueryDto): Promise<Paginated<CouponModel>> {
    const now = new Date();
    const and: Prisma.CouponWhereInput[] = [];
    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { code: { contains: search.toUpperCase() } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    switch (query.status) {
      case 'ACTIVE':
        and.push({ isActive: true, startsAt: { lte: now }, expiresAt: { gte: now } });
        break;
      case 'SCHEDULED':
        and.push({ isActive: true, startsAt: { gt: now } });
        break;
      case 'EXPIRED':
        and.push({ expiresAt: { lt: now } });
        break;
      case 'INACTIVE':
        and.push({ isActive: false });
        break;
    }
    const orderBy = parseSortParam(query.sort, COUPON_SORT_FIELDS, [{ createdAt: 'desc' }]);
    const page = await this.coupons.paginateWithUsage({ AND: and }, query.page, query.limit, orderBy);
    return { items: page.items.map((c) => toModel(c, now)), meta: page.meta };
  }

  async findOne(id: string): Promise<CouponModel> {
    const [coupon] = (await this.coupons.paginateWithUsage({ id }, 1, 1, [])).items;
    if (!coupon) throw new NotFoundException('Coupon not found');
    return toModel(coupon);
  }

  // ───────────── 6.3 Admin CRUD ─────────────

  async create(dto: CreateCouponDto, audit: AuditContext): Promise<CouponModel> {
    const shapeError = couponShapeError(dto);
    if (shapeError) throw new BadRequestException(shapeError);
    if (await this.coupons.findByCode(dto.code)) {
      throw new ConflictException('A coupon with this code already exists');
    }
    const coupon = await this.tx.run(async (tx) => {
      const created = await this.coupons.withTx(tx).create({
        code: dto.code,
        description: dto.description ?? null,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minOrderAmount: dto.minOrderAmount ?? 0,
        maxDiscountAmount: dto.discountType === DiscountType.PERCENTAGE ? (dto.maxDiscountAmount ?? null) : null,
        usageLimit: dto.usageLimit ?? null,
        perUserLimit: dto.perUserLimit ?? 1,
        startsAt: dto.startsAt,
        expiresAt: dto.expiresAt,
        isActive: dto.isActive ?? true,
      });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'COUPON_CREATED',
        entityType: ENTITY,
        entityId: created.id,
        newValues: created,
      });
      return created;
    });
    return this.findOne(coupon.id);
  }

  async update(id: string, dto: UpdateCouponDto, audit: AuditContext): Promise<CouponModel> {
    const existing = await this.coupons.findById(id);
    if (!existing) throw new NotFoundException('Coupon not found');

    const merged = {
      discountType: dto.discountType ?? existing.discountType,
      discountValue: dto.discountValue ?? existing.discountValue,
      startsAt: dto.startsAt ?? existing.startsAt,
      expiresAt: dto.expiresAt ?? existing.expiresAt,
    };
    const shapeError = couponShapeError(merged);
    if (shapeError) throw new BadRequestException(shapeError);
    if (dto.code && dto.code !== existing.code && (await this.coupons.findByCode(dto.code))) {
      throw new ConflictException('A coupon with this code already exists');
    }

    await this.tx.run(async (tx) => {
      const updated = await this.coupons.withTx(tx).updateById(id, {
        code: dto.code,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minOrderAmount: dto.minOrderAmount,
        // A cap only makes sense for percentages.
        maxDiscountAmount: merged.discountType === DiscountType.FIXED_AMOUNT ? null : dto.maxDiscountAmount,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit,
        startsAt: dto.startsAt,
        expiresAt: dto.expiresAt,
        isActive: dto.isActive,
      });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'COUPON_UPDATED',
        entityType: ENTITY,
        entityId: id,
        oldValues: existing,
        newValues: updated,
      });
    });
    return this.findOne(id);
  }

  /** Used coupons are deactivated (order history keeps them); unused ones are deleted. */
  async remove(id: string, audit: AuditContext): Promise<CouponRemovalModel> {
    const existing = await this.findOne(id);
    const used = existing.stats.orders > 0 || existing.usedCount > 0;

    await this.tx.run(async (tx) => {
      if (used) await this.coupons.withTx(tx).updateById(id, { isActive: false });
      else await this.coupons.withTx(tx).delete({ id });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: used ? 'COUPON_DEACTIVATED' : 'COUPON_DELETED',
        entityType: ENTITY,
        entityId: id,
        oldValues: { code: existing.code, isActive: existing.isActive },
      });
    });
    return used
      ? { id, deleted: false, deactivated: true, reason: 'This coupon was used in orders, so it was deactivated' }
      : { id, deleted: true, deactivated: false, reason: null };
  }

  // ───────────── 6.4 Send to buyers ─────────────

  async sendToBuyers(dto: SendCouponDto, audit: AuditContext): Promise<CouponCampaignModel> {
    const coupon = await this.coupons.findById(dto.couponId);
    if (!coupon) throw new NotFoundException('Coupon not found');
    const status = couponStatus(coupon);
    if (status !== 'ACTIVE' && status !== 'SCHEDULED') {
      throw new BadRequestException(`Cannot send a coupon that is ${status.toLowerCase()}`);
    }

    const recipients = await this.recipients(dto);
    if (!recipients.length) throw new BadRequestException('No recipients found for this target');
    if (recipients.length > MAX_CAMPAIGN_RECIPIENTS) {
      throw new BadRequestException(`At most ${MAX_CAMPAIGN_RECIPIENTS} recipients per send`);
    }

    await this.auditLogs.record({
      ...audit,
      action: 'COUPON_SENT',
      entityType: ENTITY,
      entityId: coupon.id,
      newValues: { target: dto.target, recipients: recipients.length },
    });
    // Emails go out in the background (CouponsListener); the request does not wait.
    this.events.emit(
      AppEvents.COUPON_CAMPAIGN_REQUESTED,
      new CouponCampaignEvent(
        coupon.code,
        discountLabel(coupon),
        coupon.expiresAt,
        recipients,
        dto.message,
        dto.target === 'SUBSCRIBERS',
      ),
    );
    return { code: coupon.code, target: dto.target, recipients: recipients.length, queued: true };
  }

  private async recipients(dto: SendCouponDto): Promise<CouponCampaignRecipient[]> {
    let list: CouponCampaignRecipient[];
    if (dto.target === 'ALL_CUSTOMERS') list = await this.users.findCustomerRecipients();
    else if (dto.target === 'SUBSCRIBERS') list = (await this.subscribers.findActiveEmails()).map((email) => ({ email }));
    else list = (dto.emails ?? []).map((email) => ({ email: email.trim().toLowerCase() }));

    const seen = new Set<string>();
    return list.filter((r) => !seen.has(r.email) && seen.add(r.email));
  }
}
