import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { OrderItemRepository } from '../../models/repositories/order-item.repository.js';
import { ProductVariantRepository } from '../../models/repositories/product-variant.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import type { ProductVariantEntity } from '../../models/schemas/product-variant.schema.js';
import type { CreateVariantDto, UpdateVariantDto } from './dto/index.js';

const ENTITY = 'ProductVariant';

export type VariantRemoval =
  | { id: string; deleted: true; deactivated: false }
  | { id: string; deleted: false; deactivated: true; reason: string };

/** Json columns need Prisma.DbNull (not null) to store SQL NULL. */
const toJsonInput = (value: Record<string, unknown> | null | undefined) =>
  value === undefined
    ? undefined
    : value === null
      ? Prisma.DbNull
      : (value as Prisma.InputJsonObject);

@Injectable()
export class VariantsService {
  constructor(
    private readonly variants: ProductVariantRepository,
    private readonly products: ProductRepository,
    private readonly orderItems: OrderItemRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
  ) {}

  // ───────────── 13.1 ─────────────

  async create(productId: string, dto: CreateVariantDto, audit: AuditContext): Promise<ProductVariantEntity> {
    if (!(await this.products.findLiveById(productId))) {
      throw new NotFoundException('Product not found');
    }
    return this.tx.run(async (tx) => {
      const variant = await this.variants.withTx(tx).create({
        productId,
        name: dto.name,
        nameAr: dto.nameAr || null,
        sku: dto.sku,
        price: dto.price,
        salePrice: dto.salePrice ?? null,
        stock: dto.stock ?? 0,
        attributes: toJsonInput(dto.attributes),
        isActive: dto.isActive ?? true,
      });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'VARIANT_CREATED',
        entityType: ENTITY,
        entityId: variant.id,
        newValues: variant,
      });
      return variant;
    });
  }

  // ───────────── 13.2 ─────────────

  async update(id: string, dto: UpdateVariantDto, audit: AuditContext): Promise<ProductVariantEntity> {
    const existing = await this.getLive(id);

    const price = dto.price ?? existing.price;
    const salePrice = dto.salePrice === undefined ? existing.salePrice : dto.salePrice;
    if (salePrice !== null && salePrice >= price) {
      throw new BadRequestException('salePrice must be less than price');
    }

    return this.tx.run(async (tx) => {
      const variant = await this.variants.withTx(tx).updateById(id, {
        name: dto.name,
        nameAr: dto.nameAr === undefined ? undefined : dto.nameAr || null,
        sku: dto.sku,
        price: dto.price,
        salePrice: dto.salePrice,
        stock: dto.stock,
        attributes: toJsonInput(dto.attributes),
        isActive: dto.isActive,
      });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'VARIANT_UPDATED',
        entityType: ENTITY,
        entityId: id,
        oldValues: existing,
        newValues: variant,
      });
      return variant;
    });
  }

  // ───────────── 13.3 ─────────────

  /**
   * Hard delete when the variant was never ordered. Ordered variants are only
   * deactivated so order history keeps pointing at them.
   */
  async remove(id: string, audit: AuditContext): Promise<VariantRemoval> {
    const existing = await this.getLive(id);
    const ordered = await this.orderItems.existsForVariant(id);

    return this.tx.run(async (tx) => {
      if (ordered) {
        await this.variants.withTx(tx).updateById(id, { isActive: false });
        await this.auditLogs.withTx(tx).record({
          ...audit,
          action: 'VARIANT_DEACTIVATED',
          entityType: ENTITY,
          entityId: id,
          oldValues: { isActive: existing.isActive },
          newValues: { isActive: false, reason: 'referenced by orders' },
        });
        return {
          id,
          deleted: false,
          deactivated: true,
          reason: 'This variant appears in existing orders, so it was deactivated instead of deleted',
        } as const;
      }
      await this.variants.withTx(tx).delete({ id });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'VARIANT_DELETED',
        entityType: ENTITY,
        entityId: id,
        oldValues: existing,
      });
      return { id, deleted: true, deactivated: false } as const;
    });
  }

  private async getLive(id: string): Promise<ProductVariantEntity> {
    const variant = await this.variants.findByIdWithProduct(id);
    if (!variant || variant.product.deletedAt) throw new NotFoundException('Variant not found');
    const { product: _product, ...row } = variant;
    return row;
  }
}
