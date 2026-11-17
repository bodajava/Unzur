import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { StorageService } from '../../common/services/s3/storage.service.js';
import { runInBackground } from '../../common/utilities/background.js';
import { resolveSlug } from '../../common/utilities/slug/slug.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { BrandRepository } from '../../models/repositories/brand.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import type { BrandEntity } from '../../models/schemas/brand.schema.js';
import type { CreateBrandDto, UpdateBrandDto } from './dto/index.js';
import type { BrandPublic } from './entities/brand.entity.js';

const ENTITY = 'Brand';

@Injectable()
export class BrandsService {
  constructor(
    private readonly brands: BrandRepository,
    private readonly products: ProductRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly storage: StorageService,
  ) {}

  // ───────────── 2.10 / 2.11 Public ─────────────

  /** Dashboard list: hidden brands included, with how many live products each has. */
  async adminList() {
    const rows = await this.brands.findAllForAdmin();
    return rows.map(({ _count, deletedAt: _deleted, ...b }) => ({ ...b, productCount: _count.products }));
  }

  list(): Promise<BrandPublic[]> {
    return this.brands.findAllPublic();
  }

  /** By UUID id or by slug. */
  async findOne(identifier: string): Promise<BrandPublic> {
    const brand = await this.brands.findPublicByIdOrSlug(identifier, isUUID(identifier));
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  // ───────────── 2.12 Admin ─────────────

  async create(
    dto: CreateBrandDto,
    logo: Express.Multer.File | undefined,
    audit: AuditContext,
  ): Promise<BrandEntity> {
    const slug = (await resolveSlug(dto, null, (s) => this.brands.slugExists(s)))!;
    const [stored] = await this.storage.uploadFiles(logo ? [logo] : [], 'brands');
    try {
      return await this.tx.run(async (tx) => {
        const created = await this.brands.withTx(tx).create({
          name: dto.name,
          slug,
          description: dto.description ?? null,
          isActive: dto.isActive ?? true,
          logoUrl: stored?.url ?? null,
        });
        await this.auditLogs.withTx(tx).record({
          ...audit,
          action: 'BRAND_CREATED',
          entityType: ENTITY,
          entityId: created.id,
          newValues: created,
        });
        return created;
      });
    } catch (error) {
      if (stored) await this.storage.deleteFiles([stored.key]);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateBrandDto,
    logo: Express.Multer.File | undefined,
    audit: AuditContext,
  ): Promise<BrandEntity> {
    const existing = await this.getLive(id);
    const slug = await resolveSlug(dto, existing, (s) => this.brands.slugExists(s, id));
    const [stored] = await this.storage.uploadFiles(logo ? [logo] : [], 'brands');
    try {
      const updated = await this.tx.run(async (tx) => {
        const row = await this.brands.withTx(tx).updateById(id, {
          name: dto.name,
          slug,
          description: dto.description,
          isActive: dto.isActive,
          ...(stored ? { logoUrl: stored.url } : {}),
        });
        await this.auditLogs.withTx(tx).record({
          ...audit,
          action: 'BRAND_UPDATED',
          entityType: ENTITY,
          entityId: id,
          oldValues: existing,
          newValues: row,
        });
        return row;
      });
      if (stored && existing.logoUrl) {
        const old = existing.logoUrl;
        runInBackground('delete-brand-logo', () => this.storage.deleteFiles([old]));
      }
      return updated;
    } catch (error) {
      if (stored) await this.storage.deleteFiles([stored.key]);
      throw error;
    }
  }

  /** Soft delete. Refused while live products still use the brand. */
  async remove(id: string, audit: AuditContext): Promise<{ id: string; deleted: true }> {
    const existing = await this.getLive(id);
    if (await this.products.exists({ brandId: id, deletedAt: null })) {
      throw new ConflictException('Move or delete the products of this brand first');
    }
    await this.tx.run(async (tx) => {
      await this.brands.withTx(tx).updateById(id, { deletedAt: new Date(), isActive: false });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'BRAND_DELETED',
        entityType: ENTITY,
        entityId: id,
        oldValues: existing,
      });
    });
    return { id, deleted: true };
  }

  private async getLive(id: string): Promise<BrandEntity> {
    const brand = await this.brands.findLiveById(id);
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }
}
