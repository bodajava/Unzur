import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { createHmac, randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { MxValidatorService } from '../src/common/services/mx/mx-validator.service.js';
import { RedisService } from '../src/common/utilities/caching/redis.service.js';
import { EmailService } from '../src/common/utilities/email/email.service.js';
import { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/models/prisma.service.js';
import { PaymobGatewayClient } from '../src/modules/payments/paymob/paymob-gateway.client.js';

const RUN = randomBytes(4).toString('hex');
const API = '/api/v1';
const PASSWORD = 'Str0ngPass!123';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean | Promise<boolean>) => {
  for (let i = 0; i < 100 && !(await ok()); i++) await sleep(20);
};

/** Domains ending in .nomx have no mail server (offline-safe stand-in for DNS). */
class FakeMx {
  async check(email: string) {
    return email.endsWith('.nomx') ? 'invalid' : 'valid';
  }
}

class FakeEmail {
  sent: { to: string; kind: string; data?: Record<string, unknown> }[] = [];
  brandName = 'Test';
  async send() {}
  async sendVerificationOtp(to: string, _n: string, otp: string) {
    this.sent.push({ to, kind: 'verify', data: { otp } });
  }
  async sendPasswordResetOtp() {}
  async sendGenericEmail() {}
  async sendCouponEmail() {}
  async sendOrderEmail() {}
  async sendNewsletterWelcome(to: string) {
    this.sent.push({ to, kind: 'welcome' });
  }
  async sendContactNotification(to: string, data: Record<string, unknown>) {
    this.sent.push({ to, kind: 'contact', data });
  }
  async sendGiftCardEmail(to: string, data: Record<string, unknown>) {
    this.sent.push({ to, kind: 'giftcard', data });
  }
  find(kind: string, to: string) {
    return this.sent.find((m) => m.kind === kind && m.to === to);
  }
}

class FakePaymob {
  private seq = Math.floor(Math.random() * 1e6) * 100;
  isConfigured() {
    return true;
  }
  async createIntention() {
    const n = ++this.seq;
    return { intentionId: `pi_${n}`, clientSecret: `cs_${n}`, paymobOrderId: String(n), checkoutUrl: `https://accept.paymob.com/unifiedcheckout/?publicKey=pk&clientSecret=cs_${n}` };
  }
  async refund() {
    return {};
  }
}

const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id', 'integration_id',
  'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment', 'is_voided', 'order.id',
  'owner', 'pending', 'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
];
const dig = (o: unknown, p: string): unknown =>
  p.split('.').reduce<unknown>((c, k) => (c && typeof c === 'object' ? (c as Record<string, unknown>)[k] : undefined), o);
const asText = (v: unknown) => (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '');

describe('Account, reviews, newsletter, loyalty, gift cards (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let redis: RedisService;
  const mail = new FakeEmail();

  const userIds: string[] = [];
  let adminToken: string;
  let staffToken: string;
  let alice: { id: string; email: string; token: string; referralCode: string };
  let bob: { id: string; email: string; token: string; referralCode: string };
  let categoryId: string;
  let productId: string;
  // Backed up and restored around the run (contact_email would win over admin_email).
  const settingKeys = ['auto_approve_reviews', 'admin_email', 'contact_email'];
  const settingsBefore: unknown[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const email = (n: string) => `e2e_${RUN}_${n}@test.local`;
  const clearRateLimits = async () => {
    const keys = await redis.client.keys('rl:*');
    if (keys.length) await redis.client.del(...keys);
  };
  const gql = (query: string, variables: Record<string, unknown>, token?: string) =>
    http.post('/graphql').set(token ? auth(token) : {}).send({ query, variables });

  async function user(role: UserRole, name: string, loyaltyPoints = 0) {
    const row = await prisma.user.create({
      data: {
        email: email(name),
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        firstName: name[0].toUpperCase() + name.slice(1),
        lastName: 'Tester',
        role,
        isEmailVerified: true,
        loyaltyPoints,
        referralCode: `A${RUN}${name}`.toUpperCase().slice(0, 20),
      },
    });
    userIds.push(row.id);
    const res = await http
      .post(`${API}/auth/${role === UserRole.CUSTOMER ? 'login' : 'admin/login'}`)
      .send({ email: email(name), password: PASSWORD })
      .expect(200);
    return { id: row.id, email: row.email, token: res.body.data.accessToken as string, referralCode: row.referralCode, refreshToken: res.body.data.refreshToken as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue(mail)
      .overrideProvider(MxValidatorService)
      .useValue(new FakeMx())
      .overrideProvider(PaymobGatewayClient)
      .useValue(new FakePaymob())
      .compile();
    app = configureApp(moduleRef.createNestApplication()) as INestApplication<App>;
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await clearRateLimits();

    for (const key of settingKeys) {
      const row = await prisma.storeSetting.findUnique({ where: { key } });
      if (row) {
        settingsBefore.push(row);
        await prisma.storeSetting.delete({ where: { key } });
      }
    }
    await prisma.storeSetting.create({ data: { key: 'admin_email', value: email('owner'), isPublic: false } });

    adminToken = (await user(UserRole.ADMIN, 'admin')).token;
    staffToken = (await user(UserRole.STAFF, 'staff')).token;
    alice = await user(UserRole.CUSTOMER, 'alice', 500);
    bob = await user(UserRole.CUSTOMER, 'bob');

    categoryId = (await prisma.category.create({ data: { name: `Acc ${RUN}`, slug: `acc-${RUN}` } })).id;
    productId = (
      await prisma.product.create({
        data: { name: `Review Me ${RUN}`, slug: `review-me-${RUN}`, description: 'd', basePrice: 10_000, stock: 0, categoryId },
      })
    ).id;
  });

  afterAll(async () => {
    if (!prisma) return;
    const allUsers = await prisma.user.findMany({ where: { email: { startsWith: `e2e_${RUN}_` } }, select: { id: true } });
    const ids = allUsers.map((u) => u.id);
    const cards = await prisma.giftCard.findMany({
      where: { OR: [{ purchasedById: { in: ids } }, { recipientEmail: { startsWith: `e2e_${RUN}_` } }] },
      select: { id: true },
    });
    await prisma.payment.deleteMany({ where: { giftCardId: { in: cards.map((c) => c.id) } } });
    await prisma.giftCard.deleteMany({ where: { id: { in: cards.map((c) => c.id) } } });
    await prisma.order.deleteMany({ where: { userId: { in: ids } } });
    await prisma.coupon.deleteMany({ where: { description: { startsWith: 'Loyalty reward' }, code: { in: (await prisma.loyaltyTransaction.findMany({ where: { userId: { in: ids } }, select: { description: true } })).map((t) => t.description?.split(' ').pop() ?? '') } } });
    await prisma.subscriber.deleteMany({ where: { email: { startsWith: `e2e_${RUN}_` } } });
    await prisma.contactMessage.deleteMany({ where: { email: { startsWith: `e2e_${RUN}_` } } });
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.otp.deleteMany({ where: { email: { startsWith: `e2e_${RUN}_` } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { referredById: null } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.storeSetting.deleteMany({ where: { key: { in: settingKeys } } });
    for (const row of settingsBefore) await prisma.storeSetting.create({ data: row as never });
    await redis.client.del('cache:settings:public');
    await clearRateLimits();
    await app.close();
  });

  // ───────────────────────── 10.1 / 10.2 ─────────────────────────

  it('10.1 updates the profile, normalizes phone, 409 on a phone used by someone else', async () => {
    const res = await http
      .patch(`${API}/auth/me`)
      .set(auth(alice.token))
      .send({ firstName: 'Alice', lastName: 'Adel', phone: '+20 100 777 0001' })
      .expect(200);
    expect(res.body.data).toMatchObject({ firstName: 'Alice', lastName: 'Adel', phone: '01007770001' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash/);

    await http.patch(`${API}/auth/me`).set(auth(bob.token)).send({ phone: '01007770001' }).expect(409);
    await http.patch(`${API}/auth/me`).set(auth(bob.token)).send({ firstName: null }).expect(400);
    await http.patch(`${API}/auth/me`).send({ firstName: 'x' }).expect(401);

    const viaGql = await gql('mutation($i: UpdateProfileInput!) { updateProfile(input: $i) { firstName phone } }', { i: { firstName: 'Bobby', phone: null } }, bob.token).expect(200);
    expect(viaGql.body.data.updateProfile).toEqual({ firstName: 'Bobby', phone: null });
    // GET /auth/me still works next to PATCH /auth/me
    expect((await http.get(`${API}/auth/me`).set(auth(alice.token)).expect(200)).body.data.firstName).toBe('Alice');
  });

  it('10.2 changes the password and revokes every refresh token', async () => {
    const extra = await http.post(`${API}/auth/login`).send({ email: email('bob'), password: PASSWORD }).expect(200);
    const oldRefresh: string = extra.body.data.refreshToken;

    await http.patch(`${API}/auth/change-password`).set(auth(bob.token)).send({ currentPassword: 'wrong-pass-1', newPassword: 'N3wPassword!' }).expect(400);
    await http.patch(`${API}/auth/change-password`).set(auth(bob.token)).send({ currentPassword: PASSWORD, newPassword: 'short' }).expect(400);
    const res = await http
      .patch(`${API}/auth/change-password`)
      .set(auth(bob.token))
      .send({ currentPassword: PASSWORD, newPassword: 'N3wPassword!' })
      .expect(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(String(res.headers['set-cookie'])).toContain('refresh_token=');

    expect(await prisma.refreshToken.count({ where: { userId: bob.id, revokedAt: null } })).toBe(1); // only the new session
    await http.post(`${API}/auth/refresh`).send({ refreshToken: oldRefresh }).expect(401);
    // replaying a revoked token is treated as theft: every session is closed (Step 2 reuse detection)
    expect(await prisma.refreshToken.count({ where: { userId: bob.id, revokedAt: null } })).toBe(0);
    await http.post(`${API}/auth/login`).send({ email: email('bob'), password: PASSWORD }).expect(401);
    const relogin = await http.post(`${API}/auth/login`).send({ email: email('bob'), password: 'N3wPassword!' }).expect(200);
    bob.token = relogin.body.data.accessToken;
  });

  // ───────────────────────── 10.3 – 10.7 ─────────────────────────

  it('10.3–10.7 address book with exactly one default, ownership and promotion on delete', async () => {
    const body = (label: string, extra: object = {}) => ({
      label, fullName: 'Alice Adel', phone: '01007770001', governorate: 'Cairo', city: 'Nasr City', street: `${label} street`, ...extra,
    });
    const defaults = async () => (await prisma.address.findMany({ where: { userId: alice.id, isDefault: true } })).map((a) => a.label);

    const home = (await http.post(`${API}/addresses`).set(auth(alice.token)).send(body('Home')).expect(201)).body.data;
    expect(home.isDefault).toBe(true); // first address
    const work = (await http.post(`${API}/addresses`).set(auth(alice.token)).send(body('Work', { isDefault: true })).expect(201)).body.data;
    expect(await defaults()).toEqual(['Work']);
    const gym = (await http.post(`${API}/addresses`).set(auth(alice.token)).send(body('Gym')).expect(201)).body.data;
    expect(gym.isDefault).toBe(false);

    const list = await http.get(`${API}/addresses`).set(auth(alice.token)).expect(200);
    expect(list.body.data.map((a: { label: string }) => a.label)).toEqual(['Work', 'Gym', 'Home']);

    // someone else's address -> 404
    await http.patch(`${API}/addresses/${home.id}`).set(auth(bob.token)).send({ label: 'Mine' }).expect(404);
    await http.delete(`${API}/addresses/${home.id}`).set(auth(bob.token)).expect(404);
    await http.patch(`${API}/addresses/${home.id}/default`).set(auth(bob.token)).expect(404);

    const updated = await http.patch(`${API}/addresses/${home.id}`).set(auth(alice.token)).send({ city: 'Heliopolis', notes: null }).expect(200);
    expect(updated.body.data).toMatchObject({ city: 'Heliopolis', isDefault: false });

    // concurrent switches still leave one default
    await Promise.all([home.id, gym.id, work.id, home.id].map((id) => http.patch(`${API}/addresses/${id}/default`).set(auth(alice.token)).expect(200)));
    expect(await defaults()).toHaveLength(1);

    await http.patch(`${API}/addresses/${gym.id}/default`).set(auth(alice.token)).expect(200);
    const removed = await http.delete(`${API}/addresses/${gym.id}`).set(auth(alice.token)).expect(200);
    expect(removed.body.data.newDefaultId).toBe(gym.id === work.id ? null : (await prisma.address.findFirstOrThrow({ where: { userId: alice.id }, orderBy: { createdAt: 'desc' } })).id);
    expect(await defaults()).toEqual(['Work']); // most recent remaining

    const viaGql = await gql('{ myAddresses { label isDefault } }', {}, alice.token).expect(200);
    expect(viaGql.body.data.myAddresses).toEqual([{ label: 'Work', isDefault: true }, { label: 'Home', isDefault: false }]);
  });

  // ───────────────────────── 11.x ─────────────────────────

  it('11.1–11.3 wishlist add (idempotent), list with stock, remove', async () => {
    await http.post(`${API}/wishlist`).set(auth(alice.token)).send({ productId: '00000000-0000-4000-8000-000000000000' }).expect(404);
    const first = await http.post(`${API}/wishlist`).set(auth(alice.token)).send({ productId }).expect(201);
    expect(first.body.data).toEqual({ productId, inWishlist: true, changed: true });
    expect((await http.post(`${API}/wishlist`).set(auth(alice.token)).send({ productId }).expect(200)).body.data.changed).toBe(false);

    const list = await http.get(`${API}/wishlist`).set(auth(alice.token)).expect(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0]).toMatchObject({ productId, isAvailable: true, inStock: false, product: { slug: `review-me-${RUN}` } });
    expect(JSON.stringify(list.body)).not.toContain('costPrice');
    expect((await gql('{ myWishlist { meta { total } items { inStock } } }', {}, alice.token)).body.data.myWishlist.meta.total).toBe(1);

    expect((await http.delete(`${API}/wishlist/${productId}`).set(auth(alice.token)).expect(200)).body.data.changed).toBe(true);
    expect((await http.get(`${API}/wishlist`).set(auth(alice.token)).expect(200)).body.data.items).toEqual([]);
  });

  // ───────────────────────── 12.x ─────────────────────────

  it('12.1–12.4 only verified buyers review; moderation; rating summary', async () => {
    const review = (token: string, body: object) => http.post(`${API}/products/${productId}/reviews`).set(auth(token)).send(body);
    const noBuy = await review(alice.token, { rating: 5 }).expect(403);
    expect(noBuy.body.message).toBe('You can only review products you have purchased and received');

    // a delivered order for each buyer
    for (const u of [alice, bob]) {
      await prisma.order.create({
        data: {
          orderNumber: `ORD-20261117-${randomBytes(3).toString('hex').toUpperCase()}`,
          userId: u.id, customerName: 'x', customerEmail: u.email, customerPhone: '01000000000', shippingAddress: {},
          subtotal: 10_000, shippingCost: 0, totalAmount: 10_000, paymentMethod: 'COD', status: 'DELIVERED', paymentStatus: 'PAID',
          items: { create: { productId, productName: 'x', priceAtPurchase: 10_000, quantity: 1 } },
        },
      });
    }
    await review(alice.token, { rating: 6 }).expect(400);
    const created = await review(alice.token, { rating: 5, title: 'Great', comment: 'Lovely beans' }).expect(201);
    expect(created.body.data).toMatchObject({ rating: 5, isApproved: false });
    await review(alice.token, { rating: 4 }).expect(409);

    const pub = () => http.get(`${API}/products/${productId}/reviews`).expect(200);
    expect((await pub()).body.data).toMatchObject({ items: [], ratingSummary: { totalReviews: 0, averageRating: null } });

    // auto-approve on for the second review
    await prisma.storeSetting.create({ data: { key: 'auto_approve_reviews', value: true } });
    const viaGql = await gql(
      'mutation($p: ID!, $i: CreateReviewInput!) { createReview(productId: $p, input: $i) { isApproved rating } }',
      { p: productId, i: { rating: 3 } },
      bob.token,
    ).expect(200);
    expect(viaGql.body.data.createReview).toEqual({ isApproved: true, rating: 3 });

    const queue = await http.get(`${API}/admin/reviews?search=${RUN}`).set(auth(staffToken)).expect(200);
    expect(queue.body.data.items.map((r: { isApproved: boolean }) => r.isApproved)).toEqual([false, true]); // pending first
    await http.get(`${API}/admin/reviews`).set(auth(alice.token)).expect(403);
    await http.patch(`${API}/admin/reviews/${created.body.data.id}`).set(auth(staffToken)).send({ isApproved: true }).expect(200);
    expect(await prisma.auditLog.count({ where: { entityId: created.body.data.id, action: 'REVIEW_APPROVED' } })).toBe(1);

    const summary = (await pub()).body.data;
    expect(summary.ratingSummary).toEqual({
      averageRating: 4,
      totalReviews: 2,
      breakdown: [
        { stars: 5, count: 1 }, { stars: 4, count: 0 }, { stars: 3, count: 1 }, { stars: 2, count: 0 }, { stars: 1, count: 0 },
      ],
    });
    expect(summary.items.map((r: { reviewerName: string }) => r.reviewerName).sort()).toEqual(['Alice A.', 'Bobby T.']);
    expect(JSON.stringify(summary)).not.toContain('@');
    const gqlList = await gql('query($p: ID!) { productReviews(productId: $p) { ratingSummary { averageRating } items { verifiedPurchase } } }', { p: productId }).expect(200);
    expect(gqlList.body.data.productReviews.ratingSummary.averageRating).toBe(4);
  });

  // ───────────────────────── 7.x ─────────────────────────

  it('7.1–7.3 newsletter: MX check, idempotent, reactivation, admin list/delete', async () => {
    await clearRateLimits();
    const sub = (e: string) => http.post(`${API}/newsletter/subscribe`).send({ email: e });
    const bad = await sub(`e2e_${RUN}_x@domain.nomx`).expect(400);
    expect(bad.body.message).toBe('This email domain cannot receive email');

    expect((await sub(email('news').toUpperCase()).expect(200)).body.data.result).toBe('CREATED');
    expect((await sub(email('news')).expect(200)).body.data.result).toBe('ALREADY_SUBSCRIBED');
    await until(() => !!mail.find('welcome', email('news')));
    expect(mail.find('welcome', email('news'))).toBeTruthy();

    await prisma.subscriber.update({ where: { email: email('news') }, data: { isActive: false } });
    const viaGql = await gql('mutation($i: SubscribeInput!) { subscribeNewsletter(input: $i) { result } }', { i: { email: email('news') } }).expect(200);
    expect(viaGql.body.data.subscribeNewsletter.result).toBe('REACTIVATED');

    await http.get(`${API}/newsletter/subscribers`).set(auth(alice.token)).expect(403);
    const list = await http.get(`${API}/newsletter/subscribers?isActive=true&search=e2e_${RUN}`).set(auth(staffToken)).expect(200);
    expect(list.body.data.items.map((s: { email: string }) => s.email)).toEqual([email('news')]);
    const id = list.body.data.items[0].id;
    await http.delete(`${API}/newsletter/subscribers/${id}`).set(auth(staffToken)).expect(403);
    await http.delete(`${API}/newsletter/subscribers/${id}`).set(auth(adminToken)).expect(200);

    // spam flood is rate limited (5 per hour per IP)
    await clearRateLimits();
    for (let i = 0; i < 5; i++) await sub(email(`flood${i}`));
    await sub(email('flood5')).expect(429);
  });

  it('7.4–7.7 contact: saved + admin emailed, inbox, mark read/replied, delete', async () => {
    await clearRateLimits();
    const sent = await http
      .post(`${API}/contact`)
      .send({ name: 'Visitor', email: email('visitor'), phone: '+201001112223', subject: 'Wholesale', message: 'Do you sell 10kg bags?' })
      .expect(201);
    const id = sent.body.data.id;
    await http.post(`${API}/contact`).send({ name: 'x', email: 'bad', message: 'hi' }).expect(400);
    await until(() => !!mail.find('contact', email('owner')));
    expect(mail.find('contact', email('owner'))?.data).toMatchObject({ subject: 'Wholesale', phone: '01001112223' });

    const inbox = await http.get(`${API}/contact/messages?isRead=false&search=Wholesale`).set(auth(staffToken)).expect(200);
    expect(inbox.body.data.items.map((m: { id: string }) => m.id)).toContain(id);
    await http.patch(`${API}/contact/messages/${id}`).set(auth(staffToken)).send({}).expect(400);
    const replied = await http.patch(`${API}/contact/messages/${id}`).set(auth(staffToken)).send({ replied: true }).expect(200);
    expect(replied.body.data).toMatchObject({ isRead: true, repliedAt: expect.any(String) });
    await http.delete(`${API}/contact/messages/${id}`).set(auth(staffToken)).expect(403);
    await http.delete(`${API}/contact/messages/${id}`).set(auth(adminToken)).expect(200);
    await http.get(`${API}/contact/messages`).expect(401);
  });

  // ───────────────────────── 17.x ─────────────────────────

  it('17.1 / 17.2 points summary and conversion into a single-use coupon', async () => {
    const summary = await http.get(`${API}/loyalty/points`).set(auth(alice.token)).expect(200);
    expect(summary.body.data).toMatchObject({ points: 500, valuePiasters: 5_000, pointValuePiasters: 10, minRedeemPoints: 100 });

    await http.post(`${API}/loyalty/redeem`).set(auth(alice.token)).send({ points: 50 }).expect(400);
    expect((await http.post(`${API}/loyalty/redeem`).set(auth(alice.token)).send({ points: 600 }).expect(400)).body.message).toBe('You have 500 points');

    const res = await http.post(`${API}/loyalty/redeem`).set(auth(alice.token)).send({ points: 200 }).expect(201);
    const { couponCode, discountValue, remainingPoints } = res.body.data;
    expect(couponCode).toMatch(/^PTS-[A-Z0-9]{8}$/);
    expect({ discountValue, remainingPoints }).toEqual({ discountValue: 2_000, remainingPoints: 300 });
    expect(await prisma.coupon.findUniqueOrThrow({ where: { code: couponCode } })).toMatchObject({
      discountType: 'FIXED_AMOUNT', usageLimit: 1, perUserLimit: 1, usedCount: 0,
    });
    const validated = await http.post(`${API}/coupons/validate`).send({ code: couponCode, cartSubtotal: 5_000 }).expect(200);
    expect(validated.body.data.discountAmount).toBe(2_000);

    const history = await gql('{ myLoyalty { points history { points type description } } }', {}, alice.token).expect(200);
    expect(history.body.data.myLoyalty.points).toBe(300);
    expect(history.body.data.myLoyalty.history[0]).toMatchObject({ points: -200, type: 'REDEEMED_DISCOUNT' });
  });

  it('17.3 / 17.4 referrals: no self-referral, bonus to both once, sign-up codes rewarded on verification', async () => {
    await clearRateLimits();
    const apply = (token: string, code: string) => http.post(`${API}/referrals/apply`).set(auth(token)).send({ code });
    expect((await apply(bob.token, bob.referralCode).expect(400)).body.message).toBe('You cannot use your own referral code');
    await apply(bob.token, 'NOSUCHCODE1').expect(400);
    // bob has a delivered order from the review test -> too late
    expect((await apply(bob.token, alice.referralCode).expect(400)).body.message).toMatch(/before your first order/);

    const carol = await user(UserRole.CUSTOMER, 'carol');
    const ok = await apply(carol.token, alice.referralCode.toLowerCase()).expect(200);
    expect(ok.body.data).toEqual({ applied: true, bonusPoints: 50, yourPoints: 50 });
    await apply(carol.token, bob.referralCode).expect(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).loyaltyPoints).toBe(350);

    // referral code used at registration: rewarded after email verification
    await http.post(`${API}/auth/register`).send({ email: email('dave'), password: PASSWORD, firstName: 'Dave', lastName: 'Doe', referralCode: alice.referralCode }).expect(201);
    await until(() => !!mail.find('verify', email('dave')));
    await http.post(`${API}/auth/verify-otp`).send({ email: email('dave'), code: mail.find('verify', email('dave'))!.data!.otp }).expect(200);
    await until(async () => (await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).loyaltyPoints === 400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).loyaltyPoints).toBe(400);

    const me = await http.get(`${API}/referrals/me`).set(auth(alice.token)).expect(200);
    expect(me.body.data).toMatchObject({ referralCode: alice.referralCode, totalReferrals: 2, rewardedReferrals: 2, bonusPoints: 50 });
    expect(me.body.data.referrals.map((r: { name: string }) => r.name).sort()).toEqual(['Carol T.', 'Dave D.']);
    expect(JSON.stringify(me.body)).not.toMatch(/@|passwordHash|tokenHash/);
  });

  // ───────────────────────── 18.1 / 18.3 ─────────────────────────

  it('18.1 bought gift cards stay inactive until Paymob confirms; 18.3 admin list/issue/deactivate', async () => {
    await clearRateLimits();
    await http.post(`${API}/gift-cards`).set(auth(alice.token)).send({ amountPiasters: 4_999 }).expect(400);
    const bought = await http
      .post(`${API}/gift-cards`)
      .set(auth(alice.token))
      .send({ amountPiasters: 10_000, recipientEmail: email('friend'), message: 'Happy birthday!' })
      .expect(201);
    expect(bought.body.data.giftCard).toMatchObject({ amountPiasters: 10_000, status: 'PENDING_PAYMENT', recipientEmail: email('friend') });
    expect(bought.body.data.payment.checkoutUrl).toContain('unifiedcheckout');
    expect(JSON.stringify(bought.body.data.giftCard)).not.toContain('GC-');

    const card = await prisma.giftCard.findFirstOrThrow({ where: { purchasedById: alice.id } });
    expect(card).toMatchObject({ isActive: false, currentBalance: 10_000 });
    expect(card.code).toMatch(/^GC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect((await http.post(`${API}/gift-cards/redeem`).send({ code: card.code }).expect(200)).body.data.isValid).toBe(false);
    expect((await http.get(`${API}/gift-cards/mine`).set(auth(alice.token)).expect(200)).body.data[0]).toMatchObject({ code: null, paymentStatus: 'PENDING' });

    // Paymob webhook (signed) activates it and emails the code to the recipient
    const payment = await prisma.payment.findFirstOrThrow({ where: { giftCardId: card.id } });
    const obj = {
      id: Number(`7${Date.now().toString().slice(-9)}`), amount_cents: 10_000, created_at: '2026-11-17T12:00:00', currency: 'EGP',
      error_occured: false, has_parent_transaction: false, integration_id: 1, is_3d_secure: true, is_auth: false, is_capture: false,
      is_refunded: false, is_standalone_payment: true, is_voided: false, order: { id: Number(payment.paymobOrderId) }, owner: 1,
      pending: false, source_data: { pan: '1234', sub_type: 'Visa', type: 'card' }, success: true, special_reference: payment.id,
    };
    const hmac = createHmac('sha512', process.env.PAYMOB_HMAC_SECRET ?? '').update(HMAC_FIELDS.map((f) => asText(dig(obj, f))).join('')).digest('hex');
    await http.post(`${API}/payments/paymob/webhook?hmac=${hmac}`).send({ type: 'TRANSACTION', obj: { ...obj, amount_cents: 9_999 } }).expect(401);
    expect((await http.post(`${API}/payments/paymob/webhook?hmac=${hmac}`).send({ type: 'TRANSACTION', obj }).expect(200)).body.data).toEqual({ received: true, status: 'PAID' });
    expect((await prisma.giftCard.findUniqueOrThrow({ where: { id: card.id } })).isActive).toBe(true);
    await until(() => !!mail.find('giftcard', email('friend')));
    expect(mail.find('giftcard', email('friend'))?.data).toMatchObject({ code: card.code, amountPiasters: 10_000, message: 'Happy birthday!', fromName: 'Alice' });
    expect((await http.get(`${API}/gift-cards/mine`).set(auth(alice.token)).expect(200)).body.data[0]).toMatchObject({ code: card.code, paymentStatus: 'PAID', isActive: true });
    expect((await http.post(`${API}/payments/paymob/webhook?hmac=${hmac}`).send({ type: 'TRANSACTION', obj }).expect(200)).body.data.duplicate).toBe(true);

    // 18.3
    await http.get(`${API}/admin/gift-cards`).set(auth(staffToken)).expect(403);
    const issued = await http.post(`${API}/admin/gift-cards`).set(auth(adminToken)).send({ amountPiasters: 25_000, recipientEmail: email('vip') }).expect(201);
    expect(issued.body.data).toMatchObject({ isActive: true, source: 'ADMIN', initialBalance: 25_000 });
    await until(() => !!mail.find('giftcard', email('vip')));
    const list = await http.get(`${API}/admin/gift-cards?search=e2e_${RUN}`).set(auth(adminToken)).expect(200);
    expect(list.body.data.items.map((c: { source: string; paymentStatus: string | null }) => [c.source, c.paymentStatus]).sort()).toEqual([
      ['ADMIN', null],
      ['PURCHASE', 'PAID'],
    ]);
    const off = await http.patch(`${API}/admin/gift-cards/${issued.body.data.id}`).set(auth(adminToken)).send({ isActive: false }).expect(200);
    expect(off.body.data.isActive).toBe(false);
    expect(await prisma.auditLog.count({ where: { entityId: issued.body.data.id, action: { in: ['GIFT_CARD_ISSUED', 'GIFT_CARD_DEACTIVATED'] } } })).toBe(2);
  });
});
