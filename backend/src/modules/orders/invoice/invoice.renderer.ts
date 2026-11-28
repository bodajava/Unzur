import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import PDFDocument from 'pdfkit';
import { formatEgp, STATUS_LABELS } from '../../../common/utilities/emails/order.template.js';
import type { OrderWithItems, ShippingAddress } from '../../../models/schemas/order.schema.js';
import { drawLine } from './bidi-text.js';

// DejaVu Sans covers Latin and Arabic (the built-in PDF fonts have no Arabic).
const fontDir = join(dirname(createRequire(import.meta.url).resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const FONT = join(fontDir, 'DejaVuSans.ttf');
const FONT_BOLD = join(fontDir, 'DejaVuSans-Bold.ttf');

const PAYMENT_LABELS: Record<string, string> = {
  COD: 'Cash on delivery / الدفع عند الاستلام',
  PAYMOB_CARD: 'Card / بطاقة',
  PAYMOB_WALLET: 'Mobile wallet / محفظة',
};

export interface StoreInfo {
  name: string;
  phone?: string;
  website?: string;
}

const egp = (piasters: number) => `${formatEgp(piasters)} EGP`;

/** Product photos keyed by image URL (JPEG/PNG only: what PDF can embed). */
export type InvoiceImages = Map<string, Buffer>;

const isJpeg = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8;
const isPng = (b: Buffer) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/**
 * Downloads the order's product photos for a printed sheet. Each one is
 * optional: slow, missing or WebP images are skipped and the row prints without a photo.
 */
export async function loadInvoiceImages(urls: (string | null | undefined)[], timeoutMs = 5000): Promise<InvoiceImages> {
  const images: InvoiceImages = new Map();
  const unique = [...new Set(urls.filter((u): u is string => !!u && /^https?:\/\//.test(u)))].slice(0, 30);
  await Promise.all(
    unique.map(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 5_000_000 && (isJpeg(buf) || isPng(buf))) images.set(url, buf);
      } catch {
        /* print without this photo */
      }
    }),
  );
  return images;
}

/** A4 invoice as a PDF buffer. All amounts are piasters, printed in EGP. */
export function renderInvoice(order: OrderWithItems, store: StoreInfo, images: InvoiceImages = new Map()): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Invoice ${order.orderNumber}` } });
  doc.registerFont('regular', FONT);
  doc.registerFont('bold', FONT_BOLD);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = 40;
  const width = doc.page.width - 80;
  const line = (text: string, y: number, o: Partial<Parameters<typeof drawLine>[5]> & { x?: number; w?: number } = {}) =>
    drawLine(doc, text, o.x ?? left, y, o.w ?? width, { size: o.size ?? 10, font: o.font ?? 'regular', align: o.align, color: o.color });

  // Header
  line(store.name, 40, { size: 20, font: 'bold', color: '#1b44ff' });
  line('INVOICE / فاتورة', 46, { size: 14, font: 'bold', align: 'right' });
  const contactLine = [store.phone, store.website].filter(Boolean).join('  ·  ');
  if (contactLine) line(contactLine, 68, { size: 9, color: '#57534e' });
  doc.moveTo(left, 88).lineTo(left + width, 88).strokeColor('#e7e5e4').stroke();

  // Order + customer
  const status = STATUS_LABELS[order.status];
  const meta: [string, string][] = [
    ['Order / رقم الطلب', order.orderNumber],
    ['Date / التاريخ', order.createdAt.toISOString().slice(0, 10)],
    ['Status / الحالة', `${status.en} / ${status.ar}`],
    ['Payment / الدفع', PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod],
    ['Paid / حالة الدفع', order.paymentStatus],
  ];
  meta.forEach(([label, value], i) => {
    line(label, 100 + i * 15, { w: 95, font: 'bold', size: 9 });
    line(value, 100 + i * 15, { x: left + 100, w: width / 2 - 110, size: 9 });
  });

  const address = order.shippingAddress as unknown as ShippingAddress;
  const addressParts = [
    address.street,
    address.building && `Bldg ${address.building}`,
    address.floor && `Floor ${address.floor}`,
    address.apartment && `Apt ${address.apartment}`,
  ].filter(Boolean);
  const shipTo = [
    'Ship to / الشحن إلى',
    order.customerName,
    order.customerPhone,
    order.customerEmail,
    addressParts.join(', '),
    `${address.city}, ${address.governorate}`,
  ];
  const half = left + width / 2 + 10;
  shipTo.forEach((text, i) =>
    line(text, 100 + i * 15, { x: half, w: width / 2 - 10, font: i === 0 ? 'bold' : 'regular' }),
  );

  // Items table
  let y = 200;
  const cols = { item: left, qty: left + width * 0.55, unit: left + width * 0.67, total: left + width * 0.83 };
  const colW = { item: width * 0.53, qty: width * 0.1, unit: width * 0.15, total: width * 0.17 };
  doc.rect(left, y - 4, width, 20).fill('#f5f5f4');
  line('Item / الصنف', y, { x: cols.item + 4, w: colW.item, font: 'bold' });
  line('Qty', y, { x: cols.qty, w: colW.qty, font: 'bold', align: 'center' });
  line('Unit', y, { x: cols.unit, w: colW.unit, font: 'bold', align: 'right' });
  line('Total', y, { x: cols.total, w: colW.total - 4, font: 'bold', align: 'right' });
  y += 24;
  const withPhotos = order.items.some((item) => item.imageUrl && images.has(item.imageUrl));
  const rowH = withPhotos ? 52 : 18;
  const photo = 44;
  for (const item of order.items) {
    if (y + rowH > doc.page.height - 180) {
      doc.addPage();
      y = 40;
    }
    const name = [item.productName, item.variantName, item.choice].filter(Boolean).join(' - ');
    const img = item.imageUrl ? images.get(item.imageUrl) : undefined;
    const textY = withPhotos ? y + photo / 2 - 6 : y;
    let nameX = cols.item + 4;
    if (withPhotos) {
      if (img) {
        try {
          doc.save().roundedRect(nameX, y - 2, photo, photo, 6).clip();
          doc.image(img, nameX, y - 2, { cover: [photo, photo], align: 'center', valign: 'center' });
          doc.restore();
        } catch {
          doc.restore();
        }
      } else {
        doc.roundedRect(nameX, y - 2, photo, photo, 6).fill('#e8e8e5');
      }
      nameX += photo + 10;
    }
    line(name, textY, { x: nameX, w: colW.item - (nameX - cols.item) });
    line(String(item.quantity), textY, { x: cols.qty, w: colW.qty, align: 'center' });
    line(egp(item.priceAtPurchase), textY, { x: cols.unit, w: colW.unit, align: 'right' });
    line(egp(item.priceAtPurchase * item.quantity), textY, { x: cols.total, w: colW.total - 4, align: 'right' });
    y += rowH;
    doc.moveTo(left, y - 4).lineTo(left + width, y - 4).strokeColor('#e7e5e4').stroke();
  }

  // Totals
  y += 10;
  const totals: [string, string][] = [['Subtotal / المجموع', egp(order.subtotal)]];
  if (order.discountAmount) totals.push([`Discount${order.couponCode ? ` (${order.couponCode})` : ''} / خصم`, `- ${egp(order.discountAmount)}`]);
  if (order.loyaltyDiscount) totals.push(['Loyalty points / نقاط', `- ${egp(order.loyaltyDiscount)}`]);
  totals.push(['Shipping / الشحن', order.shippingCost ? egp(order.shippingCost) : 'Free / مجاني']);
  if (order.giftCardAmount) totals.push(['Gift card / بطاقة هدية', `- ${egp(order.giftCardAmount)}`]);
  const labelX = left + width * 0.45;
  for (const [label, value] of totals) {
    line(label, y, { x: labelX, w: width * 0.3 });
    line(value, y, { x: left + width * 0.75, w: width * 0.25 - 4, align: 'right' });
    y += 16;
  }
  doc.moveTo(labelX, y).lineTo(left + width, y).strokeColor('#1c1917').stroke();
  y += 8;
  line('Total / الإجمالي', y, { x: labelX, w: width * 0.3, size: 12, font: 'bold' });
  line(egp(order.totalAmount), y, { x: left + width * 0.75, w: width * 0.25 - 4, size: 12, font: 'bold', align: 'right' });

  // What the courier collects at the door (cash orders not yet paid).
  if (order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID' && order.totalAmount > 0) {
    y += 30;
    doc.roundedRect(left, y - 10, width, 46, 6).fill('#1b44ff');
    line(`Collect on delivery: ${egp(order.totalAmount)}`, y, { size: 13, font: 'bold', align: 'center', color: '#ffffff' });
    line('المبلغ المطلوب تحصيله من العميل', y + 18, { size: 10, align: 'center', color: '#ffffff' });
  }

  line('Thank you for your order! / شكراً لطلبك!', doc.page.height - 70, { align: 'center', color: '#78716c', size: 9 });
  doc.end();
  return done;
}
