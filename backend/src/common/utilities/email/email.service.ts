import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { Lang } from '../../enums/http.enum.js';
import { OtpType } from '../../enums/prisma.enums.js';
import { couponEmail } from '../emails/coupon.template.js';
import {
  abandonedCartEmail,
  backInStockEmail,
  contactNotificationEmail,
  giftCardEmail,
  newsletterWelcomeEmail,
  unsubscribeFooter,
} from '../emails/notice.template.js';
import { orderEmail, storeOrderEmail, type OrderEmailData, type StoreOrderEmailData } from '../emails/order.template.js';
import { otpEmail, type RenderedEmail } from '../emails/otp.template.js';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** e.g. List-Unsubscribe for newsletters */
  headers?: Record<string, string>;
  /** Where "Reply" goes (the customer, for contact-form notifications). */
  replyTo?: string;
  /** Files sent with the email (e.g. the order's printable PDF). */
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

/** RFC 8058 one-click unsubscribe headers. */
export const unsubscribeHeaders = (url: string): Record<string, string> => ({
  'List-Unsubscribe': `<${url}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
});

/**
 * Nodemailer transport. Without SMTP_HOST:
 *  - development/test: the email is logged (incl. OTP) so flows stay testable
 *  - production: an error is logged, codes are never logged
 * Callers should invoke this from events/runInBackground, not inline in requests.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly isProduction: boolean;
  readonly brandName: string;

  constructor(config: ConfigService) {
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
    this.brandName = config.get<string>('APP_NAME') || 'Store';
    this.from = config.get<string>('SMTP_FROM') || `${this.brandName} <no-reply@localhost>`;

    const host = config.get<string>('SMTP_HOST');
    if (!host) {
      this.transporter = null;
      this.logger.warn('SMTP_HOST is not set: emails will be logged instead of sent.');
      return;
    }
    const port = Number(config.get<string>('SMTP_PORT') || 587);
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async send(input: SendEmailInput, devLogExtra?: string): Promise<void> {
    if (!this.transporter) {
      if (this.isProduction) {
        this.logger.error(`SMTP not configured: "${input.subject}" to ${input.to} was NOT sent`);
      } else {
        this.logger.log(`[DEV EMAIL] to=${input.to} subject="${input.subject}"${devLogExtra ?? ''}`);
      }
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...input });
  }

  async sendVerificationOtp(email: string, firstName: string, otp: string, lang = Lang.EN) {
    await this.sendOtp(OtpType.EMAIL_VERIFICATION, email, firstName, otp, lang);
  }

  async sendPasswordResetOtp(email: string, firstName: string, otp: string, lang = Lang.EN) {
    await this.sendOtp(OtpType.PASSWORD_RESET, email, firstName, otp, lang);
  }

  async sendGenericEmail(to: string, subject: string, html: string): Promise<void> {
    await this.send({ to, subject, html });
  }

  async sendNewsletterWelcome(to: string, unsubscribeUrl?: string): Promise<void> {
    await this.send({
      to,
      ...newsletterWelcomeEmail(this.brandName, unsubscribeUrl),
      ...(unsubscribeUrl ? { headers: unsubscribeHeaders(unsubscribeUrl) } : {}),
    });
  }

  async sendBackInStock(to: string, data: Parameters<typeof backInStockEmail>[1]): Promise<void> {
    await this.send({ to, ...backInStockEmail(this.brandName, data) });
  }

  async sendAbandonedCart(to: string, data: Parameters<typeof abandonedCartEmail>[1]): Promise<void> {
    await this.send({ to, ...abandonedCartEmail(this.brandName, data) });
  }

  async sendContactNotification(to: string, message: Parameters<typeof contactNotificationEmail>[1]): Promise<void> {
    await this.send({ to, replyTo: message.email, ...contactNotificationEmail(this.brandName, message) });
  }

  async sendGiftCardEmail(to: string, card: Parameters<typeof giftCardEmail>[1]): Promise<void> {
    await this.send({ to, ...giftCardEmail(this.brandName, card) }, ` giftcard=${card.code}`);
  }

  /** Bilingual order email: placed, status update or payment receipt. */
  async sendOrderEmail(to: string, kind: 'created' | 'status' | 'paid', data: OrderEmailData): Promise<void> {
    await this.send({ to, ...orderEmail(kind, this.brandName, data) }, ` order=${data.orderNumber} kind=${kind}`);
  }

  /** Full order details for the store's orders inbox (ORDERS_EMAIL). */
  async sendStoreOrderEmail(
    to: string,
    data: StoreOrderEmailData,
    kind: 'created' | 'paid' = 'created',
    pdf?: Buffer,
  ): Promise<void> {
    await this.send(
      {
        to,
        replyTo: data.customerEmail,
        ...storeOrderEmail(this.brandName, data, kind),
        ...(pdf ? { attachments: [{ filename: `${data.orderNumber}.pdf`, content: pdf, contentType: 'application/pdf' }] } : {}),
      },
      ` order=${data.orderNumber} store-copy`,
    );
  }

  /** Bilingual promotional coupon email (6.4). */
  async sendCouponEmail(
    to: string,
    opts: Omit<Parameters<typeof couponEmail>[0], 'brandName'>,
  ): Promise<void> {
    const mail = couponEmail({ ...opts, brandName: this.brandName });
    await this.send(
      {
        to,
        ...mail,
        ...(opts.unsubscribeUrl
          ? { html: mail.html.replace('</body>', `${unsubscribeFooter(opts.unsubscribeUrl)}</body>`), headers: unsubscribeHeaders(opts.unsubscribeUrl) }
          : {}),
      },
      ` coupon=${opts.code}`,
    );
  }

  private async sendOtp(
    type: OtpType,
    to: string,
    firstName: string,
    code: string,
    lang: Lang,
  ): Promise<void> {
    const mail: RenderedEmail = otpEmail({ type, lang, brandName: this.brandName, firstName, code });
    await this.send({ to, ...mail }, ` otp=${code}`);
  }
}
