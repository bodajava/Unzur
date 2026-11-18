import { formatEgp } from '../../common/utilities/emails/order.template.js';
import type { PublicCatalogContext, StoreIntelligenceService } from './store-intelligence.service.js';

export type Lang = 'ar' | 'en';
export const detectLang = (text?: string | null): Lang => (text && /[؀-ۿ]/.test(text) ? 'ar' : text ? 'en' : 'ar');
const t = (lang: Lang, ar: string, en: string) => (lang === 'ar' ? ar : en);
const egp = (lang: Lang, piasters: number) => t(lang, `${formatEgp(piasters)} جنيه`, `EGP ${formatEgp(piasters)}`);
const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

type Diagnostics = Awaited<ReturnType<StoreIntelligenceService['getProductDiagnostics']>>;
type Snapshot = Awaited<ReturnType<StoreIntelligenceService['getStoreSnapshot']>>;

export interface Finding {
  code: string;
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
  text: string;
}

export interface CitedMetric {
  label: string;
  value: string;
}

// ───────────── 9.1 Customer assistant ─────────────

const SHIPPING_WORDS = /شحن|توصيل|delivery|shipping|ship/i;

export function customerFallback(ctx: PublicCatalogContext, message: string): string {
  const lang = detectLang(message);
  const lines: string[] = [];
  if (ctx.products.length) {
    lines.push(t(lang, 'دي المنتجات اللي ممكن تناسبك:', 'Here is what we have that matches:'));
    for (const p of ctx.products.slice(0, 3)) {
      const status = {
        IN_STOCK: t(lang, 'متوفر', 'in stock'),
        LOW_STOCK: t(lang, 'كمية محدودة', 'only a few left'),
        OUT_OF_STOCK: t(lang, 'غير متوفر حالياً', 'out of stock'),
      }[p.availability];
      const was = p.originalPricePiasters ? t(lang, ` (بدل ${egp(lang, p.originalPricePiasters)})`, ` (was ${egp(lang, p.originalPricePiasters)})`) : '';
      lines.push(`• ${p.name}: ${egp(lang, p.pricePiasters)}${was} — ${status}`);
    }
  } else {
    lines.push(t(lang, 'مش لاقي منتج مطابق لسؤالك. جرّب تكتب اسم المنتج أو نوعه.', 'I could not find a matching product. Try the product name or type.'));
  }
  if (SHIPPING_WORDS.test(message) && ctx.shipping.zones.length) {
    const fees = ctx.shipping.zones.map((z) => z.feePiasters);
    lines.push(
      t(lang, `الشحن من ${egp(lang, Math.min(...fees))} لـ ${egp(lang, Math.max(...fees))} حسب المحافظة.`, `Shipping is ${egp(lang, Math.min(...fees))}–${egp(lang, Math.max(...fees))} depending on the governorate.`),
    );
    if (ctx.shipping.freeShippingThresholdPiasters !== null) {
      lines.push(t(lang, `والشحن مجاني للطلبات من ${egp(lang, ctx.shipping.freeShippingThresholdPiasters)}.`, `Free shipping on orders from ${egp(lang, ctx.shipping.freeShippingThresholdPiasters)}.`));
    }
  }
  return lines.join('\n');
}

// ───────────── 9.2 Product diagnostics ─────────────

export function diagnoseProduct(d: Diagnostics, lang: Lang): { findings: Finding[]; actions: string[] } {
  const p = d.product;
  const R = d.thresholds;
  const findings: Finding[] = [];
  const actions: string[] = [];
  const issues = p.refundCount + p.cancellationCount;

  findings.push({
    code: 'VIEWS_VS_SALES',
    severity: 'INFO',
    text: t(
      lang,
      `آخر ${d.periodDays} يوم: ${d.viewers.views} مشاهدة من ${d.viewers.uniqueViewers} زائر (${d.viewers.registeredViewers} مسجّل، ${d.viewers.guestViewers} ضيف، ${d.viewers.anonymousViews} مشاهدة مجهولة). اشترى ${d.buyers.buyers} عميل (${d.buyers.registeredBuyers} مسجّل، ${d.buyers.guestBuyers} ضيف) ${d.buyers.unitsSold} قطعة، ومن اللي شافوه اشترى ${d.viewers.viewersWhoBought}. معدل التحويل ${percent(p.conversionRate)}.`,
      `Last ${d.periodDays} days: ${d.viewers.views} views from ${d.viewers.uniqueViewers} visitors (${d.viewers.registeredViewers} registered, ${d.viewers.guestViewers} guests, ${d.viewers.anonymousViews} anonymous views). ${d.buyers.buyers} customers bought (${d.buyers.registeredBuyers} registered, ${d.buyers.guestBuyers} guests) ${d.buyers.unitsSold} units; ${d.viewers.viewersWhoBought} of the viewers bought. Conversion ${percent(p.conversionRate)}.`,
    ),
  });

  if (p.viewsCount >= R.lowConversionMinViews && p.conversionRate < R.lowConversionRate) {
    findings.push({ code: 'LOW_CONVERSION', severity: 'HIGH', text: t(lang, 'ناس كتير بتشوفه وقليل اللي بيشتري.', 'Many people look at it, few buy it.') });
    actions.push(t(lang, 'حسّن الصور والوصف، وجرّب سعر أقل أو كوبون للمنتج ده، واعرض التقييمات.', 'Improve photos and description, test a lower price or a product coupon, and show reviews.'));
  }
  if (p.stock <= 0 && p.viewsCount > 0) {
    findings.push({ code: 'OUT_OF_STOCK', severity: 'HIGH', text: t(lang, 'المنتج خلصان والناس لسه بتدوّر عليه.', 'It is out of stock while people are still looking for it.') });
    actions.push(t(lang, 'اطلب كمية جديدة فوراً (العملاء يقدروا يطلبوا تنبيه لما يرجع).', 'Restock now (customers can ask to be notified when it is back).'));
  }
  if (p.averageRating !== null && p.averageRating < 3.5) {
    findings.push({ code: 'LOW_RATING', severity: 'HIGH', text: t(lang, `متوسط التقييم ${p.averageRating} من 5 (${p.reviewCount} تقييم).`, `Average rating is ${p.averageRating}/5 (${p.reviewCount} reviews).`) });
  }
  const negative = d.reviews.filter((r) => r.rating <= 2 && (r.comment || r.title)).slice(0, 2);
  if (negative.length) {
    const quotes = negative.map((r) => `"${(r.comment ?? r.title ?? '').slice(0, 120)}"`).join(' · ');
    findings.push({ code: 'NEGATIVE_REVIEWS', severity: 'MEDIUM', text: t(lang, `تعليقات سلبية: ${quotes}`, `Negative feedback: ${quotes}`) });
    actions.push(t(lang, 'اقرأ التعليقات السلبية وصلّح سبب المشكلة (الجودة، التغليف، الوصف).', 'Read the negative reviews and fix the cause (quality, packaging, description).'));
  }
  if (issues >= R.refundMinIssues) {
    const reasons = d.refundReasons.map((r) => `"${r.reason}" ×${r.count}`).join(', ');
    findings.push({
      code: 'REFUNDS',
      severity: issues / Math.max(p.unitsSold + issues, 1) >= R.refundRate ? 'HIGH' : 'MEDIUM',
      text: t(lang, `${p.refundCount} استرداد و${p.cancellationCount} إلغاء. الأسباب: ${reasons || 'غير مسجّلة'}.`, `${p.refundCount} refunds and ${p.cancellationCount} cancellations. Reasons: ${reasons || 'not recorded'}.`),
    });
    if (d.refundReasons[0]) actions.push(t(lang, `عالج أكتر سبب للاسترداد: "${d.refundReasons[0].reason}".`, `Fix the top refund reason: "${d.refundReasons[0].reason}".`));
  }
  if (d.marginRate === null) {
    findings.push({ code: 'NO_COST', severity: 'INFO', text: t(lang, 'سعر التكلفة مش متسجّل، فمش هنقدر نحسب الربح.', 'Cost price is missing, so profit cannot be calculated.') });
    actions.push(t(lang, 'سجّل سعر التكلفة للمنتج.', 'Add the product cost price.'));
  } else if (d.marginRate < 0.15) {
    findings.push({ code: 'LOW_MARGIN', severity: 'MEDIUM', text: t(lang, `هامش الربح ${percent(d.marginRate)} بس.`, `Margin is only ${percent(d.marginRate)}.`) });
    actions.push(t(lang, 'راجع سعر المورّد أو سعر البيع.', 'Review the supplier cost or the selling price.'));
  }
  if (p.conversionRate >= 0.05 && p.unitsSold >= 3 && (p.averageRating === null || p.averageRating >= 4)) {
    findings.push({ code: 'STRONG', severity: 'INFO', text: t(lang, 'أداء قوي: تحويل عالي وتقييم كويس.', 'Strong performer: high conversion and good ratings.') });
    actions.push(t(lang, 'روّج له في الصفحة الرئيسية والنشرة البريدية.', 'Promote it on the home page and in the newsletter.'));
  }
  if (p.viewsCount < 5) {
    findings.push({ code: 'NO_TRAFFIC', severity: 'MEDIUM', text: t(lang, 'المنتج مش بيوصل لناس كفاية.', 'The product gets very little traffic.') });
    actions.push(t(lang, 'خليه Featured وروّج له على السوشيال.', 'Feature it and promote it on social media.'));
  }
  return { findings, actions };
}

export function productCitedMetrics(d: Diagnostics): CitedMetric[] {
  const p = d.product;
  return [
    { label: 'views', value: String(p.viewsCount) },
    { label: 'uniqueViewers', value: String(d.viewers.uniqueViewers) },
    { label: 'unitsSold', value: String(p.unitsSold) },
    { label: 'buyers', value: String(d.buyers.buyers) },
    { label: 'viewersWhoBought', value: String(d.viewers.viewersWhoBought) },
    { label: 'conversionRate', value: percent(p.conversionRate) },
    { label: 'revenuePiasters', value: String(p.revenue) },
    { label: 'averageRating', value: p.averageRating === null ? 'n/a' : String(p.averageRating) },
    { label: 'refunds', value: String(p.refundCount) },
    { label: 'cancellations', value: String(p.cancellationCount) },
    { label: 'marginRate', value: d.marginRate === null ? 'n/a' : percent(d.marginRate) },
    { label: 'stock', value: String(p.stock) },
  ];
}

export function writeProductAnalysis(d: Diagnostics, lang: Lang): string {
  const { findings, actions } = diagnoseProduct(d, lang);
  const head = t(lang, `تحليل "${d.product.name}":`, `Analysis of "${d.product.name}":`);
  const body = findings.map((f) => `• ${f.text}`).join('\n');
  const todo = actions.length ? `\n${t(lang, 'المطلوب:', 'Recommended actions:')}\n${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : '';
  return `${head}\n${body}${todo}`;
}

// ───────────── 9.2 overall / 9.3 chat ─────────────

export function snapshotCitedMetrics(s: Snapshot): CitedMetric[] {
  const o = s.overview;
  return [
    { label: 'revenuePiasters30d', value: String(o.totalRevenue) },
    { label: 'orders30d', value: String(o.totalOrders) },
    { label: 'averageOrderValuePiasters', value: String(o.averageOrderValue) },
    { label: 'conversionRate', value: percent(o.conversionRate) },
    { label: 'newCustomers', value: String(o.newCustomers) },
    { label: 'returningCustomers', value: String(o.returningCustomers) },
    { label: 'pendingOrders', value: String(o.pendingOrdersCount) },
    { label: 'lowStockItems', value: String(s.lowStock.length) },
  ];
}

export function writeStoreSummary(s: Snapshot, lang: Lang, message?: string): string {
  const o = s.overview;
  const lines: string[] = [];
  const topic = message ?? '';
  const wantsStock = /مخزون|stock|inventory|خلص/i.test(topic);
  const wantsOrders = /طلب|اوردر|أوردر|order/i.test(topic);
  const wantsProducts = /منتج|أفضل|افضل|product|best|top/i.test(topic);

  lines.push(
    t(
      lang,
      `آخر 30 يوم: مبيعات ${egp(lang, o.totalRevenue)} من ${o.totalOrders} طلب (متوسط ${egp(lang, o.averageOrderValue)}). عملاء جدد ${o.newCustomers}، راجعين ${o.returningCustomers}. معدل التحويل ${percent(o.conversionRate)}. طلبات مفتوحة دلوقتي: ${o.pendingOrdersCount}.`,
      `Last 30 days: ${egp(lang, o.totalRevenue)} revenue from ${o.totalOrders} orders (avg ${egp(lang, o.averageOrderValue)}). ${o.newCustomers} new and ${o.returningCustomers} returning customers. Conversion ${percent(o.conversionRate)}. Open orders now: ${o.pendingOrdersCount}.`,
    ),
  );
  if (wantsStock || !topic) {
    lines.push(
      s.lowStock.length
        ? `${t(lang, 'مخزون قليل:', 'Low stock:')} ${s.lowStock.slice(0, 5).map((i) => `${i.name}${i.variantName ? ` (${i.variantName})` : ''}: ${i.stock}`).join('، ')}`
        : t(lang, 'مفيش منتجات مخزونها قليل.', 'No low-stock items.'),
    );
  }
  if (wantsProducts || !topic) {
    if (s.topProducts.length) {
      lines.push(`${t(lang, 'الأعلى مبيعاً:', 'Top sellers:')} ${s.topProducts.slice(0, 3).map((p) => `${p.name} (${egp(lang, p.revenue)})`).join('، ')}`);
    }
    if (s.weakestConverters.length) {
      lines.push(`${t(lang, 'أضعف تحويل:', 'Weakest conversion:')} ${s.weakestConverters.slice(0, 3).map((p) => `${p.name} (${p.viewsCount} ${t(lang, 'مشاهدة', 'views')}، ${p.unitsSold} ${t(lang, 'مبيع', 'sold')})`).join('، ')}`);
    }
  }
  if (wantsOrders) {
    lines.push(`${t(lang, 'آخر الطلبات:', 'Latest orders:')} ${s.recentOrders.map((r) => `${r.orderNumber} ${r.status} ${egp(lang, r.totalAmount)}`).join('، ') || '-'}`);
  }
  const urgent = s.insights.filter((i) => i.severity === 'HIGH').slice(0, 3);
  if (urgent.length) lines.push(`${t(lang, 'محتاج انتباه:', 'Needs attention:')} ${urgent.map((i) => i.title).join('؛ ')}`);
  return lines.join('\n');
}
