import { Lang } from '../../enums/http.enum.js';
import { escapeHtml } from './escape-html.js';

export interface LayoutOptions {
  lang: Lang;
  brandName: string;
  preheader?: string;
  /** Already-escaped inner HTML */
  body: string;
}

/** Branded email shell. Arabic renders right-to-left. */
export function layoutTemplate({ lang, brandName, preheader, body }: LayoutOptions): string {
  const dir = lang === Lang.AR ? 'rtl' : 'ltr';
  const align = lang === Lang.AR ? 'right' : 'left';
  const footer =
    lang === Lang.AR
      ? `وصلتك هذه الرسالة لأن لديك حساباً في ${escapeHtml(brandName)}.`
      : `You received this email because you have an account with ${escapeHtml(brandName)}.`;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:24px 12px;background:#f5f5f4;font-family:Tahoma,Arial,Helvetica,sans-serif;color:#1c1917">
    <span style="display:none!important;opacity:0;height:0;overflow:hidden">${escapeHtml(preheader ?? '')}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto">
      <tr><td style="padding:0 0 16px;text-align:center;font-size:20px;font-weight:bold;letter-spacing:.5px">${escapeHtml(brandName)}</td></tr>
      <tr><td dir="${dir}" style="background:#ffffff;border-radius:12px;padding:32px;text-align:${align}">${body}</td></tr>
      <tr><td dir="${dir}" style="padding:16px 8px;text-align:center;font-size:12px;color:#a8a29e">${footer}</td></tr>
    </table>
  </body>
</html>`;
}
