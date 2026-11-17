import { Lang } from '../../enums/http.enum.js';
import { escapeHtml } from './escape-html.js';
import { layoutTemplate } from './layout.template.js';
import type { RenderedEmail } from './otp.template.js';

/**
 * One bilingual email (Arabic first, then English): we do not know each
 * recipient's language for bulk sends.
 */
export function couponEmail(opts: {
  brandName: string;
  firstName?: string;
  code: string;
  discount: { ar: string; en: string };
  expiresAt: Date;
  note?: string;
  /** Newsletter sends: adds an unsubscribe link + headers */
  unsubscribeUrl?: string;
}): RenderedEmail {
  const date = opts.expiresAt.toISOString().slice(0, 10);
  const name = opts.firstName ? escapeHtml(opts.firstName) : '';
  const code = escapeHtml(opts.code);
  const note = opts.note ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">${escapeHtml(opts.note)}</p>` : '';

  const body = `
    <div dir="rtl" style="text-align:right">
      <p style="margin:0 0 12px;font-size:16px">${name ? `أهلاً ${name}،` : 'أهلاً،'}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6">عندك خصم ${escapeHtml(opts.discount.ar)} على طلبك الجاي. استخدم الكود ده قبل ${date}:</p>
    </div>
    ${note}
    <p dir="ltr" style="margin:0 0 24px;padding:12px;border:2px dashed #d6d3d1;border-radius:8px;font-size:28px;font-weight:bold;letter-spacing:4px;text-align:center">${code}</p>
    <div dir="ltr" style="text-align:left;border-top:1px solid #e7e5e4;padding-top:16px">
      <p style="margin:0 0 12px;font-size:16px">${name ? `Hi ${name},` : 'Hi,'}</p>
      <p style="margin:0;font-size:15px;line-height:1.6">Enjoy ${escapeHtml(opts.discount.en)} off your next order. Use the code above before ${date}.</p>
    </div>`;

  const subject = `${opts.discount.en} off | خصم ${opts.discount.ar} - ${opts.brandName}`;
  return {
    subject,
    html: layoutTemplate({ lang: Lang.AR, brandName: opts.brandName, preheader: `Code ${opts.code}`, body }),
    text: `خصم ${opts.discount.ar} بالكود ${opts.code} حتى ${date}\n${opts.discount.en} off with code ${opts.code} until ${date}`,
  };
}
