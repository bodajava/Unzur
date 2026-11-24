import { Lang } from '../../enums/http.enum.js';
import { OrderStatus } from '../../enums/prisma.enums.js';
import { escapeHtml } from './escape-html.js';
import { BRAND, emailButton, layoutTemplate } from './layout.template.js';
import type { RenderedEmail } from './otp.template.js';

/** Piasters -> "185.50" */
export const formatEgp = (piasters: number): string =>
  (piasters / 100).toFixed(2).replace(/\.00$/, '');

/** Piasters -> "2,740" (thousands separated, for emails people read). */
const money = (piasters: number): string =>
  (piasters / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const STATUS_LABELS: Record<OrderStatus, { ar: string; en: string }> = {
  [OrderStatus.PENDING_PAYMENT]: { ar: 'في انتظار الدفع', en: 'Awaiting payment' },
  [OrderStatus.CONFIRMED]: { ar: 'تم التأكيد', en: 'Confirmed' },
  [OrderStatus.PREPARING]: { ar: 'جاري التجهيز', en: 'Being prepared' },
  [OrderStatus.SHIPPED]: { ar: 'تم الشحن', en: 'Shipped' },
  [OrderStatus.DELIVERED]: { ar: 'تم التوصيل', en: 'Delivered' },
  [OrderStatus.CANCELLED]: { ar: 'تم الإلغاء', en: 'Cancelled' },
  [OrderStatus.REFUNDED]: { ar: 'تم استرداد المبلغ', en: 'Refunded' },
};

export interface OrderEmailItem {
  productName: string;
  variantName: string | null;
  quantity: number;
  priceAtPurchase: number;
  imageUrl?: string | null;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  totalAmount: number;
  items: OrderEmailItem[];
  trackUrl: string;
  note?: string | null;
}

type Kind = 'created' | 'status' | 'paid';
type Line = { ar: string; en: string };

/** What the customer reads first: one plain sentence per moment. */
const HEADLINE: Record<'created' | 'paid', Line> & Partial<Record<OrderStatus, Line>> = {
  created: { ar: 'استلمنا طلبك، شكراً ليك!', en: 'We got your order. Thank you!' },
  paid: { ar: 'وصلنا الدفع، وطلبك اتأكد.', en: 'Payment received. Your order is confirmed.' },
  [OrderStatus.CONFIRMED]: { ar: 'طلبك اتأكد.', en: 'Your order is confirmed.' },
  [OrderStatus.PREPARING]: { ar: 'بنجهّز طلبك دلوقتي.', en: 'We are preparing your order.' },
  [OrderStatus.SHIPPED]: { ar: 'طلبك خرج للتوصيل وفي الطريق ليك.', en: 'Your order is on its way.' },
  [OrderStatus.DELIVERED]: { ar: 'طلبك وصل. نتمنى يعجبك!', en: 'Your order was delivered. Enjoy it!' },
  [OrderStatus.CANCELLED]: { ar: 'طلبك اتلغى.', en: 'Your order was cancelled.' },
  [OrderStatus.REFUNDED]: { ar: 'رجّعنالك فلوس الطلب.', en: 'Your order was refunded.' },
};

/** The one-line news for an order event, in both languages (emails and push notifications). */
export function orderHeadline(kind: Kind, status: OrderStatus): Line {
  return (kind === 'status' ? HEADLINE[status] : HEADLINE[kind]) ?? HEADLINE.created;
}

/** The steps a normal order goes through, for the progress line. */
const STEPS: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED];

function progress(status: OrderStatus): string {
  const reached = STEPS.indexOf(status === OrderStatus.PENDING_PAYMENT ? OrderStatus.CONFIRMED : status);
  if (reached < 0) return ''; // cancelled / refunded: no progress line
  const cells = STEPS.map((s, i) => {
    const on = i <= reached && status !== OrderStatus.PENDING_PAYMENT;
    return `<td style="padding:0 2px;vertical-align:top;text-align:center;font-size:11px;color:${on ? BRAND.blue : BRAND.muted}">
      <div style="height:6px;border-radius:3px;background:${on ? BRAND.blue : BRAND.line};margin-bottom:6px"></div>${STATUS_LABELS[s].ar}<br><span style="font-size:10px">${STATUS_LABELS[s].en}</span></td>`;
  }).join('');
  return `<table role="presentation" width="100%" style="margin:20px 0;table-layout:fixed" dir="rtl"><tr>${cells}</tr></table>`;
}

/** Only real web images go in an email (no data: or relative URLs). */
const imageOf = (url?: string | null): string | null => (url && /^https:\/\//.test(url) ? url : null);

/** Product rows with a small photo, name, variant, quantity and line total. */
function itemRows(items: OrderEmailItem[], end: 'left' | 'right' = 'left'): string {
  return items
    .map((i) => {
      const img = imageOf(i.imageUrl);
      const photo = img
        ? `<img src="${escapeHtml(img)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:12px;background:${BRAND.haze};border:0">`
        : `<div style="width:56px;height:56px;border-radius:12px;background:${BRAND.haze}"></div>`;
      const variant = i.variantName ? `<br><span style="color:${BRAND.muted};font-size:13px">${escapeHtml(i.variantName)}</span>` : '';
      return (
        `<tr><td width="68" style="padding:10px 0;border-bottom:1px solid ${BRAND.line};vertical-align:middle">${photo}</td>` +
        `<td style="padding:10px 8px;border-bottom:1px solid ${BRAND.line};vertical-align:middle"><b>${escapeHtml(i.productName)}</b>${variant}<br><span dir="ltr" style="color:${BRAND.muted};font-size:13px">× ${i.quantity} · ${money(i.priceAtPurchase)} EGP</span></td>` +
        `<td dir="ltr" style="padding:10px 0;border-bottom:1px solid ${BRAND.line};vertical-align:middle;text-align:${end};white-space:nowrap;font-weight:700">${money(i.priceAtPurchase * i.quantity)} EGP</td></tr>`
      );
    })
    .join('');
}

/** Full details of a new order for the store's orders inbox. */
export interface StoreOrderEmailData {
  orderNumber: string;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: { governorate?: string; city?: string; street?: string; building?: string; floor?: string; apartment?: string };
  items: OrderEmailItem[];
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  giftCardAmount: number;
  loyaltyDiscount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: OrderStatus;
  couponCode: string | null;
  notes: string | null;
  adminUrl: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  COD: 'الدفع عند الاستلام · Cash on delivery',
  PAYMOB_CARD: 'كارت (Paymob) · Card',
  PAYMOB_WALLET: 'محفظة (Paymob) · Wallet',
};

/** The staff email: everything needed to prepare and ship the order, in one place. */
export function storeOrderEmail(brandName: string, d: StoreOrderEmailData, kind: 'created' | 'paid' = 'created'): RenderedEmail {
  const a = d.shippingAddress ?? {};
  const address = [
    a.street,
    a.building && `عمارة ${a.building}`,
    a.floor && `دور ${a.floor}`,
    a.apartment && `شقة ${a.apartment}`,
    a.city,
    a.governorate,
  ]
    .filter(Boolean)
    .map((p) => escapeHtml(String(p)))
    .join('، ');
  const phone = escapeHtml(d.customerPhone);
  const waPhone = d.customerPhone.replace(/\D/g, '').replace(/^0/, '20');
  const label = (t: string) => `<td style="padding:6px 12px 6px 0;color:${BRAND.muted};font-size:13px;white-space:nowrap;vertical-align:top">${t}</td>`;
  const info = [
    ['Customer · العميل', `<b>${escapeHtml(d.customerName)}</b>`],
    ['Phone · الموبايل', `<a href="tel:${phone}" style="color:${BRAND.blue}">${phone}</a> · <a href="https://wa.me/${waPhone}" style="color:${BRAND.blue}">WhatsApp</a>`],
    ['Email', `<a href="mailto:${escapeHtml(d.customerEmail)}?subject=${encodeURIComponent(d.orderNumber)}" style="color:${BRAND.blue}">${escapeHtml(d.customerEmail)}</a>`],
    ['Address · العنوان', `<span dir="rtl">${address || '-'}</span>`],
    ['Payment · الدفع', `${escapeHtml(PAYMENT_LABELS[d.paymentMethod] ?? d.paymentMethod)} · <b>${escapeHtml(d.paymentStatus)}</b>`],
    ['Status · الحالة', `${STATUS_LABELS[d.status].en} · ${STATUS_LABELS[d.status].ar}`],
    ...(d.couponCode ? [['Coupon · الكوبون', `<b dir="ltr">${escapeHtml(d.couponCode)}</b>`]] : []),
    ['Placed · وقت الطلب', d.createdAt.toLocaleString('en-GB', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' })],
  ]
    .map(([k, v]) => `<tr>${label(k)}<td style="padding:6px 0;font-size:14px">${v}</td></tr>`)
    .join('');
  const sum = (k: string, v: number, minus = false) =>
    v > 0 ? `<tr><td colspan="2" style="padding:4px 0;color:${BRAND.muted}">${k}</td><td dir="ltr" style="padding:4px 0;text-align:right;white-space:nowrap">${minus ? '- ' : ''}${money(v)} EGP</td></tr>` : '';
  const notes = d.notes
    ? `<p style="margin:16px 0 0;padding:12px 14px;border-radius:12px;background:${BRAND.haze};white-space:pre-wrap"><b>Customer note</b><br>${escapeHtml(d.notes)}</p>`
    : '';
  const count = d.items.reduce((n, i) => n + i.quantity, 0);
  const headline = kind === 'paid' ? 'Payment received · وصل الدفع' : 'New order · طلب جديد';

  const body = `
    <p style="margin:0 0 4px;color:${BRAND.muted};font-size:13px;letter-spacing:1px;text-transform:uppercase">${headline}</p>
    <h1 dir="ltr" style="margin:0 0 4px;font-size:26px;line-height:1.2;color:${BRAND.blue}">${escapeHtml(d.orderNumber)}</h1>
    <p style="margin:0 0 20px;font-size:15px"><b>${money(d.totalAmount)} EGP</b> · ${count} ${count === 1 ? 'piece' : 'pieces'}</p>
    <p style="margin:0 0 16px;padding:10px 14px;border-radius:12px;background:${BRAND.haze};font-size:13px">🖨️ <b>${escapeHtml(d.orderNumber)}.pdf</b> is attached, ready to print · <span dir="rtl">ملف الطلب مرفق جاهز للطباعة</span></p>
    <table role="presentation" width="100%" style="margin:0 0 20px;border-top:1px solid ${BRAND.line};padding-top:8px">${info}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${itemRows(d.items, 'right')}
      <tr><td colspan="3" style="height:8px"></td></tr>
      ${sum('Subtotal · المجموع', d.subtotal)}
      <tr><td colspan="2" style="padding:4px 0;color:${BRAND.muted}">Shipping · الشحن</td><td dir="ltr" style="padding:4px 0;text-align:right;white-space:nowrap">${d.shippingCost > 0 ? `${money(d.shippingCost)} EGP` : 'Free'}</td></tr>
      ${sum('Discount · الخصم', d.discountAmount, true)}
      ${sum('Gift card · بطاقة هدية', d.giftCardAmount, true)}
      ${sum('Points · النقاط', d.loyaltyDiscount, true)}
      <tr><td colspan="2" style="padding:10px 0 0;font-weight:700;font-size:16px;border-top:1px solid ${BRAND.line}">Total · الإجمالي</td><td dir="ltr" style="padding:10px 0 0;text-align:right;white-space:nowrap;font-weight:700;font-size:16px;color:${BRAND.blue};border-top:1px solid ${BRAND.line}">${money(d.totalAmount)} EGP</td></tr>
    </table>
    ${notes}
    ${emailButton(d.adminUrl, 'Open in dashboard · افتح الطلب')}`;

  const text = [
    `${headline}: ${d.orderNumber}`,
    `${d.customerName} | ${d.customerPhone} | ${d.customerEmail}`,
    [a.street, a.building, a.floor, a.apartment, a.city, a.governorate].filter(Boolean).join(', '),
    ...d.items.map((i) => `- ${i.productName}${i.variantName ? ` (${i.variantName})` : ''} x${i.quantity}: ${money(i.priceAtPurchase * i.quantity)} EGP`),
    `Total: ${money(d.totalAmount)} EGP (${d.paymentMethod}, ${d.paymentStatus})`,
    d.notes ? `Note: ${d.notes}` : '',
    d.adminUrl,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject: `${kind === 'paid' ? 'Paid' : 'New order'} ${d.orderNumber} · ${d.customerName} · ${money(d.totalAmount)} EGP`,
    html: layoutTemplate({ lang: Lang.EN, brandName, preheader: `${d.customerName}, ${count} pieces, ${money(d.totalAmount)} EGP`, body }),
    text,
  };
}

/** One bilingual email (Arabic first, then English) for order events. */
export function orderEmail(kind: Kind, brandName: string, d: OrderEmailData): RenderedEmail {
  const status = STATUS_LABELS[d.status];
  const head = orderHeadline(kind, d.status);
  const rows = itemRows(d.items);
  const note = d.note ? `<p style="margin:0 0 12px;padding:12px;border-radius:10px;background:${BRAND.haze}">${escapeHtml(d.note)}</p>` : '';
  const number = escapeHtml(d.orderNumber);

  const body = `
    <div dir="rtl" style="text-align:right">
      <p style="margin:0 0 4px">أهلاً ${escapeHtml(d.customerName)}،</p>
      <h1 style="margin:0 0 8px;font-size:22px;line-height:1.35;color:${BRAND.blue}">${head.ar}</h1>
      <p style="margin:0;color:${BRAND.muted};font-size:14px">طلب رقم <b dir="ltr" style="color:${BRAND.text};white-space:nowrap">${number}</b> · ${status.ar}</p>
    </div>
    ${progress(d.status)}
    ${note}
    <table role="presentation" width="100%" style="margin:8px 0;font-size:14px" dir="rtl">${rows}
      <tr><td colspan="2" style="padding-top:12px;font-weight:bold">الإجمالي / Total</td><td dir="ltr" style="padding-top:12px;text-align:left;font-weight:bold;white-space:nowrap;color:${BRAND.blue}">${money(d.totalAmount)} EGP</td></tr>
    </table>
    ${emailButton(d.trackUrl, 'تابع طلبك / Track your order')}
    <div dir="ltr" style="text-align:left;border-top:1px solid ${BRAND.line};padding-top:16px">
      <p style="margin:0 0 4px">Hi ${escapeHtml(d.customerName)},</p>
      <p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:${BRAND.blue}">${head.en}</p>
      <p style="margin:0;color:${BRAND.muted};font-size:14px">Order <b style="color:${BRAND.text}">${number}</b> · ${status.en}</p>
    </div>`;

  return {
    // The sender name already says UNZUR; keep the subject to the news and the order number.
    subject: `${head.en.replace(/[.!]+$/, '')} · ${d.orderNumber}`,
    html: layoutTemplate({ lang: Lang.AR, brandName, preheader: `${head.en} ${d.orderNumber}`, body }),
    text: `${head.ar} (${d.orderNumber}: ${status.ar})\n${head.en} (${status.en})\n${d.trackUrl}`,
  };
}
