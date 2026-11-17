import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Actor } from '../../common/interfaces/auth.interface.js';
import { runInBackground } from '../../common/utilities/background.js';
import { RedisService } from '../../common/utilities/caching/redis.service.js';
import { toLikePattern, toPrefixTsQuery } from '../../common/utilities/search/tsquery.js';
import { ProductVariantRepository } from '../../models/repositories/product-variant.repository.js';
import { ProductViewRepository } from '../../models/repositories/product-view.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { RecentlyViewedRepository } from '../../models/repositories/recently-viewed.repository.js';
import { StockNotificationRepository } from '../../models/repositories/stock-notification.repository.js';
import type { ViewerRef } from '../../models/schemas/recently-viewed.schema.js';
import type { NotifyMeDto } from './dto/index.js';
import {
  type ProductCard,
  type ProductSuggestion,
  type Recommendation,
  toCard,
  toSuggestion,
} from './entities/product.entity.js';

export const SUGGEST_LIMIT = 8;
export const RECOMMENDATION_LIMIT = 8;
export const RECENTLY_VIEWED_LIMIT = 12;
export const VIEW_DEDUP_TTL_SEC = 300;

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly products: ProductRepository,
    private readonly variants: ProductVariantRepository,
    private readonly views: ProductViewRepository,
    private readonly recentlyViewedRepo: RecentlyViewedRepository,
    private readonly stockNotifications: StockNotificationRepository,
    private readonly redis: RedisService,
  ) {}

  // ───────────── 16.1 Search-as-you-type ─────────────

  async suggest(q: string | undefined): Promise<ProductSuggestion[]> {
    const text = q?.trim();
    if (!text) return [];
    const rows = await this.products.suggest(toPrefixTsQuery(text), toLikePattern(text), SUGGEST_LIMIT);
    return rows.map(toSuggestion);
  }

  // ───────────── 16.2 Customers also bought ─────────────

  async recommendations(productId: string): Promise<Recommendation[]> {
    const product = await this.products.findPublicById(productId);
    if (!product) throw new NotFoundException('Product not found');

    const result: Recommendation[] = [];
    const exclude = new Set([productId]);
    const add = (cards: ProductCard[], reason: Recommendation['reason']) => {
      for (const card of cards) {
        if (result.length >= RECOMMENDATION_LIMIT || exclude.has(card.id)) continue;
        exclude.add(card.id);
        result.push({ ...card, reason });
      }
    };

    const coIds = await this.products.findCoPurchasedIds(productId, RECOMMENDATION_LIMIT);
    add((await this.products.findCardsByIds(coIds)).map(toCard), 'bought_together');

    // Sparse purchase data: fill with the same category, then featured products.
    if (result.length < RECOMMENDATION_LIMIT) {
      const sameCategory = await this.products.findCards(
        { categoryId: product.categoryId, id: { notIn: [...exclude] } },
        RECOMMENDATION_LIMIT - result.length,
        [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      );
      add(sameCategory.map(toCard), 'same_category');
    }
    if (result.length < RECOMMENDATION_LIMIT) {
      const featured = await this.products.findCards(
        { isFeatured: true, id: { notIn: [...exclude] } },
        RECOMMENDATION_LIMIT - result.length,
        [{ createdAt: 'desc' }],
      );
      add(featured.map(toCard), 'featured');
    }
    return result;
  }

  // ───────────── 16.3 Recently viewed ─────────────

  async recentlyViewed(actor: Actor): Promise<ProductCard[]> {
    const viewer = this.viewerOf(actor);
    if (!viewer) return [];
    const ids = await this.recentlyViewedRepo.findRecentProductIds(viewer, RECENTLY_VIEWED_LIMIT);
    return (await this.products.findCardsByIds(ids)).map(toCard);
  }

  // ───────────── 16.4 Back-in-stock alert ─────────────

  async notifyMe(
    productId: string,
    dto: NotifyMeDto,
  ): Promise<{ subscribed: true; alreadySubscribed: boolean }> {
    const product = await this.products.findPublicById(productId);
    if (!product) throw new NotFoundException('Product not found');

    let inStock: boolean;
    if (dto.variantId) {
      const variant = await this.variants.findById(dto.variantId);
      if (!variant || variant.productId !== productId || !variant.isActive) {
        throw new NotFoundException('Variant not found');
      }
      inStock = variant.stock > 0;
    } else {
      inStock = product.stock > 0 || (await this.variants.hasStock(productId));
    }
    if (inStock) throw new BadRequestException('This product is in stock');

    const variantId = dto.variantId ?? null;
    const pending = await this.stockNotifications.findPending(dto.email, productId, variantId);
    if (!pending) {
      await this.stockNotifications.create({ email: dto.email, productId, variantId });
    }
    return { subscribed: true, alreadySubscribed: !!pending };
  }

  // ───────────── View tracking (feeds the admin AI analyst) ─────────────

  /**
   * Records a product view without slowing the page: runs in the background,
   * and the same viewer is counted at most once per product every 5 minutes.
   */
  trackView(productId: string, actor: Actor, ipAddress?: string): void {
    const viewer = this.viewerOf(actor);
    const who = viewer?.userId ?? viewer?.guestId ?? `ip:${ipAddress ?? 'unknown'}`;

    runInBackground('product-view', async () => {
      if (!(await this.isFirstViewInWindow(`view_dedup:${productId}:${who}`))) return;
      await this.views.create({
        productId,
        userId: viewer?.userId ?? null,
        guestId: viewer?.userId ? null : (viewer?.guestId ?? null),
      });
      if (viewer) await this.recentlyViewedRepo.touch(productId, viewer);
    });
  }

  /** SET NX in Redis. If Redis is down, count the view (fail open). */
  private async isFirstViewInWindow(key: string): Promise<boolean> {
    try {
      return await this.redis.setIfAbsent(key, 1, VIEW_DEDUP_TTL_SEC);
    } catch (error) {
      this.logger.warn(`View dedup unavailable: ${(error as Error).message}`);
      return true;
    }
  }

  private viewerOf(actor: Actor): ViewerRef | null {
    if (actor.userId) return { userId: actor.userId };
    if (actor.guestId) return { guestId: actor.guestId };
    return null;
  }
}
