import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { RedisService } from '../src/common/utilities/caching/redis.service.js';
import { EmailService } from '../src/common/utilities/email/email.service.js';
import { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/models/prisma.service.js';

const RUN = randomBytes(4).toString('hex');
const PASSWORD = 'Str0ngPass!123';
const API = '/api/v1';
const DAY = 24 * 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Records coupon emails instead of sending them. */
class FakeEmailService {
  coupons: { to: string; code: string }[] = [];
  brandName = 'Test';
  async send() {}
  async sendVerificationOtp() {}
  async sendPasswordResetOtp() {}
  async sendGenericEmail() {}
  async sendCouponEmail(to: string, opts: { code: string }) {
    this.coupons.push({ to, code: opts.code });
  }
}

describe('GraphQL + cart, coupons, shipping, settings (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let redis: RedisService;
  const mail = new FakeEmailService();

  const userIds: string[] = [];
  const guestIds: string[] = [];
  let adminToken: string;
  let staffToken: string;
  let customer: { id: string; email: string; token: string };

  let categoryId: string;
  let simple: { id: string; slug: string }; // no variants, stock 5, sale 8000
  let withVariant: { id: string; variantId: string }; // variant stock 2, price 30000
  const settingKeysBefore = new Map<string, unknown>();

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const gql = (query: string, variables?: Record<string, unknown>, headers: Record<string, string> = {}) =>
    http.post('/graphql').set(headers).send({ query, variables });
  const clearRateLimits = async () => {
    const keys = await redis.client.keys('rl:*');
    if (keys.length) await redis.client.del(...keys);
  };

  async function user(role: UserRole, name: string) {
    const email = `e2e_${RUN}_${name}@test.local`;
    const row = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        firstName: name,
        lastName: 'E2E',
        role,
        isEmailVerified: true,
        referralCode: `C${RUN}${name}`.toUpperCase().slice(0, 20),
      },
    });
    userIds.push(row.id);
    const path = role === UserRole.CUSTOMER ? 'login' : 'admin/login';
    const res = await http.post(`${API}/auth/${path}`).send({ email, password: PASSWORD }).expect(200);
    return { id: row.id, email, token: res.body.data.accessToken as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue(mail)
      .compile();
    app = configureApp(moduleRef.createNestApplication()) as INestApplication<App>;
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await clearRateLimits();
    await redis.client.del('cache:settings:public');

    adminToken = (await user(UserRole.ADMIN, 'admin')).token;
    staffToken = (await user(UserRole.STAFF, 'staff')).token;
    customer = await user(UserRole.CUSTOMER, 'buyer');

    for (const s of await prisma.storeSetting.findMany({ where: { key: 'free_shipping_threshold' } })) {
      settingKeysBefore.set(s.key, s);
    }

    const category = await prisma.category.create({ data: { name: `Cart ${RUN}`, slug: `cart-${RUN}` } });
    categoryId = category.id;
    const p1 = await prisma.product.create({
      data: {
        name: `Cart Coffee ${RUN}`,
        slug: `cart-coffee-${RUN}`,
        description: 'd',
        basePrice: 10_000,
        salePrice: 8_000,
        costPrice: 4_000,
        stock: 5,
        categoryId,
      },
    });
    simple = { id: p1.id, slug: p1.slug };
    const p2 = await prisma.product.create({
      data: {
        name: `Cart Beans ${RUN}`,
        slug: `cart-beans-${RUN}`,
        description: 'd',
        basePrice: 1,
        categoryId,
        variants: { create: { name: '1kg', sku: `CB-${RUN}`, price: 30_000, stock: 2 } },
      },
      include: { variants: true },
    });
    withVariant = { id: p2.id, variantId: p2.variants[0].id };
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.order.deleteMany({ where: { customerEmail: { startsWith: `e2e_${RUN}_` } } });
    await prisma.cart.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { guestId: { in: guestIds } }] } });
    await prisma.coupon.deleteMany({ where: { code: { startsWith: `E2E${RUN}`.toUpperCase() } } });
    await prisma.shippingZone.deleteMany({ where: { governorate: { contains: RUN } } });
    await prisma.storeSetting.deleteMany({ where: { key: { startsWith: `e2e_${RUN}` } } });
    await prisma.storeSetting.deleteMany({ where: { key: 'free_shipping_threshold' } });
    for (const s of settingKeysBefore.values()) {
      await prisma.storeSetting.create({ data: s as never });
    }
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    const keys = [...guestIds.map((g) => `guest:${g}`), 'cache:settings:public'];
    await redis.client.del(...keys);
    await clearRateLimits();
    await app.close();
  });

  // ───────────────────────── GraphQL infrastructure ─────────────────────────

  it('GraphQL: catalog queries, auth errors and validation errors are well-formed', async () => {
    const res = await gql(
      `query($f: ProductsFilter, $slug: String!) {
         products(filter: $f) { meta { total page limit } items { id name salePrice primaryImage { url } } }
         product(slug: $slug) { id basePrice salePrice variants { id } reviewCount relatedProducts { id } }
         categories { id slug children { id } }
         searchSuggest(q: "cart coff") { id slug }
         brands { id }
       }`,
      { f: { category: `cart-${RUN}`, limit: 10, sort: '-basePrice' }, slug: simple.slug },
    ).expect(200);
    expect(res.body.errors).toBeUndefined();
    const data = res.body.data;
    expect(data.products.meta).toMatchObject({ total: 2, page: 1, limit: 10 });
    expect(data.product).toMatchObject({ id: simple.id, basePrice: 10_000, salePrice: 8_000 });
    expect(data.searchSuggest.map((p: { id: string }) => p.id)).toContain(simple.id);
    expect(data.categories.some((c: { id: string }) => c.id === categoryId)).toBe(true);
    // not wrapped in the REST envelope
    expect(res.body).not.toHaveProperty('success');

    // costPrice is not even in the schema
    const leak = await gql(`{ product(slug: "${simple.slug}") { costPrice } }`).expect(400);
    expect(leak.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');

    const anonymous = await gql('{ me { id } }').expect(200);
    expect(anonymous.body.errors[0]).toMatchObject({
      message: 'Authentication required',
      extensions: { code: 'UNAUTHENTICATED', statusCode: 401 },
    });
    expect(JSON.stringify(anonymous.body)).not.toMatch(/stacktrace|at .*\.ts/);

    const me = await gql('{ me { id email role } }', undefined, auth(customer.token)).expect(200);
    expect(me.body.data.me).toEqual({ id: customer.id, email: customer.email, role: 'CUSTOMER' });

    const notFound = await gql('{ product(slug: "nope-nope") { id } }').expect(200);
    expect(notFound.body.errors[0].extensions).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });

    const invalid = await gql('mutation { addToCart(input: { productId: "x", quantity: 0 }) { id } }').expect(200);
    expect(invalid.body.errors[0].extensions.code).toBe('BAD_REQUEST');
    expect(invalid.body.errors[0].extensions.errors).toEqual(
      expect.arrayContaining(['productId must be a UUID', 'quantity must not be less than 1']),
    );

    const forbidden = await gql('{ shippingZones { id } }', undefined, auth(staffToken)).expect(200);
    expect(forbidden.body.errors[0].extensions).toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    // REST still uses the envelope
    const rest = await http.get(`${API}/products/${simple.slug}`).expect(200);
    expect(rest.body).toMatchObject({ success: true, message: 'OK' });
  });

  // ───────────────────────── 3.x cart ─────────────────────────

  it('3.1–3.5 guest cart: auto guest id, merge lines, stock limits, ownership, clear', async () => {
    const empty = await http.get(`${API}/cart`).expect(200);
    expect(empty.body.data).toMatchObject({ id: null, items: [], subtotal: 0 });

    // first write without a guest id creates one (body + cookie)
    const first = await http.post(`${API}/cart/items`).send({ productId: simple.id, quantity: 2 }).expect(201);
    const guestId: string = first.body.data.guestId;
    guestIds.push(guestId);
    expect(guestId).toMatch(/^guest_[0-9a-f]{24}$/);
    expect(String(first.headers['set-cookie'])).toContain(`guest_id=${guestId}`);
    const guest = { 'x-guest-id': guestId };

    // same line again: quantities add up
    const again = await http.post(`${API}/cart/items`).set(guest).send({ productId: simple.id, quantity: 1 }).expect(201);
    expect(again.body.data.items).toHaveLength(1);
    expect(again.body.data.items[0]).toMatchObject({ quantity: 3, unitPrice: 8_000, originalUnitPrice: 10_000, lineTotal: 24_000 });
    expect(again.body.data).toMatchObject({ subtotal: 24_000, estimatedTotal: 24_000, itemCount: 3, canCheckout: true });
    expect(JSON.stringify(again.body)).not.toContain('costPrice');

    // 3 + 3 > stock 5
    const over = await http.post(`${API}/cart/items`).set(guest).send({ productId: simple.id, quantity: 3 }).expect(400);
    expect(over.body.message).toBe('Only 5 left in stock');
    // product with variants needs variantId; variant stock respected
    await http.post(`${API}/cart/items`).set(guest).send({ productId: withVariant.id, quantity: 1 }).expect(400);
    await http
      .post(`${API}/cart/items`)
      .set(guest)
      .send({ productId: withVariant.id, variantId: withVariant.variantId, quantity: 3 })
      .expect(400);
    const both = await http
      .post(`${API}/cart/items`)
      .set(guest)
      .send({ productId: withVariant.id, variantId: withVariant.variantId, quantity: 2 })
      .expect(201);
    expect(both.body.data.subtotal).toBe(24_000 + 60_000);
    const [line, variantLine] = both.body.data.items as { id: string }[];

    // another guest and a logged-in user cannot touch these lines
    const intruder = { 'x-guest-id': `guest_${RUN}intruder000000` };
    await http.patch(`${API}/cart/items/${line.id}`).set(intruder).send({ quantity: 1 }).expect(404);
    await http.delete(`${API}/cart/items/${line.id}`).set(auth(customer.token)).expect(404);
    const stolen = await gql(
      `mutation($id: ID!) { removeCartItem(itemId: $id) { id } }`,
      { id: line.id },
      intruder,
    ).expect(200);
    expect(stolen.body.errors[0].extensions.code).toBe('NOT_FOUND');

    // 3.3 update, quantity above stock, 0 removes
    const updated = await http.patch(`${API}/cart/items/${line.id}`).set(guest).send({ quantity: 5 }).expect(200);
    expect(updated.body.data.items.find((i: { id: string }) => i.id === line.id).quantity).toBe(5);
    await http.patch(`${API}/cart/items/${line.id}`).set(guest).send({ quantity: 6 }).expect(400);
    const zero = await http.patch(`${API}/cart/items/${line.id}`).set(guest).send({ quantity: 0 }).expect(200);
    expect(zero.body.data.items.map((i: { id: string }) => i.id)).toEqual([variantLine.id]);

    // 3.4 remove, 3.5 clear
    await http.delete(`${API}/cart/items/${variantLine.id}`).set(guest).expect(200);
    await http.post(`${API}/cart/items`).set(guest).send({ productId: simple.id, quantity: 1 }).expect(201);
    const cleared = await http.delete(`${API}/cart`).set(guest).expect(200);
    expect(cleared.body.data).toMatchObject({ items: [], subtotal: 0, coupon: null });
  });

  it('3.x user cart over GraphQL (cart query + mutations)', async () => {
    const headers = auth(customer.token);
    const add = await gql(
      `mutation($input: AddToCartInput!) { addToCart(input: $input) { id guestId subtotal items { id quantity product { slug } } } }`,
      { input: { productId: simple.id, quantity: 2 } },
      headers,
    ).expect(200);
    expect(add.body.errors).toBeUndefined();
    expect(add.body.data.addToCart).toMatchObject({ guestId: null, subtotal: 16_000 });
    const itemId: string = add.body.data.addToCart.items[0].id;

    const overflow = await gql(
      `mutation($id: ID!) { updateCartItem(itemId: $id, input: { quantity: 99 }) { id } }`,
      { id: itemId },
      headers,
    ).expect(200);
    expect(overflow.body.errors[0]).toMatchObject({ message: 'Only 5 left in stock', extensions: { statusCode: 400 } });

    const cart = await gql('{ cart { subtotal itemCount canCheckout items { quantity unitPrice } } }', undefined, headers).expect(200);
    expect(cart.body.data.cart).toMatchObject({ subtotal: 16_000, itemCount: 2, canCheckout: true });

    const cleared = await gql('mutation { clearCart { items { id } subtotal } }', undefined, headers).expect(200);
    expect(cleared.body.data.clearCart).toEqual({ items: [], subtotal: 0 });
  });

  // ───────────────────────── 15.3 / 15.4 settings ─────────────────────────

  it('15.3 / 15.4 settings: admin bulk upsert with validation, public view hides private keys', async () => {
    await http.get(`${API}/admin/settings`).set(auth(staffToken)).expect(403);
    await http.patch(`${API}/admin/settings`).send({ settings: [] }).expect(401);

    const bad = await http
      .patch(`${API}/admin/settings`)
      .set(auth(adminToken))
      .send({ settings: [{ key: 'currency', value: 'egp' }, { key: 'free_shipping_threshold', value: 10.5 }] })
      .expect(400);
    expect(bad.body.errors).toHaveLength(2);

    await http.get(`${API}/settings/public`).expect(200); // warm the cache, must be cleared by PATCH
    const saved = await http
      .patch(`${API}/admin/settings`)
      .set(auth(adminToken))
      .send({
        settings: [
          { key: 'free_shipping_threshold', value: 50_000, isPublic: true },
          { key: `e2e_${RUN}_whatsapp`, value: '01000000000', isPublic: true },
          { key: `e2e_${RUN}_secret`, value: { apiKey: 'hidden' }, isPublic: false },
        ],
      })
      .expect(200);
    expect(saved.body.data).toHaveLength(3);

    const pub = await http.get(`${API}/settings/public`).expect(200);
    expect(pub.body.data).toMatchObject({ free_shipping_threshold: 50_000, [`e2e_${RUN}_whatsapp`]: '01000000000' });
    expect(pub.body.data).not.toHaveProperty(`e2e_${RUN}_secret`);

    const viaGql = await gql('{ publicSettings }').expect(200);
    expect(viaGql.body.data.publicSettings.free_shipping_threshold).toBe(50_000);
    const all = await http.get(`${API}/admin/settings`).set(auth(adminToken)).expect(200);
    expect(all.body.data.some((s: { key: string }) => s.key === `e2e_${RUN}_secret`)).toBe(true);

    expect(await prisma.auditLog.count({ where: { entityType: 'StoreSetting', actorId: userIds[0] } })).toBe(3);
  });

  // ───────────────────────── 15.1 / 15.2 shipping ─────────────────────────

  it('15.1 / 15.2 shipping zones CRUD and rates with the free-shipping threshold', async () => {
    const governorate = `Giza ${RUN}`;
    await http.post(`${API}/admin/shipping-zones`).set(auth(staffToken)).send({}).expect(403);
    const created = await http
      .post(`${API}/admin/shipping-zones`)
      .set(auth(adminToken))
      .send({ governorate, nameAr: `الجيزة ${RUN}`, fee: 6_000, estimatedDays: '2-3' })
      .expect(201);
    const zoneId: string = created.body.data.id;

    await http
      .post(`${API}/admin/shipping-zones`)
      .set(auth(adminToken))
      .send({ governorate: governorate.toUpperCase(), fee: 1, estimatedDays: '1' })
      .expect(409);
    await http
      .post(`${API}/admin/shipping-zones`)
      .set(auth(adminToken))
      .send({ governorate: `X ${RUN}`, fee: -1, estimatedDays: 'soon' })
      .expect(400);

    const rate = (q: string) => http.get(`${API}/shipping/rates?${q}`).expect(200);
    const paid = await rate(`governorate=${encodeURIComponent(`  giza   ${RUN} `)}&cartSubtotal=49999`);
    expect(paid.body.data).toMatchObject({
      governorate,
      fee: 6_000,
      originalFee: 6_000,
      isFreeShipping: false,
      freeShippingThreshold: 50_000,
      amountToFreeShipping: 1,
      estimatedDays: '2-3',
    });
    const free = await rate(`governorate=${encodeURIComponent(`الجيزة ${RUN}`)}&cartSubtotal=50000`);
    expect(free.body.data).toMatchObject({ fee: 0, originalFee: 6_000, isFreeShipping: true });

    const viaGql = await gql(`{ shippingRate(governorate: "${governorate}", cartSubtotal: 60000) { fee isFreeShipping } }`).expect(200);
    expect(viaGql.body.data.shippingRate).toEqual({ fee: 0, isFreeShipping: true });

    const patched = await http
      .patch(`${API}/admin/shipping-zones/${zoneId}`)
      .set(auth(adminToken))
      .send({ fee: 7_500, isActive: false })
      .expect(200);
    expect(patched.body.data).toMatchObject({ fee: 7_500, isActive: false });
    await http.get(`${API}/shipping/rates?governorate=${encodeURIComponent(governorate)}`).expect(404);

    const list = await http.get(`${API}/admin/shipping-zones`).set(auth(adminToken)).expect(200);
    expect(list.body.data.some((z: { id: string }) => z.id === zoneId)).toBe(true);
    const removed = await http.delete(`${API}/admin/shipping-zones/${zoneId}`).set(auth(adminToken)).expect(200);
    expect(removed.body.data).toMatchObject({ deleted: true });

    const actions = await prisma.auditLog.findMany({ where: { entityId: zoneId }, select: { action: true } });
    expect(actions.map((a) => a.action).sort()).toEqual([
      'SHIPPING_ZONE_CREATED',
      'SHIPPING_ZONE_DELETED',
      'SHIPPING_ZONE_UPDATED',
    ]);
  });

  // ───────────────────────── 6.x coupons ─────────────────────────

  it('6.2 / 6.3 coupon admin: create, validation, duplicates, list with stats, RBAC', async () => {
    await clearRateLimits();
    const base = { startsAt: new Date(Date.now() - DAY), expiresAt: new Date(Date.now() + 30 * DAY) };
    const create = (body: object, token = adminToken) => http.post(`${API}/coupons`).set(auth(token)).send(body);

    await create({ code: `e2e${RUN}pct`, discountType: 'PERCENTAGE', discountValue: 10, ...base }, staffToken).expect(403);
    const bad = await create({ code: `e2e${RUN}bad`, discountType: 'PERCENTAGE', discountValue: 150, ...base }).expect(400);
    expect(bad.body.errors.join()).toMatch(/between 1 and 100/);
    await create({ code: `e2e${RUN}bad2`, discountType: 'FIXED_AMOUNT', discountValue: 100, startsAt: base.expiresAt, expiresAt: base.startsAt }).expect(400);

    const pct = await create({
      code: ` e2e${RUN}pct `,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxDiscountAmount: 500,
      minOrderAmount: 1_000,
      ...base,
    }).expect(201);
    expect(pct.body.data).toMatchObject({ code: `E2E${RUN}PCT`.toUpperCase(), status: 'ACTIVE', stats: { usedCount: 0, orders: 0 } });
    await create({ code: `E2E${RUN}PCT`, discountType: 'FIXED_AMOUNT', discountValue: 1, ...base }).expect(409);

    await create({ code: `e2e${RUN}fix`, discountType: 'FIXED_AMOUNT', discountValue: 2_000, ...base }).expect(201);
    await create({
      code: `e2e${RUN}old`,
      discountType: 'FIXED_AMOUNT',
      discountValue: 100,
      startsAt: new Date(Date.now() - 10 * DAY),
      expiresAt: new Date(Date.now() - DAY),
    }).expect(201);

    const list = await http.get(`${API}/coupons?search=E2E${RUN}&sort=code`).set(auth(staffToken)).expect(200);
    expect(list.body.data.items.map((c: { status: string }) => c.status)).toEqual(['ACTIVE', 'EXPIRED', 'ACTIVE']); // FIX, OLD, PCT
    const expiredOnly = await http.get(`${API}/coupons?search=E2E${RUN}&status=EXPIRED`).set(auth(staffToken)).expect(200);
    expect(expiredOnly.body.data.meta.total).toBe(1);

    const viaGql = await gql(
      `query($f: CouponsFilter) { coupons(filter: $f) { meta { total } items { code status stats { remaining } } } }`,
      { f: { search: `E2E${RUN}` } },
      auth(adminToken),
    ).expect(200);
    expect(viaGql.body.data.coupons.meta.total).toBe(3);

    const patched = await http
      .patch(`${API}/coupons/${pct.body.data.id}`)
      .set(auth(adminToken))
      .send({ discountValue: 101 })
      .expect(400);
    expect(patched.body.message).toMatch(/between 1 and 100/);
  });

  it('6.1 validate: percentage cap, fixed, expired, minimum, per-customer limit, apply to cart', async () => {
    await clearRateLimits();
    const validate = (body: object, headers: Record<string, string> = {}) =>
      http.post(`${API}/coupons/validate`).set(headers).send(body);
    const PCT = `E2E${RUN}PCT`.toUpperCase();
    const FIX = `E2E${RUN}FIX`.toUpperCase();

    const capped = await validate({ code: PCT.toLowerCase(), cartSubtotal: 10_000 }).expect(200);
    expect(capped.body.data).toMatchObject({ valid: true, discountAmount: 500, totalAfterDiscount: 9_500 }); // 10% = 1000, capped at 500
    const small = await validate({ code: PCT, cartSubtotal: 2_000 }).expect(200);
    expect(small.body.data.discountAmount).toBe(200);
    const fixed = await validate({ code: FIX, cartSubtotal: 1_500 }).expect(200);
    expect(fixed.body.data.discountAmount).toBe(1_500); // never more than the subtotal

    expect((await validate({ code: `E2E${RUN}OLD`, cartSubtotal: 5_000 }).expect(400)).body.message).toBe('This coupon has expired');
    expect((await validate({ code: PCT, cartSubtotal: 999 }).expect(400)).body.message).toMatch(/Minimum order amount/);
    expect((await validate({ code: `E2E${RUN}NONE`, cartSubtotal: 5_000 }).expect(400)).body.message).toBe('Invalid coupon code');

    // per-customer limit (perUserLimit 1): the buyer already used FIX on an order
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: FIX } });
    await prisma.order.create({
      data: {
        orderNumber: `E2E-${RUN}-1`,
        userId: customer.id,
        customerName: 'Buyer',
        customerEmail: customer.email,
        customerPhone: '01000000000',
        shippingAddress: {},
        subtotal: 5_000,
        shippingCost: 0,
        totalAmount: 3_000,
        paymentMethod: 'COD',
        couponUsage: { create: { couponId: coupon.id, userId: customer.id, customerEmail: customer.email, discountApplied: 2_000 } },
      },
    });
    const used = await validate({ code: FIX, cartSubtotal: 5_000 }, auth(customer.token)).expect(400);
    expect(used.body.message).toBe('You have already used this coupon');
    // a guest typing the same email is also blocked
    await validate({ code: FIX, cartSubtotal: 5_000, email: customer.email.toUpperCase() }).expect(400);

    // subtotal from the caller's cart + applyToCart, then the cart shows the live discount
    const guestRes = await http.post(`${API}/cart/items`).send({ productId: simple.id, quantity: 2 }).expect(201);
    const guestId: string = guestRes.body.data.guestId;
    guestIds.push(guestId);
    const applied = await gql(
      `mutation($input: ValidateCouponInput!) { validateCoupon(input: $input) { valid subtotal discountAmount appliedToCart } }`,
      { input: { code: PCT, applyToCart: true } },
      { 'x-guest-id': guestId },
    ).expect(200);
    expect(applied.body.data.validateCoupon).toEqual({ valid: true, subtotal: 16_000, discountAmount: 500, appliedToCart: true });

    const cart = await http.get(`${API}/cart`).set('x-guest-id', guestId).expect(200);
    expect(cart.body.data).toMatchObject({
      subtotal: 16_000,
      discountAmount: 500,
      estimatedTotal: 15_500,
      coupon: { code: PCT, valid: true, discountType: 'PERCENTAGE', discountAmount: 500 },
    });
    // dropping below the minimum invalidates it live
    const item = cart.body.data.items[0];
    await http.patch(`${API}/cart/items/${item.id}`).set('x-guest-id', guestId).send({ quantity: 0 }).expect(200);
    const after = await http.get(`${API}/cart`).set('x-guest-id', guestId).expect(200);
    expect(after.body.data.coupon).toMatchObject({ valid: false, discountAmount: 0 });

    // used coupon is deactivated on delete, unused one is deleted
    const removedUsed = await http.delete(`${API}/coupons/${coupon.id}`).set(auth(adminToken)).expect(200);
    expect(removedUsed.body.data).toMatchObject({ deleted: false, deactivated: true });
  });

  it('6.4 send-to-buyers queues bilingual emails in the background', async () => {
    const PCT = `E2E${RUN}PCT`.toUpperCase();
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: PCT } });
    const emails = [`e2e_${RUN}_a@test.local`, `E2E_${RUN}_A@test.local`, `e2e_${RUN}_b@test.local`];

    await http.post(`${API}/coupons/send-to-buyers`).set(auth(staffToken)).send({}).expect(403);
    await http
      .post(`${API}/coupons/send-to-buyers`)
      .set(auth(adminToken))
      .send({ couponId: coupon.id, target: 'SPECIFIC_EMAILS' })
      .expect(400); // emails required

    const res = await http
      .post(`${API}/coupons/send-to-buyers`)
      .set(auth(adminToken))
      .send({ couponId: coupon.id, target: 'SPECIFIC_EMAILS', emails, message: 'Thanks!' })
      .expect(202);
    expect(res.body.data).toEqual({ code: PCT, target: 'SPECIFIC_EMAILS', recipients: 2, queued: true });

    for (let i = 0; i < 50 && mail.coupons.length < 2; i++) await sleep(20);
    expect(mail.coupons).toEqual([
      { to: `e2e_${RUN}_a@test.local`, code: PCT },
      { to: `e2e_${RUN}_b@test.local`, code: PCT },
    ]);

    const expired = await prisma.coupon.findUniqueOrThrow({ where: { code: `E2E${RUN}OLD`.toUpperCase() } });
    await http
      .post(`${API}/coupons/send-to-buyers`)
      .set(auth(adminToken))
      .send({ couponId: expired.id, target: 'SUBSCRIBERS' })
      .expect(400);
    expect(await prisma.auditLog.count({ where: { entityId: coupon.id, action: 'COUPON_SENT' } })).toBe(1);
  });

  it('6.1 is rate limited against code guessing (REST and GraphQL)', async () => {
    await clearRateLimits();
    for (let i = 0; i < 10; i++) {
      await http.post(`${API}/coupons/validate`).send({ code: `GUESS${i}X`, cartSubtotal: 1 }).expect(400);
    }
    const blocked = await http.post(`${API}/coupons/validate`).send({ code: 'GUESS99', cartSubtotal: 1 }).expect(429);
    expect(blocked.headers['retry-after']).toBeTruthy();

    for (let i = 0; i < 10; i++) {
      await gql(`mutation { validateCoupon(input: { code: "GQL${i}XX", cartSubtotal: 1 }) { valid } }`);
    }
    const gqlBlocked = await gql('mutation { validateCoupon(input: { code: "GQL99X", cartSubtotal: 1 }) { valid } }').expect(200);
    expect(gqlBlocked.body.errors[0].extensions).toMatchObject({ code: 'TOO_MANY_REQUESTS', statusCode: 429 });
  });
});
