import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderStatus } from '../../common/enums/index.js';
import {
  AppEvents,
  ContactMessageReceivedEvent,
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  PaymentSucceededEvent,
} from '../../common/events/index.js';
import { NotificationService } from '../../common/services/notification/notification.service.js';
import { runInBackground } from '../../common/utilities/background.js';
import { formatEgp, orderHeadline } from '../../common/utilities/emails/order.template.js';
import { ContactMessageRepository } from '../../models/repositories/contact-message.repository.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { ProductVariantRepository } from '../../models/repositories/product-variant.repository.js';

type Lang = 'ar' | 'en';
const tr = (lang: Lang, ar: string, en: string) => (lang === 'ar' ? ar : en);
const egp = (lang: Lang, piasters: number) => tr(lang, `${formatEgp(piasters)} ج.م`, `${formatEgp(piasters)} EGP`);

/**
 * Turns store events into push notifications.
 *  Staff: a new order (cash on delivery when placed, online once paid), a contact
 *         message, and a piece running low after a sale.
 *  Customer: every step of their own order.
 * Everything runs after the response, like the order emails.
 */
@Injectable()
export class NotificationsListener {
  constructor(
    private readonly push: NotificationService,
    private readonly orders: OrderRepository,
    private readonly products: ProductRepository,
    private readonly variants: ProductVariantRepository,
    private readonly messages: ContactMessageRepository,
  ) {}

  @OnEvent(AppEvents.ORDER_CREATED)
  onCreated(event: OrderCreatedEvent): void {
    runInBackground('push:order-created', async () => {
      const order = await this.orders.findWithItems(event.orderId);
      if (!order) return;
      const track = (lang: Lang) => `/${lang}/track?orderNumber=${encodeURIComponent(order.orderNumber)}`;
      await this.push.notifyCustomer(order, (lang) => ({
        title: orderHeadline('created', order.status)[lang],
        body: `${order.orderNumber} · ${egp(lang, order.totalAmount)}`,
        url: track(lang),
        tag: `order-${order.id}`,
      }));
      // Online orders wait for the payment before they count (see onPaid).
      if (order.status !== OrderStatus.PENDING_PAYMENT) await this.newOrderForStaff(order.id, false);
      await this.lowStockForStaff(order.items);
    });
  }

  @OnEvent(AppEvents.PAYMENT_SUCCEEDED)
  onPaid(event: PaymentSucceededEvent): void {
    runInBackground('push:order-paid', () => this.newOrderForStaff(event.orderId, true));
  }

  @OnEvent(AppEvents.ORDER_STATUS_CHANGED)
  onStatusChanged(event: OrderStatusChangedEvent): void {
    // Paid online orders get the "payment received" message instead.
    if (event.from === OrderStatus.PENDING_PAYMENT && event.to === OrderStatus.CONFIRMED) return;
    runInBackground('push:order-status', async () => {
      const order = await this.orders.findById(event.orderId);
      if (!order) return;
      await this.push.notifyCustomer(order, (lang) => ({
        title: orderHeadline('status', event.to)[lang],
        body: order.orderNumber,
        url: `/${lang}/track?orderNumber=${encodeURIComponent(order.orderNumber)}`,
        tag: `order-${order.id}`,
      }));
    });
  }

  @OnEvent(AppEvents.CONTACT_MESSAGE_RECEIVED)
  onMessage(event: ContactMessageReceivedEvent): void {
    runInBackground('push:contact', async () => {
      const m = await this.messages.findById(event.messageId);
      if (!m) return;
      await this.push.notifyStaff((lang) => ({
        title: tr(lang, `رسالة جديدة من ${m.name}`, `New message from ${m.name}`),
        body: (m.subject ? `${m.subject}: ` : '') + m.message.slice(0, 120),
        url: `/${lang}/admin/messages`,
        tag: `message-${m.id}`,
      }));
    });
  }

  private async newOrderForStaff(orderId: string, paid: boolean): Promise<void> {
    const order = await this.orders.findWithItems(orderId);
    if (!order) return;
    const pieces = order.items.reduce((s, i) => s + i.quantity, 0);
    await this.push.notifyStaff((lang) => ({
      title: paid
        ? tr(lang, `طلب جديد مدفوع · ${egp(lang, order.totalAmount)}`, `New paid order · ${egp(lang, order.totalAmount)}`)
        : tr(lang, `طلب جديد · ${egp(lang, order.totalAmount)}`, `New order · ${egp(lang, order.totalAmount)}`),
      body: `${order.customerName} · ${tr(lang, `${pieces} قطعة`, `${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`)} · ${order.orderNumber}`,
      url: `/${lang}/admin/orders/${order.id}`,
      tag: `order-${order.id}`,
    }));
  }

  /** After a sale, any piece (or version) at or under its low-stock line. */
  private async lowStockForStaff(items: { productId: string; variantId: string | null }[]): Promise<void> {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const variantIds = items.map((i) => i.variantId).filter((v): v is string => !!v);
    const [products, variants] = await Promise.all([
      this.products.find({ id: { in: productIds } }),
      variantIds.length ? this.variants.find({ id: { in: variantIds } }) : Promise.resolve([]),
    ]);
    const low: { productId: string; name: string; stock: number }[] = [];
    for (const p of products) {
      const own = variants.filter((v) => v.productId === p.id);
      if (own.length) {
        for (const v of own) if (v.stock <= p.lowStockThreshold) low.push({ productId: p.id, name: `${p.name} (${v.name})`, stock: v.stock });
      } else if (p.stock <= p.lowStockThreshold) {
        low.push({ productId: p.id, name: p.name, stock: p.stock });
      }
    }
    for (const item of low) {
      await this.push.notifyStaff((lang) => ({
        title: item.stock <= 0 ? tr(lang, `خلصت: ${item.name}`, `Sold out: ${item.name}`) : tr(lang, `قرّبت تخلص: ${item.name}`, `Running low: ${item.name}`),
        body: tr(lang, `الباقي ${item.stock}`, `${item.stock} left`),
        url: `/${lang}/admin/products/${item.productId}`,
        tag: `stock-${item.productId}`,
      }));
    }
  }
}
