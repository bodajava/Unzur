import { ConfigService } from '@nestjs/config';
import { INSIGHT_RULES } from '../analytics/analytics.service.js';
import { AiGatewayClient } from './ai-gateway.client.js';
import { AiService } from './ai.service.js';
import { customerFallback, detectLang, diagnoseProduct } from './fallback-writer.js';

const context = {
  currency: 'EGP' as const,
  products: [
    {
      id: 'p1', name: 'قهوة تركي', slug: 'turkish', category: 'Coffee', brand: null, description: null,
      pricePiasters: 15_000, originalPricePiasters: 18_000, availability: 'LOW_STOCK' as const, variants: [],
    },
  ],
  shipping: { freeShippingThresholdPiasters: 100_000, zones: [{ governorate: 'Cairo', nameAr: 'القاهرة', feePiasters: 5_000, estimatedDays: '2' }] },
};

function diagnostics(overrides: Record<string, unknown> = {}) {
  return {
    periodDays: 30,
    product: {
      productId: 'p1', name: 'Mug', slug: 'mug', isActive: true, viewsCount: 60, unitsSold: 1, conversionRate: 0.0167,
      revenue: 10_000, costPrice: 9_500, currentPrice: 10_000, estimatedProfit: 500, averageRating: 1, reviewCount: 1,
      refundCount: 2, cancellationCount: 0, stock: 20, lowStockThreshold: 5,
    },
    viewers: { views: 60, uniqueViewers: 56, registeredViewers: 1, guestViewers: 55, anonymousViews: 0, viewersWhoBought: 1 },
    buyers: { buyers: 1, registeredBuyers: 1, guestBuyers: 0, unitsSold: 1, orders: 1, repeatBuyers: 0 },
    marginRate: 0.05,
    reviews: [{ rating: 1, title: null, comment: 'Package was crushed', approved: true }],
    refundReasons: [{ status: 'REFUNDED', reason: 'Arrived damaged', count: 2 }],
    thresholds: INSIGHT_RULES,
    ...overrides,
  } as never;
}

describe('AI fallback writer', () => {
  it('answers customers in their language from public data only', () => {
    expect(detectLang('بكام القهوة؟')).toBe('ar');
    const reply = customerFallback(context, 'بكام القهوة والشحن؟');
    expect(reply).toContain('150 جنيه');
    expect(reply).toContain('بدل 180 جنيه');
    expect(reply).toContain('كمية محدودة');
    expect(reply).toContain('مجاني للطلبات من 1000 جنيه');
    expect(customerFallback(context, 'price?')).toContain('EGP 150');
  });

  it('explains a weak product with views vs buyers, reviews, refund reasons and margin', () => {
    const { findings, actions } = diagnoseProduct(diagnostics(), 'en');
    expect(findings.map((f) => f.code)).toEqual(['VIEWS_VS_SALES', 'LOW_CONVERSION', 'LOW_RATING', 'NEGATIVE_REVIEWS', 'REFUNDS', 'LOW_MARGIN']);
    expect(findings[0].text).toContain('60 views from 56 visitors (1 registered, 55 guests');
    expect(findings.find((f) => f.code === 'REFUNDS')?.text).toContain('"Arrived damaged" ×2');
    expect(actions.join(' ')).toContain('Fix the top refund reason');
  });
});

describe('AiService', () => {
  it('uses the model when configured, never sends costPrice in the customer prompt, and falls back on failure', async () => {
    const intelligence = { getPublicCatalogContext: vi.fn().mockResolvedValue(context) };
    const products = { findCardsByIds: vi.fn().mockResolvedValue([{ id: 'p1', name: 'x', slug: 'x', images: [] }]) };
    const gateway = { complete: vi.fn().mockResolvedValue('Hello!') };
    const svc = new AiService(intelligence as never, gateway as never, products as never, new ConfigService({}));

    const ok = await svc.customerChat({ message: 'hi', history: [{ role: 'user', content: 'earlier' }] });
    expect(ok).toMatchObject({ reply: 'Hello!', source: 'ai' });
    const sent = JSON.stringify(gateway.complete.mock.calls[0][0]);
    expect(sent).not.toMatch(/costPrice|cost_price/);
    expect(gateway.complete.mock.calls[0][0].map((m: { role: string }) => m.role)).toEqual(['system', 'user', 'user']);

    gateway.complete.mockResolvedValueOnce(null);
    expect((await svc.customerChat({ message: 'بكام؟' })).source).toBe('data');
  });

  it('gateway returns null without a key or on errors', async () => {
    expect(await new AiGatewayClient(new ConfigService({})).complete([{ role: 'user', content: 'x' }])).toBeNull();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{"choices":[{"message":{"content":" hi "}}]}'));
    const client = new AiGatewayClient(new ConfigService({ AI_API_KEY: 'k', AI_BASE_URL: 'https://llm.local/v1/' }));
    expect(await client.complete([{ role: 'user', content: 'x' }])).toBe('hi');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://llm.local/v1/chat/completions');
    fetchSpy.mockRejectedValueOnce(new Error('down'));
    expect(await client.complete([{ role: 'user', content: 'x' }])).toBeNull();
    fetchSpy.mockRestore();
  });
});
