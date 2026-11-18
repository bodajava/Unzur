import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '../../../common/enums/index.js';

const PAYMOB_BASE_URL = 'https://accept.paymob.com';
const TIMEOUT_MS = 15_000;

export interface PaymobBillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  apartment: string;
  floor: string;
  street: string;
  building: string;
  city: string;
  state: string;
  country: string;
}

export interface CreateIntentionInput {
  amountPiasters: number;
  method: PaymentMethod;
  reference: string;
  description: string;
  billing: PaymobBillingData;
  notificationUrl: string;
  redirectionUrl: string;
}

export interface PaymobIntention {
  intentionId: string;
  clientSecret: string;
  paymobOrderId: string | null;
  checkoutUrl: string;
}

/**
 * The only class that talks to Paymob over HTTP. Tests replace it with a
 * fake (HMAC verification stays real, see paymob-hmac.ts).
 */
@Injectable()
export class PaymobGatewayClient {
  private readonly logger = new Logger(PaymobGatewayClient.name);
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly integrations: Partial<Record<PaymentMethod, number>>;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('PAYMOB_SECRET_KEY') ?? '';
    this.publicKey = config.get<string>('PAYMOB_PUBLIC_KEY') ?? '';
    const card = Number(config.get<string>('PAYMOB_CARD_INTEGRATION_ID'));
    const wallet = Number(config.get<string>('PAYMOB_WALLET_INTEGRATION_ID'));
    this.integrations = {
      ...(card ? { [PaymentMethod.PAYMOB_CARD]: card } : {}),
      ...(wallet ? { [PaymentMethod.PAYMOB_WALLET]: wallet } : {}),
    };
  }

  isConfigured(method: PaymentMethod): boolean {
    return !!(this.secretKey && this.publicKey && this.integrations[method]);
  }

  /** POST /v1/intention/ (Unified Checkout). */
  async createIntention(input: CreateIntentionInput): Promise<PaymobIntention> {
    const integrationId = this.integrations[input.method];
    if (!this.secretKey || !this.publicKey || !integrationId) {
      throw new ServiceUnavailableException('Online payment is not available right now');
    }
    const body = {
      amount: input.amountPiasters,
      currency: 'EGP',
      payment_methods: [integrationId],
      // One line for the whole order: Paymob requires items to sum to `amount`,
      // and the total already includes shipping and discounts.
      items: [{ name: input.description, amount: input.amountPiasters, description: input.description, quantity: 1 }],
      billing_data: input.billing,
      customer: {
        first_name: input.billing.first_name,
        last_name: input.billing.last_name,
        email: input.billing.email,
      },
      special_reference: input.reference,
      notification_url: input.notificationUrl,
      redirection_url: input.redirectionUrl,
    };
    const res = await this.request<{ id: string; client_secret: string; intention_order_id?: number | string }>(
      '/v1/intention/',
      body,
    );
    if (!res.client_secret || !res.id) throw new BadGatewayException('Payment provider returned an invalid response');
    return {
      intentionId: String(res.id),
      clientSecret: res.client_secret,
      paymobOrderId: res.intention_order_id ? String(res.intention_order_id) : null,
      checkoutUrl: `${PAYMOB_BASE_URL}/unifiedcheckout/?publicKey=${encodeURIComponent(this.publicKey)}&clientSecret=${encodeURIComponent(res.client_secret)}`,
    };
  }

  /** POST /api/acceptance/void_refund/refund */
  async refund(transactionId: string, amountPiasters: number): Promise<unknown> {
    if (!this.secretKey) throw new ServiceUnavailableException('Online refunds are not available right now');
    return this.request('/api/acceptance/void_refund/refund', {
      transaction_id: transactionId,
      amount_cents: amountPiasters,
    });
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${PAYMOB_BASE_URL}${path}`, {
        method: 'POST',
        headers: { Authorization: `Token ${this.secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`Paymob ${path} unreachable: ${(error as Error).message}`);
      throw new BadGatewayException('Payment provider is unreachable');
    }
    const text = await res.text();
    if (!res.ok) {
      // Body may describe the problem; never contains our secret.
      this.logger.error(`Paymob ${path} -> ${res.status}: ${text.slice(0, 500)}`);
      throw new BadGatewayException('Payment provider rejected the request');
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new BadGatewayException('Payment provider returned an invalid response');
    }
  }
}
