import { createHmac } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '../../common/enums/index.js';
import { callbackHmacMessage, transactionHmacMessage, verifyPaymobHmac } from './paymob/paymob-hmac.js';
import { PaymentsService } from './payments.service.js';

const SECRET = 'test-hmac-secret';

const tx = {
  id: 192036465,
  amount_cents: 18_500,
  created_at: '2026-11-17T12:00:00.000000',
  currency: 'EGP',
  error_occured: false,
  has_parent_transaction: false,
  integration_id: 4_000_001,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: true,
  is_voided: false,
  order: { id: 222, merchant_order_id: 'pay-ref' },
  owner: 77,
  pending: false,
  source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
  success: true,
};

describe('Paymob HMAC-SHA512', () => {
  it('concatenates the 20 fields in Paymob order', () => {
    expect(transactionHmacMessage(tx)).toBe(
      '185002026-11-17T12:00:00.000000EGPfalsefalse1920364654000001truefalsefalsefalsetruefalse22277false2346MasterCardcardtrue',
    );
    expect(transactionHmacMessage({ ...tx, source_data: null })).toContain('22277falsetrue');
  });

  it('verifies only the exact signature (constant-time)', () => {
    const good = createHmac('sha512', SECRET).update(transactionHmacMessage(tx)).digest('hex');
    expect(verifyPaymobHmac(transactionHmacMessage(tx), good, SECRET)).toBe(true);
    expect(verifyPaymobHmac(transactionHmacMessage(tx), good.toUpperCase(), SECRET)).toBe(true);
    expect(verifyPaymobHmac(transactionHmacMessage({ ...tx, amount_cents: 1 }), good, SECRET)).toBe(false);
    expect(verifyPaymobHmac(transactionHmacMessage(tx), 'abc', SECRET)).toBe(false);
    expect(verifyPaymobHmac(transactionHmacMessage(tx), good, '')).toBe(false);
  });

  it('reads the redirect query with "order" instead of "order.id"', () => {
    const query = Object.fromEntries(
      Object.entries({
        ...tx,
        order: '222',
        'source_data.pan': '2346',
        'source_data.sub_type': 'MasterCard',
        'source_data.type': 'card',
      }).map(([k, v]) => [k, typeof v === 'object' ? '' : String(v)]),
    );
    expect(callbackHmacMessage(query)).toBe(transactionHmacMessage(tx));
  });
});

function service(found: { status: PaymentStatus } | null) {
  const payments = { findByTransactionId: vi.fn().mockResolvedValue(found), findById: vi.fn().mockResolvedValue({ id: 'p1', orderId: 'o1', status: PaymentStatus.PENDING }), findByPaymobOrderId: vi.fn() };
  const orders = { findById: vi.fn().mockResolvedValue({ id: 'o1', orderNumber: 'ORD-1', totalAmount: 99, status: OrderStatus.PENDING_PAYMENT }) };
  const config = { get: (k: string) => (k === 'PAYMOB_HMAC_SECRET' ? SECRET : '') };
  const svc = new PaymentsService(orders as never, payments as never, {} as never, {} as never, {} as never, {} as never, {} as never, { emit: vi.fn() } as never, config as never);
  return { svc, payments };
}
const sign = (obj: unknown) => createHmac('sha512', SECRET).update(transactionHmacMessage(obj)).digest('hex');

describe('PaymentsService.handleWebhook', () => {
  it('401s without a valid HMAC', async () => {
    const { svc } = service(null);
    await expect(svc.handleWebhook(undefined, { type: 'TRANSACTION', obj: tx })).rejects.toThrow(UnauthorizedException);
    await expect(svc.handleWebhook('0'.repeat(128), { type: 'TRANSACTION', obj: tx })).rejects.toThrow(UnauthorizedException);
  });

  it('acknowledges a replayed transaction without touching anything', async () => {
    const { svc, payments } = service({ status: PaymentStatus.PAID });
    await expect(svc.handleWebhook(sign(tx), { type: 'TRANSACTION', obj: tx })).resolves.toEqual({ received: true, duplicate: true });
    expect(payments.findById).not.toHaveBeenCalled();
  });

  it('rejects an amount that does not match the order total', async () => {
    const { svc } = service(null);
    const obj = { ...tx, special_reference: '3f1c7a52-8f0e-4c62-9d55-4a3a0f0e2b11' };
    await expect(svc.handleWebhook(sign(obj), { type: 'TRANSACTION', obj })).rejects.toThrow(BadRequestException);
  });
});
