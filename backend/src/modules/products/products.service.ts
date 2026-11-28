import { BadRequestException, Injectable, NotFoundException, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { buildPaginationMeta, parseSortParam } from '../../common/dto/pagination-query.dto.js';
import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import { StorageService } from '../../common/services/s3/storage.service.js';
import { runInBackground } from '../../common/utilities/background.js';
import { toLikePattern, toPrefixTsQuery } from '../../common/utilities/search/tsquery.js';
import { resolveSlug } from '../../common/utilities/slug/slug.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { BrandRepository } from '../../models/repositories/brand.repository.js';
import { CategoryRepository } from '../../models/repositories/category.repository.js';
import { ProductImageRepository } from '../../models/repositories/product-image.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { ReviewRepository } from '../../models/repositories/review.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import type { DbClient } from '../../models/prisma.service.js';
import {
  PRODUCT_ADMIN_SORT_FIELDS,
  PRODUCT_SORT_FIELDS,
  type ProductCardRow,
  type ProductEntity,
} from '../../models/schemas/product.schema.js';
import { DiscoveryService } from './discovery.service.js';
import type {
  AdminProductQueryDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/index.js';
import {
  type AdminProduct,
  type ProductCard,
  type ProductDetail,
  toCard,
  withStockStats,
} from './entities/product.entity.js';
import { buildProductWhere } from './product-filters.js';
import { ProductVariantRepository } from '../../models/repositories/product-variant.repository.js';

export const MAX_PRODUCT_IMAGES = 10;
const RELATED_LIMIT = 6;
/** Upper bound of search hits considered for one listing. */
const SEARCH_CANDIDATES = 1000;
const ENTITY = 'Product';
const DEFAULT_SORT = [{ createdAt: 'desc' as const }];

/** Fields compared/stored in the audit log (no images, no relations). */
const AUDITED_FIELDS = [
  'name',
  'slug',
  'sku',
  'description',
  'shortDescription',
  'nameAr',
  'shortDescriptionAr',
  'descriptionAr',
  'basePrice',
  'salePrice',
  'costPrice',
  'stock',
  'lowStockThreshold',
  'isActive',
  'isFeatured',
  'categoryId',
  'brandId',
] as const satisfies readonly (keyof ProductEntity)[];

function pick(row: Partial<ProductEntity>, fields: readonly (keyof ProductEntity)[]) {
  return Object.fromEntries(fields.filter((f) => row[f] !== undefined).map((f) => [f, row[f]]));
}

@Injectable()
export class ProductsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly products: ProductRepository,
    private readonly images: ProductImageRepository,
    private readonly categories: CategoryRepository,
    private readonly brands: BrandRepository,
    private readonly reviews: ReviewRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly storage: StorageService,
    private readonly discovery: DiscoveryService,
    private readonly variants: ProductVariantRepository,
  ) {}

  /** Repairs stock of products sold in versions (sum of their versions) once on start-up. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const fixed = await this.variants.syncAllProductStocks();
      if (fixed) this.logger.log(`Synced stock of ${fixed} product(s) with their versions`);
    } catch (error) {
      this.logger.warn(`Stock sync skipped: ${(error as Error).message}`);
    }
  }

  // ───────────── 2.1 Public list ─────────────

  async list(query: ProductQueryDto): Promise<Paginated<ProductCard>> {
    const resolved = await this.resolveFilters(query, true);
    if (!resolved) return this.emptyPage(query);

    const where = buildProductWhere(query, resolved);
    const orderBy = parseSortParam(query.sort, PRODUCT_SORT_FIELDS, DEFAULT_SORT);

    // Searching without an explicit sort: best match first.
    const page =
      resolved.ids && !query.sort
        ? await this.rankedPage(where, resolved.ids, query)
        : await this.products.paginateCards(where, query.page, query.limit, orderBy);
    const ratings = await this.reviews.ratingsFor(page.items.map((p) => p.id));
    return {
      items: page.items.map((row) => ({ ...toCard(row), rating: ratings.get(row.id) ?? null })),
      meta: page.meta,
    };
  }

  // ───────────── 2.2 Product page ─────────────

  async findBySlug(slug: string, actor: Actor, ipAddress?: string): Promise<ProductDetail> {
    const product = await this.products.findPublicBySlug(slug);
    if (!product) throw new NotFoundException('Product not found');

    const [rating, related] = await Promise.all([
      this.reviews.ratingSummary(product.id),
      this.products.findRelated(product.id, product.categoryId, RELATED_LIMIT),
    ]);
    this.discovery.trackView(product.id, actor, ipAddress);

    return { ...product, ...rating, relatedProducts: related.map(toCard) };
  }

  // ───────────── 2.3 Admin list ─────────────

  async adminList(query: AdminProductQueryDto): Promise<Paginated<AdminProduct>> {
    const resolved = await this.resolveFilters(query, false);
    if (!resolved) return this.emptyPage(query);

    const filters = buildProductWhere(query, resolved);
    const where: Prisma.ProductWhereInput = {
      AND: [
        filters,
        query.includeDeleted ? {} : { deletedAt: null },
        query.isActive === undefined ? {} : { isActive: query.isActive },
      ],
    };
    const orderBy = parseSortParam(query.sort, PRODUCT_ADMIN_SORT_FIELDS, DEFAULT_SORT);
    const page = await this.products.paginateAdmin(where, query.page, query.limit, orderBy);
    return { items: page.items.map(withStockStats), meta: page.meta };
  }

  async adminFindById(id: string): Promise<AdminProduct> {
    const product = await this.products.findAdminById(id);
    if (!product) throw new NotFoundException('Product not found');
    return withStockStats(product);
  }

  // ───────────── 2.4 Create ─────────────

  async create(
    dto: CreateProductDto,
    files: Express.Multer.File[] = [],
    audit: AuditContext,
  ): Promise<AdminProduct> {
    await this.assertCategory(dto.categoryId);
    if (dto.brandId) await this.assertBrand(dto.brandId);
    const slug = (await resolveSlug(dto, null, (s) => this.products.slugExists(s)))!;

    const stored = await this.storage.uploadFiles(files, 'products');
    try {
      const id = await this.tx.run(async (tx) => {
        const product = await this.products.withTx(tx).create({
          name: dto.name,
          slug,
          sku: dto.sku ?? null,
          description: dto.description,
          shortDescription: dto.shortDescription ?? null,
          nameAr: dto.nameAr || null,
          shortDescriptionAr: dto.shortDescriptionAr || null,
          descriptionAr: dto.descriptionAr || null,
          basePrice: dto.basePrice,
          salePrice: dto.salePrice ?? null,
          costPrice: dto.costPrice ?? null,
          stock: dto.stock ?? 0,
          lowStockThreshold: dto.lowStockThreshold ?? 5,
          isActive: dto.isActive ?? true,
          isFeatured: dto.isFeatured ?? false,
          categoryId: dto.categoryId,
          brandId: dto.brandId ?? null,
        });
        if (stored.length) {
          await this.images.withTx(tx).createMany(
            stored.map((file, i) => ({
              productId: product.id,
              url: file.url,
              altText: product.name,
              sortOrder: i,
              isPrimary: i === 0,
            })),
          );
        }
        await this.auditLogs.withTx(tx).record({
          ...audit,
          action: 'PRODUCT_CREATED',
          entityType: ENTITY,
          entityId: product.id,
          newValues: { ...pick(product, AUDITED_FIELDS), imageCount: stored.length },
        });
        return product.id;
      });
      return await this.adminFindById(id);
    } catch (error) {
      await this.storage.deleteFiles(stored.map((f) => f.key));
      throw error;
    }
  }

  // ───────────── 2.5 Update ─────────────

  async update(
    id: string,
    dto: UpdateProductDto,
    files: Express.Multer.File[] = [],
    audit: AuditContext,
  ): Promise<AdminProduct> {
    const existing = await this.products.findLiveById(id);
    if (!existing) throw new NotFoundException('Product not found');

    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      await this.assertCategory(dto.categoryId);
    }
    if (dto.brandId && dto.brandId !== existing.brandId) await this.assertBrand(dto.brandId);

    // salePrice must stay below basePrice after the merge with stored values.
    const basePrice = dto.basePrice ?? existing.basePrice;
    const salePrice = dto.salePrice === undefined ? existing.salePrice : dto.salePrice;
    if (salePrice !== null && salePrice >= basePrice) {
      throw new BadRequestException('salePrice must be less than basePrice');
    }

    const imagePlan = await this.planImages(id, dto, files.length);
    const slug = await resolveSlug(dto, existing, (s) => this.products.slugExists(s, id));

    const stored = await this.storage.uploadFiles(files, 'products');
    try {
      await this.tx.run(async (tx) => {
        const updated = await this.products.withTx(tx).updateById(id, {
          name: dto.name,
          slug,
          sku: dto.sku,
          description: dto.description,
          shortDescription: dto.shortDescription,
          // undefined = unchanged; "" or null = cleared
          nameAr: dto.nameAr === undefined ? undefined : dto.nameAr || null,
          shortDescriptionAr: dto.shortDescriptionAr === undefined ? undefined : dto.shortDescriptionAr || null,
          descriptionAr: dto.descriptionAr === undefined ? undefined : dto.descriptionAr || null,
          basePrice: dto.basePrice,
          salePrice: dto.salePrice,
          costPrice: dto.costPrice,
          stock: dto.stock,
          lowStockThreshold: dto.lowStockThreshold,
          isActive: dto.isActive,
          isFeatured: dto.isFeatured,
          categoryId: dto.categoryId,
          brandId: dto.brandId,
        });
        await this.applyImagePlan(tx, id, imagePlan, stored, updated.name);
        // Sold in versions: the stock is theirs (a typed product stock is ignored).
        await this.variants.withTx(tx).syncProductStock(id);

        const before = pick(existing, AUDITED_FIELDS);
        const after = pick(updated, AUDITED_FIELDS);
        const changed = AUDITED_FIELDS.filter((f) => before[f] !== after[f]);
        await this.auditLogs.withTx(tx).record({
          ...audit,
          action: 'PRODUCT_UPDATED',
          entityType: ENTITY,
          entityId: id,
          oldValues: pick(existing, changed),
          newValues: {
            ...pick(updated, changed),
            ...(stored.length ? { addedImages: stored.length } : {}),
            ...(imagePlan.removed.length ? { removedImageIds: imagePlan.removed.map((i) => i.id) } : {}),
            ...(dto.primaryImageId ? { primaryImageId: dto.primaryImageId } : {}),
            ...(dto.imageOrder ? { imageOrder: dto.imageOrder } : {}),
          },
        });
      });
    } catch (error) {
      await this.storage.deleteFiles(stored.map((f) => f.key));
      throw error;
    }

    if (imagePlan.removed.length) {
      const urls = imagePlan.removed.map((i) => i.url);
      runInBackground('delete-product-images', () => this.storage.deleteFiles(urls));
    }
    return this.adminFindById(id);
  }

  // ───────────── 2.6 Soft delete ─────────────

  async remove(id: string, audit: AuditContext): Promise<{ id: string; deleted: true }> {
    const existing = await this.products.findLiveById(id);
    if (!existing) throw new NotFoundException('Product not found');

    await this.tx.run(async (tx) => {
      await this.products.withTx(tx).updateById(id, { deletedAt: new Date(), isActive: false });
      await this.auditLogs.withTx(tx).record({
        ...audit,
        action: 'PRODUCT_DELETED',
        entityType: ENTITY,
        entityId: id,
        oldValues: pick(existing, AUDITED_FIELDS),
        newValues: { deleted: true },
      });
    });
    return { id, deleted: true };
  }

  // ───────────── Internals ─────────────

  /**
   * Category (with sub-categories), brand and search filters.
   * Returns null when a filter can match nothing (unknown category, no hits).
   */
  private async resolveFilters(
    query: ProductQueryDto,
    publicOnly: boolean,
  ): Promise<{ categoryIds?: string[]; brandId?: string; ids?: string[] } | null> {
    const resolved: { categoryIds?: string[]; brandId?: string; ids?: string[] } = {};

    if (query.category) {
      const ids = await this.categoryWithDescendants(query.category, publicOnly);
      if (!ids) return null;
      resolved.categoryIds = ids;
    }
    if (query.brand) {
      const isId = isUUID(query.brand);
      const brand = publicOnly
        ? await this.brands.findPublicByIdOrSlug(query.brand, isId)
        : await this.brands.findOne(isId ? { id: query.brand } : { slug: query.brand });
      if (!brand) return null;
      resolved.brandId = brand.id;
    }
    const search = query.search?.trim();
    if (search) {
      // Admin search also covers hidden products, so it uses a plain name/sku match.
      if (publicOnly) {
        const ids = await this.products.searchIds(
          toPrefixTsQuery(search),
          toLikePattern(search),
          SEARCH_CANDIDATES,
          search,
        );
        if (!ids.length) return null;
        resolved.ids = ids;
      } else {
        const hits = await this.products.find(
          {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search.toLowerCase() } },
            ],
          },
          { take: SEARCH_CANDIDATES },
        );
        if (!hits.length) return null;
        resolved.ids = hits.map((h) => h.id);
      }
    }
    return resolved;
  }

  private async categoryWithDescendants(identifier: string, publicOnly: boolean): Promise<string[] | null> {
    const isId = isUUID(identifier);
    const root = publicOnly
      ? await this.categories.findPublicByIdOrSlug(identifier, isId)
      : await this.categories.findOne({
          ...(isId ? { id: identifier } : { slug: identifier }),
          deletedAt: null,
        });
    if (!root) return null;

    const links = await this.categories.findLiveParentLinks();
    const ids = [root.id];
    for (let i = 0; i < ids.length; i++) {
      for (const link of links) if (link.parentId === ids[i] && !ids.includes(link.id)) ids.push(link.id);
    }
    return ids;
  }

  /** One page of search results in relevance order (ids come ranked from SQL). */
  private async rankedPage(
    where: Prisma.ProductWhereInput,
    rankedIds: string[],
    query: ProductQueryDto,
  ): Promise<Paginated<ProductCardRow>> {
    const matching = new Set(await this.products.findPublicIds(where, SEARCH_CANDIDATES));
    const ordered = rankedIds.filter((id) => matching.has(id));
    const items = await this.products.findCardsByIds(
      ordered.slice(query.skip, query.skip + query.limit),
    );
    return { items, meta: buildPaginationMeta(ordered.length, query.page, query.limit) };
  }

  private emptyPage<T>(query: ProductQueryDto): Paginated<T> {
    return { items: [], meta: buildPaginationMeta(0, query.page, query.limit) };
  }

  private async assertCategory(categoryId: string): Promise<void> {
    if (!(await this.categories.findLiveById(categoryId))) {
      throw new BadRequestException('Category not found');
    }
  }

  private async assertBrand(brandId: string): Promise<void> {
    if (!(await this.brands.findLiveById(brandId))) {
      throw new BadRequestException('Brand not found');
    }
  }

  /** Validates image changes against what the product has now. */
  private async planImages(productId: string, dto: UpdateProductDto, newCount: number) {
    const current = await this.images.findByProduct(productId);
    const currentIds = new Set(current.map((i) => i.id));
    const removeIds = new Set(dto.removeImageIds ?? []);

    for (const imageId of [...removeIds, ...(dto.imageOrder ?? []), dto.primaryImageId ?? []].flat()) {
      if (!currentIds.has(imageId)) {
        throw new BadRequestException(`Image ${imageId} does not belong to this product`);
      }
    }
    if (dto.primaryImageId && removeIds.has(dto.primaryImageId)) {
      throw new BadRequestException('The primary image cannot also be removed');
    }
    if (dto.imageOrder?.some((imageId) => removeIds.has(imageId))) {
      throw new BadRequestException('imageOrder cannot contain removed images');
    }
    const remaining = current.filter((i) => !removeIds.has(i.id));
    if (remaining.length + newCount > MAX_PRODUCT_IMAGES) {
      throw new BadRequestException(`A product can have at most ${MAX_PRODUCT_IMAGES} images`);
    }
    return {
      removed: current.filter((i) => removeIds.has(i.id)),
      remaining,
      order: dto.imageOrder,
      primaryImageId: dto.primaryImageId,
    };
  }

  private async applyImagePlan(
    tx: DbClient,
    productId: string,
    plan: Awaited<ReturnType<ProductsService['planImages']>>,
    stored: { url: string }[],
    altText: string,
  ): Promise<void> {
    const images = this.images.withTx(tx);
    if (!plan.removed.length && !stored.length && !plan.order && !plan.primaryImageId) return;

    if (plan.removed.length) {
      await images.deleteMany({ productId, id: { in: plan.removed.map((i) => i.id) } });
    }

    // Final order: explicit order first, then the other existing images, then new ones.
    const ordered = [
      ...(plan.order ?? []),
      ...plan.remaining.map((i) => i.id).filter((imageId) => !plan.order?.includes(imageId)),
    ];
    for (const [index, imageId] of ordered.entries()) {
      const before = plan.remaining.find((i) => i.id === imageId);
      if (before?.sortOrder !== index) await images.updateById(imageId, { sortOrder: index });
    }
    if (stored.length) {
      await images.createMany(
        stored.map((file, i) => ({
          productId,
          url: file.url,
          altText,
          sortOrder: ordered.length + i,
          isPrimary: false,
        })),
      );
    }

    // Exactly one primary: the requested one, else the current one, else the first.
    const all = await images.findByProduct(productId);
    const primaryId =
      plan.primaryImageId ??
      all.find((i) => i.isPrimary)?.id ??
      [...all].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id;
    if (!primaryId) return;
    await images.updateMany({ productId, id: { not: primaryId }, isPrimary: true }, { isPrimary: false });
    await images.updateById(primaryId, { isPrimary: true });
  }
}
