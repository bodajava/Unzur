import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { StorageService } from '../../common/services/s3/storage.service.js';
import { runInBackground } from '../../common/utilities/background.js';
import { resolveSlug } from '../../common/utilities/slug/slug.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { CategoryRepository } from '../../models/repositories/category.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import type { CategoryEntity } from '../../models/schemas/category.schema.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/index.js';
import {
  buildCategoryTree,
  type CategoryDetail,
  type CategoryNode,
} from './entities/category.entity.js';

const ENTITY = 'Category';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly products: ProductRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly storage: StorageService,
  ) {}

  // ───────────── 2.7 / 2.8 Public ─────────────

  /** Dashboard list: hidden categories included, with how many live products each holds. */
  async adminList() {
    const rows = await this.categories.findAllForAdmin();
    return rows.map(({ _count, deletedAt: _deleted, ...c }) => ({ ...c, productCount: _count.products }));
  }

  async tree(): Promise<CategoryNode[]> {
    return buildCategoryTree(await this.categories.findAllPublic());
  }

  async findBySlug(slug: string): Promise<CategoryDetail> {
    const category = await this.categories.findPublicBySlug(slug);
    if (!category) throw new NotFoundException('Category not found');

    const all = await this.categories.findAllPublic();
    const parent = category.parentId ? all.find((c) => c.id === category.parentId) : undefined;
    // A child of a hidden parent is hidden too (same rule as the tree).
    if (category.parentId && !parent) throw new NotFoundException('Category not found');

    return {
      ...category,
      parent: parent ? { id: parent.id, name: parent.name, slug: parent.slug } : null,
      children: all.filter((c) => c.parentId === category.id),
    };
  }

  // ───────────── 2.9 Admin ─────────────

  async create(
    dto: CreateCategoryDto,
    image: Express.Multer.File | undefined,
    audit: AuditContext,
  ): Promise<CategoryEntity> {
    if (dto.parentId) await this.assertParent(dto.parentId, null);
    const slug = (await resolveSlug(dto, null, (s) => this.categories.slugExists(s)))!;

    const [stored] = await this.storage.uploadFiles(image ? [image] : [], 'categories');
    try {
      return await this.tx.run(async (tx) => {
        const created = await this.categories.withTx(tx).create({
          name: dto.name,
          slug,
          description: dto.description ?? null,
          parentId: dto.parentId ?? null,
          isActive: dto.isActive ?? true,
          imageUrl: stored?.url ?? null,
        });
        await this.auditLogs.withTx(tx).record({
          ...audit,
          action: 'CATEGORY_CREATED',
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
    dto: UpdateCategoryDto,
    image: Express.Multer.File | undefined,
    audit: AuditContext,
  ): Promise<CategoryEntity> {
    const existing = await this.getLive(id);
    if (dto.parentId) await this.assertParent(dto.parentId, id);
    const slug = await resolveSlug(dto, existing, (s) => this.categories.slugExists(s, id));

    const [stored] = await this.storage.uploadFiles(image ? [image] : [], 'categories');
    try {
      const updated = await this.tx.run(async (tx) => {
        const row = await this.categories.withTx(tx).updateById(id, {
          name: dto.name,
          slug,
          description: dto.description,
          parentId: dto.parentId,
          isActive: dto.isActive,
          ...(stored ? { imageUrl: stored.url } : {}),
        });
        await this.auditLogs.withTx(tx).record({
          ...audit,
          action: 'CATEGORY_UPDATED',
          entityType: ENTITY,
          entityId: id,
          oldValues: existing,
          newValues: row,
        });
        return row;
      });
      if (stored && existing.imageUrl) {
        const old = existing.imageUrl;
        runInBackground('delete-category-image', () => this.storage.deleteFiles([old]));
      }
      return updated;
    } catch (error) {
      if (stored) await this.storage.deleteFiles([stored.key]);
      throw error;
    }
  }

  /** Soft delete. Refused while live sub-categories or products still use it. */
  async remove(id: string, audit: AuditContext): Promise<{ id: string; deleted: true }> {
    const existing = await this.getLive(id);
    if (await this.categories.countLiveChildren(id)) {
      throw new ConflictException('Move or delete the sub-categories first');
    }
    if (await this.products.countLiveInCategory(id)) {
      throw new ConflictException('Move or delete the products in this category first');
    }

    await this.tx.run(async (tx) => {
      await this.categories.withTx(tx).updateById(id, { deletedAt: new Date(), isActive: false });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'CATEGORY_DELETED',
        entityType: ENTITY,
        entityId: id,
        oldValues: existing,
      });
    });
    return { id, deleted: true };
  }

  // ───────────── Internals ─────────────

  private async getLive(id: string): Promise<CategoryEntity> {
    const category = await this.categories.findLiveById(id);
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  /** Parent must exist and must not be the category itself or one of its descendants. */
  private async assertParent(parentId: string, selfId: string | null): Promise<void> {
    if (parentId === selfId) throw new BadRequestException('A category cannot be its own parent');
    const links = await this.categories.findLiveParentLinks();
    const parentOf = new Map(links.map((l) => [l.id, l.parentId]));
    if (!parentOf.has(parentId)) throw new BadRequestException('Parent category not found');

    if (selfId) {
      // Walk up from the new parent; reaching self means a cycle.
      const seen = new Set<string>();
      for (let cur: string | null | undefined = parentId; cur; cur = parentOf.get(cur)) {
        if (cur === selfId) {
          throw new BadRequestException('A category cannot be moved under its own sub-category');
        }
        if (seen.has(cur)) break;
        seen.add(cur);
      }
    }
  }
}
