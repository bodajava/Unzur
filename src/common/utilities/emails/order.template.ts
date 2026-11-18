import { Lang } from '../../enums/http.enum.js';
import { OrderStatus } from '../../enums/prisma.enums.js';
import { escapeHtml } from './escape-html.js';
import { BRAND, layoutTemplate } from './layout.template.js';
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

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  totalAmount: number;
  items: { productName: string; variantName: string | null; quantity: number; priceAtPurchase: number }[];
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

/** One bilingual email (Arabic first, then English) for order events. */
export function orderEmail(kind: Kind, brandName: string, d: OrderEmailData): RenderedEmail {
  const status = STATUS_LABELS[d.status];
  const head = orderHeadline(kind, d.status);
  const rows = d.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.line}">${escapeHtml(i.productName)}${i.variantName ? ` <span style="color:${BRAND.muted}">(${escapeHtml(i.variantName)})</span>` : ''} × ${i.quantity}</td>` +
        `<td dir="ltr" style="padding:8px 0;border-bottom:1px solid ${BRAND.line};text-align:left;white-space:nowrap">${money(i.priceAtPurchase * i.quantity)} EGP</td></tr>`,
    )
    .join('');
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
      <tr><td style="padding-top:10px;font-weight:bold">الإجمالي / Total</td><td dir="ltr" style="padding-top:10px;text-align:left;font-weight:bold;white-space:nowrap">${money(d.totalAmount)} EGP</td></tr>
    </table>
    <p style="margin:24px 0;text-align:center"><a href="${escapeHtml(d.trackUrl)}" style="display:inline-block;background:${BRAND.blue};color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">تابع طلبك / Track your order</a></p>
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
