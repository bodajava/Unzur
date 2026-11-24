import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderStatus } from '../../common/enums/index.js';
import {
  AppEvents,
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  PaymentSucceededEvent,
} from '../../common/events/index.js';
import { runInBackground } from '../../common/utilities/background.js';
import { EmailService } from '../../common/utilities/email/email.service.js';
import type { StoreOrderEmailData } from '../../common/utilities/emails/order.template.js';
import { OrderRepository } from '../../models/repositories/order.repository.js';
import { WhatsAppService } from '../whatsapp/whatsapp.service.js';

/** Order emails (bilingual), always after the response. */
@Injectable()
export class OrdersListener {
  private readonly frontendUrl: string;
  /** The store's orders inbox: every new order (and online payment) is copied here in full. */
  private readonly ordersEmail: string | undefined;

  constructor(
    private readonly email: EmailService,
    private readonly orders: OrderRepository,
    private readonly whatsapp: WhatsAppService,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/+$/, '');
    this.ordersEmail = config.get<string>('ORDERS_EMAIL')?.trim() || undefined;
  }

  @OnEvent(AppEvents.ORDER_CREATED)
  onCreated(event: OrderCreatedEvent): void {
    this.send(event.orderId, 'created');
    this.notifyStore(event.orderId, 'created');
  }

  @OnEvent(AppEvents.ORDER_STATUS_CHANGED)
  onStatusChanged(event: OrderStatusChangedEvent): void {
    // 20.4 WhatsApp update for every status change (no-op when not configured).
    runInBackground('order-whatsapp', async () => {
      const order = await this.orders.findById(event.orderId);
      if (order) await this.whatsapp.sendOrderStatusUpdate(order.customerPhone, order.orderNumber, event.to);
    });
    // Online payments get the "payment received" email instead.
    if (event.from === OrderStatus.PENDING_PAYMENT && event.to === OrderStatus.CONFIRMED) return;
    this.send(event.orderId, 'status');
  }

  @OnEvent(AppEvents.PAYMENT_SUCCEEDED)
  onPaid(event: PaymentSucceededEvent): void {
    this.send(event.orderId, 'paid');
    this.notifyStore(event.orderId, 'paid');
  }

  /** Sends the full order (photos, address, money, customer) to the orders inbox. */
  private notifyStore(orderId: string, kind: 'created' | 'paid'): void {
    const to = this.ordersEmail;
    if (!to) return;
    runInBackground(`order-store-email:${kind}`, async () => {
      const order = await this.orders.findWithItems(orderId);
      if (!order) return;
      await this.email.sendStoreOrderEmail(
        to,
        {
          ...order,
          shippingAddress: (order.shippingAddress ?? {}) as StoreOrderEmailData['shippingAddress'],
          adminUrl: `${this.frontendUrl}/en/admin/orders/${order.id}`,
        },
        kind,
      );
    });
  }

  private send(orderId: string, kind: 'created' | 'status' | 'paid'): void {
    runInBackground(`order-email:${kind}`, async () => {
      const order = await this.orders.findWithItems(orderId);
      if (!order) return;
      await this.email.sendOrderEmail(order.customerEmail, kind, {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        status: order.status,
        totalAmount: order.totalAmount,
        items: order.items,
        // The storefront's tracking page (/en/track); it asks for the email or phone to show the order.
        trackUrl: `${this.frontendUrl}/en/track?orderNumber=${encodeURIComponent(order.orderNumber)}`,
        note: order.cancelOrRefundReason,
      });
    });
  }
}
