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
import { ProductImageRepository } from '../../models/repositories/product-image.repository.js';

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

/**
 * attributes.color is the swatch shown on the product page: "#rrggbb".
 * Validated and lower-cased here; other attribute keys pass through.
 */
export function withValidColor<T extends Record<string, unknown> | null | undefined>(attributes: T): T {
  if (!attributes || attributes.color === undefined || attributes.color === null) return attributes;
  const color = attributes.color;
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color.trim())) {
    throw new BadRequestException('Color must look like #d1342f');
  }
  return { ...attributes, color: color.trim().toLowerCase() };
}

@Injectable()
export class VariantsService {
  constructor(
    private readonly variants: ProductVariantRepository,
    private readonly products: ProductRepository,
    private readonly orderItems: OrderItemRepository,
    private readonly images: ProductImageRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
  ) {}

  // ───────────── 13.1 ─────────────

  async create(productId: string, dto: CreateVariantDto, audit: AuditContext): Promise<ProductVariantEntity> {
    if (!(await this.products.findLiveById(productId))) {
      throw new NotFoundException('Product not found');
    }
    return this.tx.run(async (tx) => {
      const attributes = withValidColor(await this.withValidImage(productId, dto.attributes));
      const variant = await this.variants.withTx(tx).create({
        productId,
        name: dto.name,
        nameAr: dto.nameAr || null,
        sku: dto.sku,
        price: dto.price,
        salePrice: dto.salePrice ?? null,
        stock: dto.stock ?? 0,
        attributes: toJsonInput(attributes),
        isActive: dto.isActive ?? true,
      });
      await this.variants.withTx(tx).syncProductStock(productId);
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

    const attributes = withValidColor(await this.withValidImage(existing.productId, dto.attributes));
    return this.tx.run(async (tx) => {
      const variant = await this.variants.withTx(tx).updateById(id, {
        name: dto.name,
        nameAr: dto.nameAr === undefined ? undefined : dto.nameAr || null,
        sku: dto.sku,
        price: dto.price,
        salePrice: dto.salePrice,
        stock: dto.stock,
        attributes: toJsonInput(attributes),
        isActive: dto.isActive,
      });
      await this.variants.withTx(tx).syncProductStock(existing.productId);
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
        await this.variants.withTx(tx).syncProductStock(existing.productId);
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
      await this.variants.withTx(tx).syncProductStock(existing.productId);
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

  /** attributes.imageId (the version's own photo) must be one of this product's photos. */
  private async withValidImage<T extends Record<string, unknown> | null | undefined>(productId: string, attributes: T): Promise<T> {
    if (!attributes || attributes.imageId === undefined || attributes.imageId === null) return attributes;
    const imageId = attributes.imageId;
    const photos = await this.images.findByProduct(productId);
    if (typeof imageId !== 'string' || !photos.some((p) => p.id === imageId)) {
      throw new BadRequestException("That photo isn't one of this product's photos");
    }
    return attributes;
  }

  private async getLive(id: string): Promise<ProductVariantEntity> {
    const variant = await this.variants.findByIdWithProduct(id);
    if (!variant || variant.product.deletedAt) throw new NotFoundException('Variant not found');
    const { product: _product, ...row } = variant;
    return row;
  }
}
