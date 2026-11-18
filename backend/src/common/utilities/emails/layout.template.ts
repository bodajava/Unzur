import { Lang } from '../../enums/http.enum.js';
import { escapeHtml } from './escape-html.js';

export interface LayoutOptions {
  lang: Lang;
  brandName: string;
  preheader?: string;
  /** Already-escaped inner HTML */
  body: string;
}

/** UNZUR colours, mirrored from the storefront (globals.css). */
export const BRAND = { blue: '#1b44ff', haze: '#e8e8e5', text: '#1c2340', muted: '#6b7080', line: '#d9dbe3' } as const;

/** Branded email shell. Arabic renders right-to-left. */
export function layoutTemplate({ lang, brandName, preheader, body }: LayoutOptions): string {
  const dir = lang === Lang.AR ? 'rtl' : 'ltr';
  const align = lang === Lang.AR ? 'right' : 'left';
  const footer =
    lang === Lang.AR
      ? `وصلتك الرسالة دي بسبب طلب أو حساب عند ${escapeHtml(brandName)}.`
      : `You're getting this because of an order or account with ${escapeHtml(brandName)}.`;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
  <body style="margin:0;padding:24px 12px;background:${BRAND.haze};font-family:'Segoe UI',Tahoma,Arial,Helvetica,sans-serif;color:${BRAND.text}">
    <span style="display:none!important;opacity:0;height:0;overflow:hidden">${escapeHtml(preheader ?? '')}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
      <tr><td style="padding:8px 0 20px;text-align:center;font-size:28px;font-weight:900;letter-spacing:-.5px;color:${BRAND.blue}">${escapeHtml(brandName.toUpperCase())}</td></tr>
      <tr><td dir="${dir}" style="background:#ffffff;border-radius:16px;padding:32px;text-align:${align};line-height:1.6">${body}</td></tr>
      <tr><td dir="${dir}" style="padding:16px 8px;text-align:center;font-size:12px;color:${BRAND.muted}">${footer}</td></tr>
    </table>
  </body>
</html>`;
}
