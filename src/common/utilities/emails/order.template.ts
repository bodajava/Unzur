import { Lang } from '../../enums/http.enum.js';
import { OrderStatus } from '../../enums/prisma.enums.js';
import { escapeHtml } from './escape-html.js';
import { layoutTemplate } from './layout.template.js';
import type { RenderedEmail } from './otp.template.js';

/** Piasters -> "185.50" */
export const formatEgp = (piasters: number): string =>
  (piasters / 100).toFixed(2).replace(/\.00$/, '');

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

const HEAD: Record<Kind, { ar: (n: string) => string; en: (n: string) => string }> = {
  created: { ar: (n) => `استلمنا طلبك رقم ${n}، شكراً لك!`, en: (n) => `We received your order ${n}. Thank you!` },
  status: { ar: (n) => `تحديث على طلبك رقم ${n}`, en: (n) => `Update on your order ${n}` },
  paid: { ar: (n) => `تم استلام الدفع لطلبك رقم ${n}`, en: (n) => `Payment received for order ${n}` },
};

/** One bilingual email (Arabic first, then English) for order events. */
export function orderEmail(kind: Kind, brandName: string, d: OrderEmailData): RenderedEmail {
  const status = STATUS_LABELS[d.status];
  const rows = d.items
    .map(
      (i) =>
        `<tr><td style="padding:4px 0">${escapeHtml(i.productName)}${i.variantName ? ` (${escapeHtml(i.variantName)})` : ''} × ${i.quantity}</td>` +
        `<td dir="ltr" style="padding:4px 0;text-align:left;white-space:nowrap">${formatEgp(i.priceAtPurchase * i.quantity)} EGP</td></tr>`,
    )
    .join('');
  const note = d.note ? `<p style="margin:0 0 12px">${escapeHtml(d.note)}</p>` : '';
  const number = escapeHtml(d.orderNumber);

  const body = `
    <div dir="rtl" style="text-align:right">
      <p style="margin:0 0 8px;font-size:16px">أهلاً ${escapeHtml(d.customerName)}،</p>
      <p style="margin:0 0 8px">${escapeHtml(HEAD[kind].ar(d.orderNumber))}</p>
      <p style="margin:0 0 12px">حالة الطلب: <b>${status.ar}</b></p>
    </div>
    ${note}
    <table role="presentation" width="100%" style="border-top:1px solid #e7e5e4;margin:8px 0;font-size:14px">${rows}
      <tr><td style="padding-top:8px;font-weight:bold">الإجمالي / Total</td><td dir="ltr" style="padding-top:8px;text-align:left;font-weight:bold">${formatEgp(d.totalAmount)} EGP</td></tr>
    </table>
    <p style="margin:16px 0;text-align:center"><a href="${escapeHtml(d.trackUrl)}" style="background:#1c1917;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">تتبع الطلب / Track order</a></p>
    <div dir="ltr" style="text-align:left;border-top:1px solid #e7e5e4;padding-top:12px">
      <p style="margin:0 0 8px">Hi ${escapeHtml(d.customerName)},</p>
      <p style="margin:0 0 8px">${escapeHtml(HEAD[kind].en(d.orderNumber))}</p>
      <p style="margin:0">Status: <b>${status.en}</b></p>
    </div>`;

  return {
    subject: `${HEAD[kind].en(number).replace(/\. Thank you!$/, '')} | ${status.ar} - ${brandName}`,
    html: layoutTemplate({ lang: Lang.AR, brandName, preheader: `${d.orderNumber}: ${status.en}`, body }),
    text: `${HEAD[kind].ar(d.orderNumber)} (${status.ar})\n${HEAD[kind].en(d.orderNumber)} (${status.en})\n${d.trackUrl}`,
  };
}
