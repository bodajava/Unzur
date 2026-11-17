import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { createHmac, randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { RedisService } from '../src/common/utilities/caching/redis.service.js';
import { EmailService } from '../src/common/utilities/email/email.service.js';
import { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/models/prisma.service.js';
import { PaymobGatewayClient } from '../src/modules/payments/paymob/paymob-gateway.client.js';

const RUN = randomBytes(4).toString('hex');
const API = '/api/v1';
const PASSWORD = 'Str0ngPass!123';
const DAY = 24 * 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Paymob's documented field order, written independently of the app code. */
const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id',
  'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
  'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan', 'source_data.sub_type',
  'source_data.type', 'success',
];
const dig = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((c, k) => (c && typeof c === 'object' ? (c as Record<string, unknown>)[k] : undefined), o);
const asText = (v: unknown) =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
const paymobHmac = (obj: unknown, secret: string) =>
  createHmac('sha512', secret)
    .update(HMAC_FIELDS.map((f) => asText(dig(obj, f))).join(''))
    .digest('hex');

/** Stands in for Paymob's HTTP API. */
class FakePaymob {
  intentions: { reference: string; amountPiasters: number; method: string }[] = [];
  refunds: { transactionId: string; amount: number }[] = [];
  private seq = Math.floor(Math.random() * 1e6) * 100;
  isConfigured() { return true; }
  async createIntention(input: { reference: string; amountPiasters: number; method: string }) {
    this.intentions.push(input);
    const n = ++this.seq;
    return {
      intentionId: `pi_test_${RUN}_${n}`,
      clientSecret: `egy_csk_test_${n}`,
      paymobOrderId: String(n),
      checkoutUrl: `https://accept.paymob.com/unifiedcheckout/?publicKey=pk&clientSecret=egy_csk_test_${n}`,
    };
  }
  async refund(transactionId: string, amount: number) {
    this.refunds.push({ transactionId, amount });
    return { id: 1, success: true };
  }
}

class FakeEmail {
  orders: { to: string; kind: string; orderNumber: string }[] = [];
  brandName = 'Test';
  async send() {}
  async sendVerificationOtp() {}
  async sendPasswordResetOtp() {}
  async sendGenericEmail() {}
  async sendCouponEmail() {}
  async sendOrderEmail(to: string, kind: string, data: { orderNumber: string }) {
    this.orders.push({ to, kind, orderNumber: data.orderNumber });
  }
}

describe('Orders, checkout, Paymob, extras (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let redis: RedisService;
  let hmacSecret: string;
  const paymob = new FakePaymob();
  const mail = new FakeEmail();

  const userIds: string[] = [];
  const guestIds: string[] = [];
  let adminToken: string;
  let staffToken: string;
  let customer: { id: string; email: string; token: string };
  let thresholdBefore: unknown;

  let categoryId: string;
  let productA: string; // stock 10, 10000
  let variantProduct: { id: string; variantId: string }; // variant stock 3, 30000
  let lastOne: string; // stock 1, 5000
  const governorate = `Cairo ${RUN}`;
  const couponCode = `E2E${RUN}TEN`.toUpperCase();
  const giftCode = `GIFT-${RUN}`.toUpperCase();

  // filled as tests run
  let codOrder: { id: string; orderNumber: string; totalAmount: number };
  let cardOrder: { id: string; orderNumber: string; totalAmount: number };
  let cardPayment: { paymentId: string };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const guestEmail = (n: string) => `e2e_${RUN}_${n}@test.local`;
  const checkoutBody = (overrides: Record<string, unknown> = {}) => ({
    customerName: 'Mona Guest',
    customerEmail: guestEmail('guest'),
    customerPhone: '+20 100 555 0101',
    governorate: governorate.toLowerCase(),
    city: 'Nasr City',
    street: '12 Abbas El Akkad',
    building: '5',
    paymentMethod: 'COD',
    ...overrides,
  });
  const clearRateLimits = async () => {
    const keys = await redis.client.keys('rl:*');
    if (keys.length) await redis.client.del(...keys);
  };

  async function newGuestCart(items: { productId: string; variantId?: string; quantity: number }[]) {
    let guestId: string | undefined;
    for (const item of items) {
      const req = http.post(`${API}/cart/items`);
      if (guestId) req.set('x-guest-id', guestId);
      const res = await req.send(item).expect(201);
      guestId = res.body.data.guestId;
    }
    guestIds.push(guestId!);
    return guestId!;
  }

  async function user(role: UserRole, name: string, loyaltyPoints = 0) {
    const email = `e2e_${RUN}_${name}@test.local`;
    const row = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        firstName: name,
        lastName: 'E2E',
        role,
        isEmailVerified: true,
        loyaltyPoints,
        referralCode: `O${RUN}${name}`.toUpperCase().slice(0, 20),
      },
    });
    userIds.push(row.id);
    const path = role === UserRole.CUSTOMER ? 'login' : 'admin/login';
    const res = await http.post(`${API}/auth/${path}`).send({ email, password: PASSWORD }).expect(200);
    return { id: row.id, email, token: res.body.data.accessToken as string };
  }

  function webhookObj(payment: { id: string; paymobOrderId: string | null }, amount: number, overrides: Record<string, unknown> = {}) {
    return {
      id: Number(`9${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`),
      amount_cents: amount,
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
      order: { id: Number(payment.paymobOrderId), merchant_order_id: payment.id },
      owner: 77,
      pending: false,
      source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
      special_reference: payment.id,
      success: true,
      ...overrides,
    };
  }
  const postWebhook = (obj: object, hmac?: string) =>
    http.post(`${API}/payments/paymob/webhook${hmac === undefined ? '' : `?hmac=${hmac}`}`).send({ type: 'TRANSACTION', obj });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue(mail)
      .overrideProvider(PaymobGatewayClient)
      .useValue(paymob)
      .compile();
    app = configureApp(moduleRef.createNestApplication()) as INestApplication<App>;
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    hmacSecret = process.env.PAYMOB_HMAC_SECRET ?? '';
    expect(hmacSecret.length).toBeGreaterThan(10);
    await clearRateLimits();

    // No free shipping during this run (restored afterwards).
    const threshold = await prisma.storeSetting.findUnique({ where: { key: 'free_shipping_threshold' } });
    thresholdBefore = threshold;
    if (threshold) await prisma.storeSetting.delete({ where: { id: threshold.id } });
    await redis.client.del('cache:settings:public');

    adminToken = (await user(UserRole.ADMIN, 'admin')).token;
    staffToken = (await user(UserRole.STAFF, 'staff')).token;
    customer = await user(UserRole.CUSTOMER, 'buyer', 500);

    categoryId = (await prisma.category.create({ data: { name: `Orders ${RUN}`, slug: `orders-${RUN}` } })).id;
    productA = (
      await prisma.product.create({
        data: { name: `قهوة تركي ${RUN}`, slug: `turkish-${RUN}`, description: 'd', basePrice: 10_000, stock: 10, categoryId },
      })
    ).id;
    const v = await prisma.product.create({
      data: {
        name: `Beans ${RUN}`,
        slug: `beans-${RUN}`,
        description: 'd',
        basePrice: 1,
        categoryId,
        variants: { create: { name: '1kg', sku: `OB-${RUN}`, price: 30_000, stock: 3 } },
      },
      include: { variants: true },
    });
    variantProduct = { id: v.id, variantId: v.variants[0].id };
    lastOne = (
      await prisma.product.create({
        data: { name: `Last One ${RUN}`, slug: `last-${RUN}`, description: 'd', basePrice: 5_000, stock: 1, categoryId },
      })
    ).id;
    await prisma.shippingZone.create({ data: { governorate, fee: 5_000, estimatedDays: '2-3' } });
    await prisma.coupon.create({
      data: {
        code: couponCode,
        discountType: 'PERCENTAGE',
        discountValue: 10,
        startsAt: new Date(Date.now() - DAY),
        expiresAt: new Date(Date.now() + DAY),
        perUserLimit: 5,
      },
    });
    await prisma.giftCard.create({ data: { code: giftCode, initialBalance: 10_000, currentBalance: 10_000 } });
    await prisma.giftCard.create({
      data: { code: `${giftCode}-OLD`, initialBalance: 100, currentBalance: 100, expiresAt: new Date(Date.now() - DAY) },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    const orders = await prisma.order.findMany({
      where: { OR: [{ customerEmail: { startsWith: `e2e_${RUN}_` } }, { userId: { in: userIds } }] },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.cart.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { guestId: { in: guestIds } }] } });
    await prisma.coupon.deleteMany({ where: { code: couponCode } });
    await prisma.giftCard.deleteMany({ where: { code: { startsWith: giftCode } } });
    await prisma.shippingZone.deleteMany({ where: { governorate } });
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (thresholdBefore) await prisma.storeSetting.create({ data: thresholdBefore as never });
    await redis.client.del(...guestIds.map((g) => `guest:${g}`), 'cache:settings:public');
    await clearRateLimits();
    await app.close();
  });

  // ───────────────────────── 4.1 / 1.10 COD ─────────────────────────

  it('4.1 guest COD checkout: stock taken, snapshot saved, coupon recorded, cart cleared, email queued', async () => {
    await http.post(`${API}/orders/checkout`).send(checkoutBody()).expect(400); // no cart at all

    const guestId = await newGuestCart([
      { productId: productA, quantity: 2 },
      { productId: variantProduct.id, variantId: variantProduct.variantId, quantity: 1 },
    ]);
    const guest = { 'x-guest-id': guestId };
    await http.post(`${API}/orders/checkout`).set(guest).send(checkoutBody({ governorate: 'Atlantis' })).expect(400);

    // 1.10 is the same checkout
    const res = await http
      .post(`${API}/auth/guest/checkout`)
      .set(guest)
      .send(checkoutBody({ couponCode: couponCode.toLowerCase() }))
      .expect(201);
    const { order, payment, paymentError } = res.body.data;
    codOrder = order;
    expect(payment).toBeNull();
    expect(paymentError).toBeNull();
    expect(order).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
      paymentMethod: 'COD',
      subtotal: 50_000, // 2 x 10000 + 30000
      discountAmount: 5_000, // 10%
      shippingCost: 5_000,
      totalAmount: 50_000,
      couponCode,
    });
    expect(order.orderNumber).toMatch(/^ORD-\d{8}-[A-Z0-9]{6}$/);
    expect(order.items).toHaveLength(2);
    expect(order.items.find((i: { productId: string }) => i.productId === productA)).toMatchObject({
      productName: `قهوة تركي ${RUN}`,
      priceAtPurchase: 10_000,
      quantity: 2,
    });
    expect(order.statusHistory).toEqual([expect.objectContaining({ fromStatus: null, toStatus: 'CONFIRMED' })]);

    const db = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(db).toMatchObject({ customerPhone: '01005550101', guestId, shippingZoneId: expect.any(String) });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productA } })).stock).toBe(8);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantProduct.variantId } })).stock).toBe(2);
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: couponCode } });
    expect(coupon.usedCount).toBe(1);
    expect(await prisma.couponUsage.count({ where: { orderId: order.id, discountApplied: 5_000 } })).toBe(1);
    const cart = await http.get(`${API}/cart`).set(guest).expect(200);
    expect(cart.body.data).toMatchObject({ items: [], coupon: null });

    for (let i = 0; i < 50 && !mail.orders.some((m) => m.orderNumber === order.orderNumber); i++) await sleep(20);
    expect(mail.orders).toContainEqual({ to: guestEmail('guest'), kind: 'created', orderNumber: order.orderNumber });
  });

  it('4.1 concurrency: two buyers of the last unit -> one order, stock 0 (never -1)', async () => {
    const [g1, g2] = [await newGuestCart([{ productId: lastOne, quantity: 1 }]), await newGuestCart([{ productId: lastOne, quantity: 1 }])];
    const results = await Promise.all(
      [g1, g2].map((g, i) =>
        http.post(`${API}/orders/checkout`).set('x-guest-id', g).send(checkoutBody({ customerEmail: guestEmail(`race${i}`) })),
      ),
    );
    const codes = results.map((r) => r.status).sort((a, b) => a - b);
    expect(codes).toEqual([201, 409]);
    const loser = results.find((r) => r.status === 409)!;
    expect(loser.body.message).toBe(`"Last One ${RUN}" is sold out`);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: lastOne } })).stock).toBe(0);
    expect(await prisma.orderItem.count({ where: { productId: lastOne } })).toBe(1);
  });

  // ───────────────────────── 4.1 + 5.x Paymob ─────────────────────────

  it('4.1 / 5.1 card checkout with a gift card: PENDING_PAYMENT + Paymob checkout URL', async () => {
    const guestId = await newGuestCart([{ productId: productA, quantity: 3 }]);
    const res = await http
      .post(`${API}/orders/checkout`)
      .set('x-guest-id', guestId)
      .send(checkoutBody({ paymentMethod: 'PAYMOB_CARD', giftCardCode: giftCode.toLowerCase(), customerEmail: guestEmail('card') }))
      .expect(201);
    const { order, payment } = res.body.data;
    cardOrder = order;
    cardPayment = payment;
    expect(order).toMatchObject({
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      subtotal: 30_000,
      shippingCost: 5_000,
      giftCardAmount: 10_000,
      totalAmount: 25_000,
    });
    expect(payment.checkoutUrl).toMatch(/^https:\/\/accept\.paymob\.com\/unifiedcheckout\/\?publicKey=.+&clientSecret=/);
    expect(paymob.intentions.at(-1)).toMatchObject({ reference: payment.paymentId, amountPiasters: 25_000, method: 'PAYMOB_CARD' });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.paymentId } })).toMatchObject({
      status: 'PENDING',
      intentionId: payment.intentionId,
      amountPiasters: 25_000,
    });
    expect((await prisma.giftCard.findUniqueOrThrow({ where: { code: giftCode } })).currentBalance).toBe(0);

    // 18.2 now shows no balance; expired and unknown cards are invalid
    const preview = await http.post(`${API}/gift-cards/redeem`).send({ code: giftCode }).expect(200);
    expect(preview.body.data).toMatchObject({ isValid: false, currentBalance: 0 });
    expect((await http.post(`${API}/gift-cards/redeem`).send({ code: `${giftCode}-OLD` }).expect(200)).body.data).toMatchObject({
      isValid: false,
      message: 'This gift card has expired',
    });
    expect((await http.post(`${API}/gift-cards/redeem`).send({ code: 'NOPE-NOPE' }).expect(200)).body.data).toEqual({
      code: 'NOPE-NOPE',
      isValid: false,
      currentBalance: 0,
      expiresAt: null,
      message: 'Invalid gift card code',
    });
  });

  it('5.2 webhook: bad HMAC 401, wrong amount rejected, success confirms, replay is a no-op', async () => {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: cardPayment.paymentId } });
    const obj = webhookObj(payment, cardOrder.totalAmount);

    await postWebhook(obj).expect(401);
    await postWebhook(obj, 'f'.repeat(128)).expect(401);
    const tampered = { ...obj, success: true, amount_cents: 1 };
    await postWebhook(tampered, paymobHmac(obj, hmacSecret)).expect(401); // signature no longer matches

    const wrongAmount = webhookObj(payment, cardOrder.totalAmount - 100);
    await postWebhook(wrongAmount, paymobHmac(wrongAmount, hmacSecret)).expect(400);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: cardOrder.id } })).toMatchObject({
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
    });

    // 5.3 the browser redirect never changes payment state
    const query = {
      ...Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v !== 'object').map(([k, v]) => [k, asText(v)])),
      order: String(obj.order.id),
      merchant_order_id: payment.id,
      'source_data.pan': '2346',
      'source_data.sub_type': 'MasterCard',
      'source_data.type': 'card',
    };
    const cb = await http.get(`${API}/payments/paymob/callback`).query({ ...query, hmac: paymobHmac(obj, hmacSecret) }).expect(302);
    expect(cb.headers.location).toBe(
      `${process.env.FRONTEND_URL}/checkout/result?orderNumber=${cardOrder.orderNumber}&success=true&pending=false`,
    );
    const badCb = await http.get(`${API}/payments/paymob/callback`).query({ ...query, hmac: 'x' }).expect(302);
    expect(badCb.headers.location).toBe(`${process.env.FRONTEND_URL}/checkout/result?status=invalid`);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: cardOrder.id } })).paymentStatus).toBe('PENDING');

    const ok = await postWebhook(obj, paymobHmac(obj, hmacSecret)).expect(200);
    expect(ok.body.data).toEqual({ received: true, status: 'PAID' });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: cardOrder.id } })).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
      status: 'PAID',
      paymobTransactionId: String(obj.id),
    });
    expect(
      await prisma.orderStatusHistory.count({ where: { orderId: cardOrder.id, fromStatus: 'PENDING_PAYMENT', toStatus: 'CONFIRMED' } }),
    ).toBe(1);

    const replay = await postWebhook(obj, paymobHmac(obj, hmacSecret)).expect(200);
    expect(replay.body.data).toEqual({ received: true, duplicate: true });
    expect(await prisma.payment.count({ where: { orderId: cardOrder.id } })).toBe(1);
    for (let i = 0; i < 50 && !mail.orders.some((m) => m.kind === 'paid'); i++) await sleep(20);
    expect(mail.orders).toContainEqual({ to: guestEmail('card'), kind: 'paid', orderNumber: cardOrder.orderNumber });

    // 5.4 status by order number, guest needs contact
    await http.get(`${API}/payments/order/${cardOrder.orderNumber}`).expect(404);
    const status = await http.get(`${API}/payments/order/${cardOrder.orderNumber}?contact=01005550101`).expect(200);
    expect(status.body.data).toMatchObject({ orderStatus: 'CONFIRMED', paymentStatus: 'PAID', totalAmount: 25_000 });
    expect(JSON.stringify(status.body)).not.toContain('rawWebhookPayload');

    // a paid online order cannot be cancelled by the customer
    const cancel = await http.post(`${API}/orders/${cardOrder.id}/cancel`).send({ contact: guestEmail('card') }).expect(400);
    expect(cancel.body.message).toMatch(/already paid/);
  });

  // ───────────────────────── 4.2 / 14.x ─────────────────────────

  it('4.2 tracking needs the order email or phone; 14.2 invoice PDF; 14.3 timeline', async () => {
    await clearRateLimits();
    const track = (contact?: string) =>
      http.get(`${API}/orders/track/${codOrder.orderNumber}${contact ? `?contact=${encodeURIComponent(contact)}` : ''}`);
    await track().expect(400);
    await track('someone@else.com').expect(404);
    await http.get(`${API}/orders/track/ORD-20000101-AAAAAA?contact=${guestEmail('guest')}`).expect(404);
    const byEmail = await track(guestEmail('guest').toUpperCase()).expect(200);
    expect(byEmail.body.data).toMatchObject({ orderNumber: codOrder.orderNumber, status: 'CONFIRMED' });
    expect(byEmail.body.data.shippingAddress).toEqual({ governorate, city: 'Nasr City' }); // no street
    await track('0020 100 555 0101').expect(200);

    await http.get(`${API}/orders/${codOrder.id}/invoice`).expect(404);
    const pdf = await http
      .get(`${API}/orders/${codOrder.id}/invoice?contact=${guestEmail('guest')}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain(`invoice-${codOrder.orderNumber}.pdf`);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    await http.get(`${API}/orders/${codOrder.id}/invoice`).set(auth(staffToken)).expect(200);

    const timeline = await http.get(`${API}/orders/${codOrder.id}/timeline?contact=01005550101`).expect(200);
    expect(timeline.body.data.map((e: { toStatus: string }) => e.toStatus)).toEqual(['CONFIRMED']);
  });

  it('14.1 guest cancels before shipping: stock, coupon use restored; cannot cancel twice', async () => {
    await http.post(`${API}/orders/${codOrder.id}/cancel`).send({ contact: 'wrong@x.com' }).expect(404);
    const res = await http
      .post(`${API}/orders/${codOrder.id}/cancel`)
      .send({ contact: guestEmail('guest'), reason: 'Ordered by mistake' })
      .expect(200);
    expect(res.body.data).toMatchObject({ status: 'CANCELLED', cancelOrRefundReason: 'Ordered by mistake' });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productA } })).stock).toBe(8 - 3 + 2); // card order still holds 3
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantProduct.variantId } })).stock).toBe(3);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: couponCode } })).usedCount).toBe(0);
    expect(await prisma.couponUsage.count({ where: { orderId: codOrder.id } })).toBe(0);
    await http.post(`${API}/orders/${codOrder.id}/cancel`).send({ contact: guestEmail('guest') }).expect(400);
  });

  // ───────────────────────── logged-in + loyalty + 4.6 ─────────────────────────

  it('4.3 / 4.6 customer pays with points; staff moves it to DELIVERED (COD paid, points earned)', async () => {
    const headers = auth(customer.token);
    await http.post(`${API}/cart/items`).set(headers).send({ productId: productA, quantity: 1 }).expect(201);
    await http.post(`${API}/orders/checkout`).set(headers).send(checkoutBody({ redeemLoyaltyPoints: 501, customerEmail: customer.email })).expect(400);

    const gql = await http
      .post('/graphql')
      .set(headers)
      .send({
        query: `mutation($input: CheckoutInput!) { checkout(input: $input) { loyaltyPointsUsed paymentError order { id orderNumber status totalAmount loyaltyDiscount items { quantity } } } }`,
        variables: { input: checkoutBody({ redeemLoyaltyPoints: 100, customerEmail: customer.email }) },
      })
      .expect(200);
    expect(gql.body.errors).toBeUndefined();
    const placed = gql.body.data.checkout;
    expect(placed).toMatchObject({ loyaltyPointsUsed: 100, order: { status: 'CONFIRMED', loyaltyDiscount: 1_000, totalAmount: 14_000 } });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).loyaltyPoints).toBe(400);

    const mine = await http.get(`${API}/orders/my-orders`).set(headers).expect(200);
    expect(mine.body.data.items.map((o: { id: string }) => o.id)).toEqual([placed.order.id]);
    await http.get(`${API}/orders/my-orders`).expect(401);

    const move = (status: string, token = staffToken) =>
      http.patch(`${API}/orders/${placed.order.id}/status`).set(auth(token)).send({ status, note: `to ${status}` });
    await move('PREPARING', customer.token).expect(403);
    await move('SHIPPED').expect(400); // must go through PREPARING
    await move('REFUNDED').expect(400);
    await move('PREPARING').expect(200);
    await move('SHIPPED').expect(200);
    await http.post(`${API}/orders/${placed.order.id}/cancel`).set(headers).send({}).expect(400); // shipped
    await move('CANCELLED').expect(400);
    const delivered = await move('DELIVERED').expect(200);
    expect(delivered.body.data).toMatchObject({ status: 'DELIVERED', paymentStatus: 'PAID' });
    expect(delivered.body.data.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'CONFIRMED',
      'PREPARING',
      'SHIPPED',
      'DELIVERED',
    ]);
    expect(delivered.body.data.statusHistory[1].changedBy).toMatchObject({ role: 'STAFF' });
    // 14000 - 5000 shipping = 9000 piasters of goods -> 9 points
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).loyaltyPoints).toBe(409);
    expect(await prisma.auditLog.count({ where: { entityId: placed.order.id, action: 'ORDER_STATUS_CHANGED' } })).toBe(3);
  });

  // ───────────────────────── 4.4 / 4.5 / 4.7 / 5.5 ─────────────────────────

  it('4.4 / 4.5 admin list with filters and detail', async () => {
    await http.get(`${API}/orders`).set(auth(customer.token)).expect(403);
    const list = await http
      .get(`${API}/orders?search=${cardOrder.orderNumber}&paymentStatus=PAID&paymentMethod=PAYMOB_CARD`)
      .set(auth(staffToken))
      .expect(200);
    expect(list.body.data.items.map((o: { id: string }) => o.id)).toEqual([cardOrder.id]);
    expect(list.body.data.items[0]).toMatchObject({ itemCount: 1, customerPhone: '01005550101' });
    const byEmail = await http.get(`${API}/orders?status=CANCELLED&search=${guestEmail('guest')}`).set(auth(staffToken)).expect(200);
    expect(byEmail.body.data.items.map((o: { id: string }) => o.id)).toEqual([codOrder.id]);

    const detail = await http.get(`${API}/orders/${cardOrder.id}`).set(auth(staffToken)).expect(200);
    expect(detail.body.data.payments).toHaveLength(1);
    expect(detail.body.data.payments[0]).toMatchObject({ status: 'PAID' });

    const viaGql = await http
      .post('/graphql')
      .set(auth(adminToken))
      .send({ query: `query($id: ID!) { order(id: $id) { orderNumber payments { status } statusHistory { toStatus } } }`, variables: { id: cardOrder.id } })
      .expect(200);
    expect(viaGql.body.data.order).toMatchObject({ orderNumber: cardOrder.orderNumber, payments: [{ status: 'PAID' }] });
  });

  it('4.7 refund of a paid card order: Paymob refund, reason kept, stock and gift card restored', async () => {
    const before = (await prisma.product.findUniqueOrThrow({ where: { id: productA } })).stock;
    await http.patch(`${API}/orders/${cardOrder.id}/refund`).set(auth(staffToken)).send({ reason: 'x' }).expect(403);
    await http.patch(`${API}/orders/${cardOrder.id}/refund`).set(auth(adminToken)).send({ reason: 'no' }).expect(400);

    const res = await http
      .patch(`${API}/orders/${cardOrder.id}/refund`)
      .set(auth(adminToken))
      .send({ reason: 'Beans arrived stale' })
      .expect(200);
    expect(res.body.data).toMatchObject({
      status: 'REFUNDED',
      paymentStatus: 'REFUNDED',
      cancelOrRefundReason: 'Beans arrived stale',
    });
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: cardOrder.id } });
    expect(paymob.refunds.at(-1)).toEqual({ transactionId: payment.paymobTransactionId, amount: 25_000 });
    expect(payment).toMatchObject({ status: 'REFUNDED', refundedPiasters: 25_000 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productA } })).stock).toBe(before + 3);
    expect((await prisma.giftCard.findUniqueOrThrow({ where: { code: giftCode } })).currentBalance).toBe(10_000);
    await http.patch(`${API}/orders/${cardOrder.id}/refund`).set(auth(adminToken)).send({ reason: 'again please' }).expect(400);
    expect(await prisma.auditLog.count({ where: { entityId: cardOrder.id, action: 'ORDER_REFUNDED' } })).toBe(1);
  });

  it('5.5 partial refunds add up and cannot exceed the payment', async () => {
    await clearRateLimits();
    const guestId = await newGuestCart([{ productId: productA, quantity: 1 }]);
    const res = await http
      .post(`${API}/orders/checkout`)
      .set('x-guest-id', guestId)
      .send(checkoutBody({ paymentMethod: 'PAYMOB_WALLET', customerEmail: guestEmail('wallet') }))
      .expect(201);
    const order = res.body.data.order;
    expect(order.totalAmount).toBe(15_000);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: res.body.data.payment.paymentId } });
    const obj = webhookObj(payment, 15_000);
    await postWebhook(obj, paymobHmac(obj, hmacSecret)).expect(200);

    const refund = (amountPiasters?: number, token = adminToken) =>
      http.post(`${API}/payments/paymob/refund`).set(auth(token)).send({ orderId: order.id, amountPiasters, reason: 'partial' });
    await refund(1_000, staffToken).expect(403);
    expect((await refund(4_000).expect(200)).body.data).toMatchObject({ status: 'PARTIALLY_REFUNDED', refundedPiasters: 4_000 });
    await refund(11_001).expect(400);
    expect((await refund().expect(200)).body.data).toMatchObject({ status: 'REFUNDED', refundedPiasters: 15_000 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('REFUNDED');
    expect(paymob.refunds.slice(-2).map((r) => r.amount)).toEqual([4_000, 11_000]);

    // 5.1 retry is only for orders still waiting for payment
    await http.post(`${API}/payments/paymob/initiate`).send({ orderId: order.id, contact: guestEmail('wallet') }).expect(400);
  });
});
