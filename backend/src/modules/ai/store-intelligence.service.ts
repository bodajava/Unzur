import { Injectable, NotFoundException } from '@nestjs/common';
import { toAnyPrefixTsQuery, toLikePattern } from '../../common/utilities/search/tsquery.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { ProductViewRepository } from '../../models/repositories/product-view.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { ReviewRepository } from '../../models/repositories/review.repository.js';
import { ShippingZoneRepository } from '../../models/repositories/shipping-zone.repository.js';
import { AnalyticsService, INSIGHT_RULES } from '../analytics/analytics.service.js';
import { SettingsService } from '../settings/settings.service.js';

const LOW_STOCK_HINT = 5;

/** Public facts the shopping assistant may see. No costPrice, no exact stock, no customers. */
export interface PublicCatalogContext {
  currency: 'EGP';
  products: {
    id: string;
    name: string;
    slug: string;
    category: string;
    brand: string | null;
    description: string | null;
    pricePiasters: number;
    originalPricePiasters: number | null;
    availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    variants: { name: string; pricePiasters: number; inStock: boolean }[];
  }[];
  shipping: {
    freeShippingThresholdPiasters: number | null;
    zones: { governorate: string; nameAr: string | null; feePiasters: number; estimatedDays: string }[];
  };
}

/**
 * Reads live store data for the AI endpoints (9.x). Every number the AI or
 * the fallback writer uses comes from here.
 */
@Injectable()
export class StoreIntelligenceService {
  constructor(
    private readonly products: ProductRepository,
    private readonly views: ProductViewRepository,
    private readonly orders: OrderRepository,
    private readonly reviews: ReviewRepository,
    private readonly zones: ShippingZoneRepository,
    private readonly settings: SettingsService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** 9.1 Products matching the question (or the given product) + shipping. Public data only. */
  async getPublicCatalogContext(message: string, productId?: string): Promise<PublicCatalogContext> {
    const ids = new Set<string>();
    if (productId) ids.add(productId);
    const query = toAnyPrefixTsQuery(message);
    const longest = message.split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? '';
    for (const id of await this.products.searchIds(query, toLikePattern(longest.length >= 3 ? longest : message), 5)) {
      ids.add(id);
    }
    if (!ids.size) {
      const featured = await this.products.findCards({ isFeatured: true }, 3, [{ createdAt: 'desc' }]);
      featured.forEach((p) => ids.add(p.id));
    }
    const [facts, zones, threshold] = await Promise.all([
      this.products.findAssistantFacts([...ids].slice(0, 6)),
      this.zones.find({ isActive: true }, { orderBy: { fee: 'asc' } }),
      this.settings.freeShippingThreshold(),
    ]);
    const order = [...ids];
    return {
      currency: 'EGP',
      products: facts
        .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
        .map((p) => {
          const variants = p.variants.map((v) => ({
            name: v.name,
            pricePiasters: v.salePrice ?? v.price,
            inStock: v.stock > 0,
          }));
          const units = p.stock + p.variants.reduce((sum, v) => sum + Math.max(v.stock, 0), 0);
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            category: p.category.name,
            brand: p.brand?.name ?? null,
            description: p.shortDescription,
            pricePiasters: p.salePrice ?? p.basePrice,
            originalPricePiasters: p.salePrice ? p.basePrice : null,
            availability: units <= 0 ? 'OUT_OF_STOCK' : units <= LOW_STOCK_HINT ? 'LOW_STOCK' : 'IN_STOCK',
            variants,
          };
        }),
      shipping: {
        freeShippingThresholdPiasters: threshold,
        zones: zones.map((z) => ({ governorate: z.governorate, nameAr: z.nameAr, feePiasters: z.fee, estimatedDays: z.estimatedDays })),
      },
    };
  }

  /** 9.2 Everything known about one product's performance (admin only). */
  async getProductDiagnostics(productId: string, days = 30) {
    const { from, to } = this.analytics.period({}, days);
    const [perf] = await this.products.performance({ from, to, sortBy: 'revenue', desc: true, limit: 1, productIds: [productId] });
    if (!perf) throw new NotFoundException('Product not found');
    const [viewers, buyers, feedback, reasons] = await Promise.all([
      this.views.viewersOfProduct(productId, from, to),
      this.orders.buyersOfProduct(productId, from, to),
      this.reviews.feedbackForProduct(productId, 10),
      this.orders.reasonsForProduct(productId, 5),
    ]);
    const marginRate =
      perf.costPrice !== null && perf.currentPrice > 0 ? (perf.currentPrice - perf.costPrice) / perf.currentPrice : null;
    return {
      periodDays: days,
      product: perf,
      viewers,
      buyers,
      marginRate: marginRate === null ? null : Math.round(marginRate * 1000) / 1000,
      reviews: feedback.map((r) => ({ rating: r.rating, title: r.title, comment: r.comment?.slice(0, 300) ?? null, approved: r.isApproved })),
      refundReasons: reasons,
      thresholds: INSIGHT_RULES,
    };
  }

  /** 9.2 OVERALL / 9.3 snapshot of the whole store. */
  async getStoreSnapshot() {
    const { from, to } = this.analytics.period();
    const [overview, insights, top, lowStock, recent] = await Promise.all([
      this.analytics.overview(),
      this.analytics.insights(),
      this.products.performance({ from, to, sortBy: 'revenue', desc: true, limit: 5 }),
      this.products.lowStock(10),
      this.orders.recentForAdmin(5),
    ]);
    const bottom = (await this.products.performance({ from, to, sortBy: 'views', desc: true, limit: 50 }))
      .filter((p) => p.isActive && p.viewsCount > 0)
      .sort((a, b) => a.conversionRate - b.conversionRate)
      .slice(0, 5);
    return {
      overview,
      insights: insights.slice(0, 8),
      topProducts: top.map(({ productId, name, revenue, unitsSold, viewsCount, conversionRate }) => ({ productId, name, revenue, unitsSold, viewsCount, conversionRate })),
      weakestConverters: bottom.map(({ productId, name, viewsCount, unitsSold, conversionRate }) => ({ productId, name, viewsCount, unitsSold, conversionRate })),
      lowStock,
      recentOrders: recent.map((o) => ({ orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, totalAmount: o.totalAmount, createdAt: o.createdAt })),
    };
  }

  async getCustomerSnapshot() {
    return { overview: await this.analytics.overview(), customers: await this.analytics.customers() };
  }

  async getInventorySnapshot() {
    const [lowStock, insights] = await Promise.all([this.products.lowStock(30), this.analytics.insights()]);
    return { lowStock, stockoutRisks: insights.filter((i) => i.category === 'STOCKOUT_RISK') };
  }
}
