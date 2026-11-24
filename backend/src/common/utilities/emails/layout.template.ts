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

/**
 * Public storefront address for the logo and footer links. Email clients load
 * images from the internet, so a localhost FRONTEND_URL falls back to the live site.
 */
const envSite = (process.env.FRONTEND_URL ?? '').replace(/\/+$/, '');
export const SITE_URL = envSite.startsWith('https://') ? envSite : 'https://unzur.net';
const LOGO_URL = `${SITE_URL}/icon-192.png`;
const INSTAGRAM_URL = 'https://instagram.com/unzur.eg';
const WHATSAPP_URL = 'https://wa.me/201092106797';

const SANS = "'Helvetica Neue',Helvetica,Arial,'Segoe UI',Tahoma,sans-serif";
/** The storefront's Arabic face; email apps without it fall back to a classic serif. */
export const ARABIC_SERIF = "Amiri,'Times New Roman',Georgia,serif";

/** Blue pill button, the same shape as the storefront's buttons. */
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto"><tr>
    <td style="border-radius:999px;background:${BRAND.blue}"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 28px;border-radius:999px;color:#ffffff;font-family:${SANS};font-size:14px;font-weight:700;letter-spacing:.3px;text-decoration:none">${label}</a></td>
  </tr></table>`;
}

/** A code the reader types somewhere (coupon, gift card, OTP). */
export function emailCode(code: string, size = 28): string {
  return `<p dir="ltr" style="margin:0 0 24px;padding:16px 12px;border:2px dashed ${BRAND.blue};border-radius:14px;background:${BRAND.haze};color:${BRAND.blue};font-family:'Courier New',Courier,monospace;font-size:${size}px;font-weight:700;letter-spacing:${Math.round(size / 6)}px;text-align:center">${escapeHtml(code)}</p>`;
}

/** Branded email shell: blue band with the eye, white card, Arabic footer like the site. */
export function layoutTemplate({ lang, brandName, preheader, body }: LayoutOptions): string {
  const dir = lang === Lang.AR ? 'rtl' : 'ltr';
  const align = lang === Lang.AR ? 'right' : 'left';
  const brand = escapeHtml(brandName.toUpperCase());
  const link = (href: string, label: string) =>
    `<a href="${href}" style="color:${BRAND.blue};text-decoration:none;font-weight:700">${label}</a>`;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
    <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
    <title>${brand}</title>
    <style>@media print{body,table{background:#ffffff!important}a[href]{text-decoration:none!important}}</style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.haze};font-family:${SANS};color:${BRAND.text};-webkit-font-smoothing:antialiased">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader ?? '')}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.haze}">
      <tr><td style="padding:28px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto">
          <tr><td dir="ltr" style="background:${BRAND.blue};border-radius:22px 22px 0 0;padding:28px 24px 24px;text-align:center">
            <a href="${SITE_URL}" style="text-decoration:none">
              <img src="${LOGO_URL}" width="64" height="64" alt="" style="display:block;margin:0 auto 10px;border:0;border-radius:16px">
              <span style="display:block;color:${BRAND.haze};font-size:30px;font-weight:900;letter-spacing:6px;line-height:1">${brand}</span>
            </a>
            <span lang="ar" dir="rtl" style="display:block;margin-top:10px;color:${BRAND.haze};opacity:.85;font-family:${ARABIC_SERIF};font-size:16px">انظر أو كُفّ عن النظر</span>
          </td></tr>
          <tr><td dir="${dir}" style="background:#ffffff;border-radius:0 0 22px 22px;padding:34px 30px;text-align:${align};font-size:15px;line-height:1.65">${body}</td></tr>
          <tr><td dir="rtl" lang="ar" style="padding:22px 12px 8px;text-align:center;font-family:${ARABIC_SERIF};font-size:15px;color:${BRAND.text}">
            ${link(SITE_URL, 'المتجر')} &nbsp;·&nbsp; ${link(INSTAGRAM_URL, 'إنستجرام')} &nbsp;·&nbsp; ${link(WHATSAPP_URL, 'واتساب')}
          </td></tr>
          <tr><td dir="rtl" lang="ar" style="padding:4px 12px 0;text-align:center;font-family:${ARABIC_SERIF};font-size:13px;color:${BRAND.muted}">
            قطعٌ متجرّدةٌ في الفنّ، حرّةٌ في التعبير.<br>وصلتك الرسالة دي بسبب طلب أو حساب عند ${escapeHtml(brandName)}.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
