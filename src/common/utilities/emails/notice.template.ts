import { Lang } from '../../enums/http.enum.js';
import { escapeHtml } from './escape-html.js';
import { layoutTemplate } from './layout.template.js';
import type { RenderedEmail } from './otp.template.js';
import { formatEgp } from './order.template.js';

const block = (ar: string, en: string) => `
  <div dir="rtl" style="text-align:right;margin:0 0 16px;font-size:15px;line-height:1.7">${ar}</div>
  <div dir="ltr" style="text-align:left;border-top:1px solid #e7e5e4;padding-top:12px;font-size:15px;line-height:1.7">${en}</div>`;

/** Bilingual unsubscribe line for newsletter-type emails. */
export function unsubscribeFooter(url: string): string {
  const u = escapeHtml(url);
  return `<p style="margin:24px 0 0;font-size:12px;color:#a8a29e;text-align:center">
    <a href="${u}" style="color:#a8a29e">إلغاء الاشتراك</a> · <a href="${u}" style="color:#a8a29e">Unsubscribe</a></p>`;
}

/** 7.1 Newsletter welcome (bilingual). */
export function newsletterWelcomeEmail(brandName: string, unsubscribeUrl?: string): RenderedEmail {
  const b = escapeHtml(brandName);
  return {
    subject: `Welcome to ${brandName} | أهلاً بيك في ${brandName}`,
    html: layoutTemplate({
      lang: Lang.AR,
      brandName,
      preheader: 'You are subscribed',
      body: block(
        `اشتركت في نشرة ${b}. هتوصلك العروض والمنتجات الجديدة أول بأول.`,
        `You are subscribed to the ${b} newsletter. You will be the first to hear about offers and new products.`,
      ) + (unsubscribeUrl ? unsubscribeFooter(unsubscribeUrl) : ''),
    }),
    text: `اشتركت في نشرة ${brandName}.\nYou are subscribed to the ${brandName} newsletter.`,
  };
}

/** 7.4 New contact message, to the store admin. */
export function contactNotificationEmail(
  brandName: string,
  m: { name: string; email: string; phone?: string | null; subject?: string | null; message: string },
): RenderedEmail {
  const rows = [
    ['Name', m.name],
    ['Email', m.email],
    ['Phone', m.phone ?? '-'],
    ['Subject', m.subject ?? '-'],
  ]
    .map(([k, v]) => `<tr><td style="padding:2px 8px 2px 0;color:#78716c">${k}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('');
  return {
    // Reply goes to the customer (Reply-To is set by EmailService).
    subject: `رسالة جديدة من الموقع · New message from ${m.email}${m.subject ? `: ${m.subject}` : ''}`,
    html: layoutTemplate({
      lang: Lang.EN,
      brandName,
      preheader: m.message.slice(0, 80),
      body: `<table role="presentation" style="font-size:14px;margin:0 0 16px">${rows}</table>
        <p style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin:0">${escapeHtml(m.message)}</p>`,
    }),
    text: `${m.name} <${m.email}>\n${m.subject ?? ''}\n\n${m.message}`,
  };
}

/** 18.1 / 18.3 Gift card code (bilingual). */
export function giftCardEmail(
  brandName: string,
  g: { code: string; amountPiasters: number; expiresAt: Date | null; message?: string | null; fromName?: string | null },
): RenderedEmail {
  const amount = formatEgp(g.amountPiasters);
  const until = g.expiresAt ? g.expiresAt.toISOString().slice(0, 10) : null;
  const from = g.fromName ? escapeHtml(g.fromName) : null;
  const note = g.message
    ? `<p style="margin:0 0 16px;padding:12px;background:#fafaf9;border-radius:8px;white-space:pre-wrap">${escapeHtml(g.message)}</p>`
    : '';
  const body = `
    ${block(
      `${from ? `${from} بعتلك` : 'وصلتك'} بطاقة هدية بقيمة <b>${amount} جنيه</b>${until ? `، صالحة حتى ${until}` : ''}. استخدم الكود ده عند الدفع:`,
      `${from ? `${from} sent you` : 'You received'} a gift card worth <b>EGP ${amount}</b>${until ? `, valid until ${until}` : ''}. Use this code at checkout:`,
    )}
    ${note}
    <p dir="ltr" style="margin:16px 0 0;padding:12px;border:2px dashed #d6d3d1;border-radius:8px;font-size:24px;font-weight:bold;letter-spacing:3px;text-align:center">${escapeHtml(g.code)}</p>`;
  return {
    subject: `Gift card EGP ${amount} | بطاقة هدية ${amount} جنيه - ${brandName}`,
    html: layoutTemplate({ lang: Lang.AR, brandName, preheader: `EGP ${amount} gift card`, body }),
    text: `بطاقة هدية ${amount} جنيه — الكود: ${g.code}\nGift card EGP ${amount} — code: ${g.code}`,
  };
}

/** 20.3 Back in stock (bilingual). */
export function backInStockEmail(brandName: string, p: { productName: string; variantName?: string | null; url: string }): RenderedEmail {
  const name = escapeHtml(p.variantName ? `${p.productName} (${p.variantName})` : p.productName);
  const button = `<p style="margin:20px 0 0;text-align:center"><a href="${escapeHtml(p.url)}" style="background:#1c1917;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">اطلبه دلوقتي / Shop now</a></p>`;
  return {
    subject: `Back in stock: ${p.productName} | رجع تاني - ${brandName}`,
    html: layoutTemplate({
      lang: Lang.AR,
      brandName,
      preheader: `${p.productName} is back`,
      body: block(`المنتج اللي طلبت تنبيه بيه رجع متوفر: <b>${name}</b>. الكمية محدودة.`, `Good news: <b>${name}</b> is back in stock. Quantities are limited.`) + button,
    }),
    text: `${p.productName} رجع متوفر / is back in stock: ${p.url}`,
  };
}

/** 20.1 Abandoned cart reminder (bilingual). */
export function abandonedCartEmail(
  brandName: string,
  c: { firstName: string; items: { name: string; quantity: number }[]; cartUrl: string },
): RenderedEmail {
  const list = c.items
    .slice(0, 5)
    .map((i) => `<li>${escapeHtml(i.name)} × ${i.quantity}</li>`)
    .join('');
  const name = escapeHtml(c.firstName);
  const button = `<p style="margin:20px 0 0;text-align:center"><a href="${escapeHtml(c.cartUrl)}" style="background:#1c1917;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">كمّل طلبك / Complete your order</a></p>`;
  return {
    subject: `You left something in your cart | سلتك مستنياك - ${brandName}`,
    html: layoutTemplate({
      lang: Lang.AR,
      brandName,
      preheader: 'Your cart is waiting',
      body:
        block(`أهلاً ${name}، سبت حاجات في سلتك:`, `Hi ${name}, you left these in your cart:`) +
        `<ul style="margin:12px 0;padding-inline-start:20px">${list}</ul>` +
        button,
    }),
    text: `سلتك مستنياك / Your cart is waiting: ${c.cartUrl}`,
  };
}
