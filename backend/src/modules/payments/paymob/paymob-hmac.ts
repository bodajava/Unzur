import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Paymob "transaction processed" HMAC: these 20 values, in this order,
 * concatenated with no separator (booleans "true"/"false", missing = "").
 */
export const PAYMOB_HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
] as const;

const asString = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : typeof value === 'object'
      ? ''
      : String(value as string | number | boolean);

function pick(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((cur, key) => (cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[key] : undefined), source);
}

/** Message for the POST webhook body `obj` (nested objects). */
export function transactionHmacMessage(obj: unknown): string {
  return PAYMOB_HMAC_FIELDS.map((field) => asString(pick(obj, field))).join('');
}

/**
 * Message for the GET browser redirect: the same values arrive as flat query
 * params, with "order" instead of "order.id" and dotted names kept literally.
 */
export function callbackHmacMessage(query: Record<string, unknown>): string {
  return PAYMOB_HMAC_FIELDS.map((field) => asString(query[field === 'order.id' ? 'order' : field])).join('');
}

export function signPaymob(message: string, secret: string): string {
  return createHmac('sha512', secret).update(message).digest('hex');
}

/** Constant-time comparison of the hex digests. */
export function verifyPaymobHmac(message: string, received: unknown, secret: string): boolean {
  if (!secret || typeof received !== 'string' || !/^[0-9a-f]{128}$/i.test(received)) return false;
  const expected = Buffer.from(signPaymob(message, secret), 'hex');
  const actual = Buffer.from(received.toLowerCase(), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
