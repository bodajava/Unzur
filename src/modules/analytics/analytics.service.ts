import { BadRequestException, Injectable } from '@nestjs/common';
import { Lang } from '../../common/enums/index.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { ProductViewRepository } from '../../models/repositories/product-view.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import type { AnalyticsRangeDto, ProductsPerformanceDto, SalesTrendDto } from './dto/index.js';
import type {
  AnalyticsBreakdownModel,
  AnalyticsOverviewModel,
  CustomerAnalyticsModel,
  InsightModel,
  ProductPerformanceModel,
  SalesTrendPointModel,
} from './entities/analytics.model.js';

const DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 731;
const MAX_BUCKETS = 400;
const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;
const pct = (current: number, previous: number) =>
  previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;

export interface Period {
  from: Date;
  to: Date;
  days: number;
}

/** Thresholds for 8.5 insights. */
export const INSIGHT_RULES = {
  lowConversionMinViews: 20,
  lowConversionRate: 0.02,
  refundMinIssues: 2,
  refundRate: 0.2,
  stockoutDays: 7,
  stockoutCriticalDays: 3,
  promoteMinUnits: 3,
  promoteMinMargin: 0.3,
} as const;

/** Admin analytics (8.1–8.5). Every number comes from the database. */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly products: ProductRepository,
    private readonly views: ProductViewRepository,
  ) {}

  /** [fromDate, toDate), default the last 30 days, max 2 years. */
  period(range: AnalyticsRangeDto = {}, defaultDays = 30): Period {
    const to = range.toDate ?? new Date();
    const from = range.fromDate ?? new Date(to.getTime() - defaultDays * DAY);
    if (from >= to) throw new BadRequestException('fromDate must be before toDate');
    const days = (to.getTime() - from.getTime()) / DAY;
    if (days > MAX_RANGE_DAYS) throw new BadRequestException('The range can be at most 2 years');
    return { from, to, days };
  }

  // ───────────── 8.1 ─────────────

  async overview(range?: AnalyticsRangeDto): Promise<AnalyticsOverviewModel> {
    const { from, to } = this.period(range);
    const previous = { from: new Date(from.getTime() - (to.getTime() - from.getTime())), to: from };
    const [now, before, split, visitors, pending] = await Promise.all([
      this.orders.salesSummary(from, to),
      this.orders.salesSummary(previous.from, previous.to),
      this.orders.customerSplit(from, to),
      this.views.visitors(from, to),
      this.orders.count({ status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING'] } }),
    ]);
    const aov = now.orders ? Math.round(now.revenue / now.orders) : 0;
    const previousAov = before.orders ? Math.round(before.revenue / before.orders) : 0;
    return {
      fromDate: from,
      toDate: to,
      totalRevenue: now.revenue,
      totalOrders: now.orders,
      averageOrderValue: aov,
      totalCustomers: now.customers,
      newCustomers: split.newCount,
      returningCustomers: split.returningCount,
      guestOrdersCount: now.guestOrders,
      conversionRate: visitors.visitors ? round(now.orders / visitors.visitors) : 0,
      visitors: visitors.visitors,
      pendingOrdersCount: pending,
      deltas: {
        revenue: pct(now.revenue, before.revenue),
        orders: pct(now.orders, before.orders),
        averageOrderValue: pct(aov, previousAov),
        customers: pct(now.customers, before.customers),
      },
    };
  }

  // ───────────── 8.2 ─────────────

  async salesTrend(dto: SalesTrendDto = {}): Promise<SalesTrendPointModel[]> {
    const { from, to, days } = this.period(dto);
    const granularity = dto.granularity ?? 'day';
    const buckets = granularity === 'day' ? days : granularity === 'week' ? days / 7 : days / 28;
    if (buckets > MAX_BUCKETS) throw new BadRequestException('Too many points: use a larger granularity');
    const rows = await this.orders.salesTrend(from, to, granularity);
    return rows.map((r) => ({ ...r, averageOrderValue: r.ordersCount ? Math.round(r.revenue / r.ordersCount) : 0 }));
  }

  // ───────────── 8.3 ─────────────

  productsPerformance(dto: ProductsPerformanceDto = {}): Promise<ProductPerformanceModel[]> {
    const { from, to } = this.period(dto);
    return this.products.performance({
      from,
      to,
      sortBy: dto.sortBy ?? 'revenue',
      desc: (dto.order ?? 'desc') === 'desc',
      limit: dto.limit ?? 20,
    });
  }

  /** Orders by status, payment method, governorate, category and weekday. */
  breakdown(range?: AnalyticsRangeDto): Promise<AnalyticsBreakdownModel> {
    const { from, to } = this.period(range);
    return this.orders.breakdown(from, to);
  }

  // ───────────── 8.4 ─────────────

  async customers(range?: AnalyticsRangeDto): Promise<CustomerAnalyticsModel> {
    const { from, to } = this.period(range);
    const [split, repeat, top] = await Promise.all([
      this.orders.customerSplit(from, to),
      this.orders.repeatCustomers(),
      this.orders.topCustomers(10),
    ]);
    return {
      newVsReturning: split,
      repeatPurchaseRate: repeat.total ? round(repeat.repeaters / repeat.total) : 0,
      topCustomers: top,
    };
  }

  // ───────────── 8.5 ─────────────

  /** Insight cards in the reader's language (the dashboard sends Accept-Language). */
  async insights(range?: AnalyticsRangeDto, lang: Lang = Lang.EN): Promise<InsightModel[]> {
    const period = this.period(range);
    const rows = await this.products.performance({ ...period, sortBy: 'views', desc: true, limit: 500 });
    const cards: InsightModel[] = [];
    const R = INSIGHT_RULES;
    const ar = lang === Lang.AR;
    const nameOf = (p: { name: string; nameAr: string | null }) => (ar && p.nameAr ? p.nameAr : p.name);

    for (const p of rows.filter((r) => r.isActive)) {
      const name = nameOf(p);
      if (p.viewsCount >= R.lowConversionMinViews && p.conversionRate < R.lowConversionRate) {
        const rate = (p.conversionRate * 100).toFixed(1);
        cards.push({
          severity: 'HIGH',
          category: 'LOW_CONVERSION',
          title: ar ? `${name}: مشاهدات كتير ومبيعات قليلة` : `${name}: many views, few sales`,
          description: ar
            ? `${p.viewsCount} مشاهدة واتباع منها ${p.unitsSold} بس (تحويل ${rate}%). راجع السعر والصور والوصف والمخزون.`
            : `${p.viewsCount} views but ${p.unitsSold} sold (${rate}% conversion). Check price, photos, description and stock.`,
          productId: p.productId,
          metricValue: p.conversionRate,
        });
      }
      const issues = p.refundCount + p.cancellationCount;
      if (issues >= R.refundMinIssues && issues / Math.max(p.unitsSold + issues, 1) >= R.refundRate) {
        const [top] = await this.orders.reasonsForProduct(p.productId, 1);
        cards.push({
          severity: 'HIGH',
          category: 'REFUNDS',
          title: ar ? `${name}: مرتجعات وإلغاءات كتير` : `${name}: frequent refunds/cancellations`,
          description: ar
            ? `${p.refundCount} مرتجع و${p.cancellationCount} إلغاء${top ? `. أكتر سبب: "${top.reason}"` : ''}.`
            : `${p.refundCount} refunds and ${p.cancellationCount} cancellations${top ? `. Most common reason: "${top.reason}"` : ''}.`,
          productId: p.productId,
          metricValue: issues,
        });
      }
      if (p.unitsSold > 0) {
        const perDay = p.unitsSold / period.days;
        const daysLeft = p.stock / perDay;
        if (daysLeft <= R.stockoutDays) {
          const days = Math.floor(daysLeft);
          cards.push({
            severity: daysLeft <= R.stockoutCriticalDays ? 'HIGH' : 'MEDIUM',
            category: 'STOCKOUT_RISK',
            title: ar ? `${name}: فاضل مخزون حوالي ${days} يوم` : `${name}: about ${days} days of stock left`,
            description: ar
              ? `بيتباع حوالي ${perDay.toFixed(1)} في اليوم والمخزون ${p.stock}. اطلب كمية جديدة قريب.`
              : `Selling ~${perDay.toFixed(1)} per day with ${p.stock} in stock. Reorder soon.`,
            productId: p.productId,
            metricValue: round(daysLeft, 1),
          });
        }
      }
    }

    // Best sellers with a healthy margin: worth promoting.
    rows
      .filter((p) => p.isActive && p.costPrice !== null && p.currentPrice > 0 && p.unitsSold >= R.promoteMinUnits)
      .map((p) => ({ p, margin: (p.currentPrice - (p.costPrice ?? 0)) / p.currentPrice }))
      .filter(({ margin }) => margin >= R.promoteMinMargin)
      .sort((a, b) => (b.p.estimatedProfit ?? 0) - (a.p.estimatedProfit ?? 0))
      .slice(0, 3)
      .forEach(({ p, margin }) =>
        cards.push({
          severity: 'INFO',
          category: 'PROMOTE',
          title: ar ? `${nameOf(p)}: من الأكثر مبيعًا وبربح كويس` : `${nameOf(p)}: profitable best seller`,
          description: ar
            ? `اتباع منها ${p.unitsSold} بهامش ربح ${Math.round(margin * 100)}%. حطّها في الواجهة أو اعمل عليها عرض.`
            : `${p.unitsSold} sold at a ${Math.round(margin * 100)}% margin. Feature it or bundle it.`,
          productId: p.productId,
          metricValue: round(margin),
        }),
      );

    const rank = { HIGH: 0, MEDIUM: 1, INFO: 2 };
    return cards.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }
}
