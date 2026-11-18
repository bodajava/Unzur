import { BadRequestException } from '@nestjs/common';
import { Lang } from '../../common/enums/index.js';
import { AnalyticsService } from './analytics.service.js';

const row = (o: Record<string, unknown>) => ({
  productId: 'p', name: 'P', nameAr: null, slug: 'p', isActive: true, viewsCount: 0, unitsSold: 0, conversionRate: 0, revenue: 0,
  costPrice: null, currentPrice: 10_000, estimatedProfit: null, averageRating: null, reviewCount: 0, refundCount: 0,
  cancellationCount: 0, stock: 100, lowStockThreshold: 5, ...o,
});

function setup(rows: unknown[]) {
  const products = { performance: vi.fn().mockResolvedValue(rows) };
  const orders = { reasonsForProduct: vi.fn().mockResolvedValue([{ reason: 'Too small', count: 3 }]) };
  return new AnalyticsService(orders as never, products as never, {} as never);
}

describe('AnalyticsService', () => {
  const range = { fromDate: new Date('2026-10-18T00:00:00Z'), toDate: new Date('2026-11-17T00:00:00Z') }; // 30 days

  it('flags low conversion, refunds, stockout risk and profitable best sellers, HIGH first', async () => {
    const svc = setup([
      row({ productId: 'promo', name: 'Promo', unitsSold: 3, viewsCount: 10, conversionRate: 0.3, costPrice: 4_000, estimatedProfit: 18_000 }),
      row({ productId: 'views', name: 'Views', viewsCount: 40, unitsSold: 0 }),
      row({ productId: 'refund', name: 'Refund', unitsSold: 4, viewsCount: 5, refundCount: 2, cancellationCount: 1 }),
      row({ productId: 'stock', name: 'Stock', unitsSold: 30, viewsCount: 10, stock: 2 }),
    ]);
    const cards = await svc.insights(range);
    expect(cards.map((c) => [c.severity, c.category, c.productId])).toEqual([
      ['HIGH', 'LOW_CONVERSION', 'views'],
      ['HIGH', 'REFUNDS', 'refund'],
      ['HIGH', 'STOCKOUT_RISK', 'stock'],
      ['INFO', 'PROMOTE', 'promo'],
    ]);
    expect(cards[1].description).toContain('"Too small"');
    expect(cards[2].title).toContain('about 2 days');
  });

  it('writes the cards in Arabic for Arabic readers, with the Arabic product name', async () => {
    const svc = setup([row({ productId: 'views', name: 'Views', nameAr: 'مشاهدات', viewsCount: 40, unitsSold: 0 })]);
    const [card] = await svc.insights(range, Lang.AR);
    expect(card.title).toBe('مشاهدات: مشاهدات كتير ومبيعات قليلة');
    expect(card.description).toContain('40 مشاهدة');
  });

  it('validates the date range', () => {
    const svc = setup([]);
    expect(() => svc.period({ fromDate: new Date('2026-01-02'), toDate: new Date('2026-01-01') })).toThrow(BadRequestException);
    expect(() => svc.period({ fromDate: new Date('2020-01-01'), toDate: new Date('2026-01-01') })).toThrow('at most 2 years');
    expect(svc.period({}).days).toBeCloseTo(30);
  });
});
