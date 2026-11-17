import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Cache, CurrentActor, Public, RateLimit } from '../src/common/decorators/index.js';
import type { Actor } from '../src/common/interfaces/index.js';
import { RedisService } from '../src/common/utilities/caching/redis.service.js';
import { EmailService } from '../src/common/utilities/email/email.service.js';
import { PrismaService } from '../src/models/prisma.service.js';

/** Test-only routes to exercise common decorators */
let cacheHits = 0;
@Controller('test-probe')
class ProbeController {
  @Public()
  @Get('optional')
  optional(@CurrentActor() actor: Actor) {
    return actor;
  }

  @Public()
  @Cache(30, 'probe')
  @Get('cached')
  cached() {
    return { hits: ++cacheHits };
  }

  @Public()
  @RateLimit({ limit: 2, windowSeconds: 60 })
  @Get('limited')
  limited() {
    return { ok: true };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Captures OTPs instead of sending emails (emails are sent in the background) */
class FakeEmailService {
  sent: { to: string; kind: string; otp?: string }[] = [];
  brandName = 'Test';
  async send() {}
  /** Waits until at least n emails of this kind were sent, returns the latest OTP */
  async waitOtp(to: string, kind: string, n = 1): Promise<string> {
    for (let i = 0; i < 100 && this.count(to, kind) < n; i++) await sleep(20);
    return this.lastOtp(to, kind);
  }
  async sendVerificationOtp(to: string, _name: string, otp: string) {
    this.sent.push({ to, kind: 'verify', otp });
  }
  async sendPasswordResetOtp(to: string, _name: string, otp: string) {
    this.sent.push({ to, kind: 'reset', otp });
  }
  async sendGenericEmail(to: string) {
    this.sent.push({ to, kind: 'generic' });
  }
  lastOtp(to: string, kind: string): string {
    const hit = [...this.sent].reverse().find((m) => m.to === to && m.kind === kind);
    if (!hit?.otp) throw new Error(`No ${kind} OTP sent to ${to}`);
    return hit.otp;
  }
  count(to: string, kind: string) {
    return this.sent.filter((m) => m.to === to && m.kind === kind).length;
  }
}

const RUN = randomBytes(4).toString('hex');
const STARTED_AT = new Date().toISOString();
const email = (name: string) => `e2e_${RUN}_${name}@test.local`;
const PASSWORD = 'Str0ngPass!';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let redis: RedisService;
  const mail = new FakeEmailService();

  let categoryId: string;
  let productId: string;
  let variantId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(EmailService)
      .useValue(mail)
      .compile();

    app = configureApp(moduleRef.createNestApplication()) as INestApplication<App>;
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

    // Fresh rate-limit / cache counters for this run
    const keys = [
      ...(await redis.client.keys('rl:*')),
      ...(await redis.client.keys('cache:probe*')),
    ];
    if (keys.length) await redis.client.del(...keys);

    const category = await prisma.category.create({
      data: { name: 'E2E', slug: `e2e-cat-${RUN}` },
    });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: {
        name: 'E2E Coffee',
        slug: `e2e-coffee-${RUN}`,
        description: 'test',
        basePrice: 18500,
        categoryId,
        variants: {
          create: { name: '500g', sku: `E2E-${RUN}-500`, price: 30000 },
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0].id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: `e2e_${RUN}_` } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.order.deleteMany({
      where: { customerEmail: { startsWith: `e2e_${RUN}_`, mode: 'insensitive' } },
    });
    await prisma.cart.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { guestId: { startsWith: 'guest_' }, items: { some: { productId } } }] },
    });
    await prisma.otp.deleteMany({ where: { email: { startsWith: `e2e_${RUN}_` } } });
    // Guest sessions (and their carts) created during this run
    const guestKeys: string[] = [];
    for (const key of await redis.client.keys('guest:*')) {
      const session = await redis.get<{ createdAt: string }>(key);
      if (session && session.createdAt >= STARTED_AT) guestKeys.push(key);
    }
    if (guestKeys.length) {
      await prisma.cart.deleteMany({ where: { guestId: { in: guestKeys.map((k) => k.slice('guest:'.length)) } } });
      await redis.client.del(...guestKeys);
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  // ───────────────────────── helpers ─────────────────────────

  async function newGuest(): Promise<string> {
    const res = await http.post('/api/v1/auth/guest/session').expect(200);
    return res.body.data.guestId as string;
  }

  async function createVerifiedCustomer(name: string) {
    const e = email(name);
    await http
      .post('/api/v1/auth/register')
      .send({ email: e, password: PASSWORD, firstName: 'T', lastName: 'U' })
      .expect(201);
    const res = await http
      .post('/api/v1/auth/verify-otp')
      .send({ email: e, code: await mail.waitOtp(e, 'verify') })
      .expect(200);
    return { email: e, ...res.body.data };
  }

  // ───────────────────────── 1.9 guest session ─────────────────────────

  it('1.9 creates a guest session in Redis and reuses an existing one', async () => {
    const res = await http.post('/api/v1/auth/guest/session').expect(200);
    const guestId: string = res.body.data.guestId;

    expect(guestId).toMatch(/^guest_[0-9a-f]{24}$/);
    expect(res.headers['set-cookie']?.[0]).toMatch(/guest_id=.*HttpOnly/);
    expect(await redis.exists(`guest:${guestId}`)).toBe(1);

    const again = await http
      .post('/api/v1/auth/guest/session')
      .set('x-guest-id', guestId)
      .expect(200);
    expect(again.body.data.guestId).toBe(guestId);
  });

  // ───────────────────────── validation ─────────────────────────

  it('rejects invalid and unknown fields', async () => {
    const res = await http
      .post('/api/v1/auth/register')
      .send({ email: 'bad', password: 'short', firstName: 'a', lastName: 'b', isAdmin: true })
      .expect(400);
    expect(res.body).toMatchObject({ success: false, data: null, message: 'Validation failed' });
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        'property isAdmin should not exist',
        'email must be an email',
      ]),
    );
  });

  // ───────────────────────── 1.1 + 1.2 + 1.3 ─────────────────────────

  it('1.1/1.2 register + verify: merges guest carts (incl. null variant) and claims guest orders', async () => {
    const e = email('alice');

    // Guest A has a cart with a no-variant item and a variant item
    const guestA = await newGuest();
    await prisma.cart.create({
      data: {
        guestId: guestA,
        items: {
          create: [
            { productId, variantId: null, quantity: 2 },
            { productId, variantId, quantity: 1 },
          ],
        },
      },
    });

    // An old guest order placed with the same email (different case)
    const order = await prisma.order.create({
      data: {
        orderNumber: `E2E-${RUN}-1`,
        guestId: 'guest_someoneelse',
        customerName: 'Alice',
        customerEmail: e.toUpperCase(),
        customerPhone: '01000000000',
        shippingAddress: { city: 'Cairo' },
        subtotal: 18500,
        shippingCost: 5000,
        totalAmount: 23500,
        paymentMethod: 'COD',
      },
    });

    const reg = await http
      .post('/api/v1/auth/register')
      .set('x-guest-id', guestA)
      .send({ email: e, password: PASSWORD, firstName: 'Alice', lastName: 'A', phone: '01011111111' })
      .expect(201);
    expect(reg.body.data.requiresEmailVerification).toBe(true);
    expect(reg.body.data.accessToken).toBeUndefined();
    expect(JSON.stringify(reg.body)).not.toMatch(/passwordHash|tokenHash|codeHash/);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: e } });
    const cartAfterRegister = await prisma.cart.findUniqueOrThrow({
      where: { userId: user.id },
      include: { items: true },
    });
    expect(cartAfterRegister.guestId).toBeNull();
    expect(cartAfterRegister.items).toHaveLength(2);

    // Login before verification -> 403 and a fresh OTP is sent
    await mail.waitOtp(e, 'verify', 1);
    const sentBefore = mail.count(e, 'verify');
    const blocked = await http
      .post('/api/v1/auth/login')
      .send({ email: e, password: PASSWORD })
      .expect(403);
    expect(blocked.body.message).toBe('Please verify your email first');
    await mail.waitOtp(e, 'verify', sentBefore + 1);
    expect(mail.count(e, 'verify')).toBe(sentBefore + 1);

    // Guest B adds the same no-variant product -> should be summed on verify
    const guestB = await newGuest();
    await prisma.cart.create({
      data: { guestId: guestB, items: { create: [{ productId, variantId: null, quantity: 3 }] } },
    });

    await http
      .post('/api/v1/auth/verify-otp')
      .send({ email: e, code: '000000' })
      .expect(400);

    const verified = await http
      .post('/api/v1/auth/verify-otp')
      .set('x-guest-id', guestB)
      .send({ email: e, code: mail.lastOtp(e, 'verify') })
      .expect(200);

    expect(verified.body.data.user.isEmailVerified).toBe(true);
    expect(verified.body.data.accessToken).toBeTruthy();
    expect(verified.body.data.claimedOrders).toBeGreaterThanOrEqual(1);
    expect(String(verified.headers['set-cookie'])).toMatch(/refresh_token=.*HttpOnly/);

    const claimed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(claimed.userId).toBe(user.id);

    const merged = await prisma.cart.findUniqueOrThrow({
      where: { userId: user.id },
      include: { items: true },
    });
    const noVariant = merged.items.filter((i) => i.variantId === null);
    expect(noVariant).toHaveLength(1);
    expect(noVariant[0].quantity).toBe(5);
    expect(merged.items.find((i) => i.variantId === variantId)?.quantity).toBe(1);
    expect(await prisma.cart.findUnique({ where: { guestId: guestB } })).toBeNull();

    // OTP cannot be reused
    await http
      .post('/api/v1/auth/verify-otp')
      .send({ email: e, code: mail.lastOtp(e, 'verify') })
      .expect(400);
  });

  // ───────────────────────── 1.3 / 1.4 / 1.8 ─────────────────────────

  it('1.3/1.4 login + refresh rotation; reuse of an old refresh token is rejected and kills the session family', async () => {
    const { email: e } = await createVerifiedCustomer('bob');

    await http.post('/api/v1/auth/login').send({ email: e, password: 'wrong-pass' }).expect(401);
    await http
      .post('/api/v1/auth/login')
      .send({ email: email('nobody'), password: PASSWORD })
      .expect(401);

    const login = await http.post('/api/v1/auth/login').send({ email: e, password: PASSWORD }).expect(200);
    const first = login.body.data.refreshToken as string;

    const rotated = await http.post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(200);
    const second = rotated.body.data.refreshToken as string;
    expect(second).not.toBe(first);
    expect(rotated.body.data.accessToken).toBeTruthy();

    // Reuse of the consumed token -> 401 and all sessions revoked
    await http.post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(401);
    await http.post('/api/v1/auth/refresh').send({ refreshToken: second }).expect(401);

    // Refresh via HttpOnly cookie works too
    const again = await http.post('/api/v1/auth/login').send({ email: e, password: PASSWORD }).expect(200);
    await http
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${again.body.data.refreshToken}`)
      .send({})
      .expect(200);

    await http.post('/api/v1/auth/refresh').send({}).expect(401);
  });

  it('1.8 /me requires a Bearer token and returns no hashes', async () => {
    const { accessToken } = await createVerifiedCustomer('carol');

    await http.get('/api/v1/auth/me').expect(401);
    await http.get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);

    const me = await http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.data.email).toBe(email('carol'));
    expect(me.body.data.passwordHash).toBeUndefined();
  });

  it('1.7 logout revokes the refresh token', async () => {
    const { accessToken, refreshToken } = await createVerifiedCustomer('dave');

    await http.post('/api/v1/auth/logout').send({ refreshToken }).expect(401);
    await http
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);
    await http.post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
  });

  // ───────────────────────── 1.5 / 1.6 ─────────────────────────

  it('1.5/1.6 forgot + reset password; no enumeration; old sessions revoked; send rate limit', async () => {
    const { email: e, refreshToken } = await createVerifiedCustomer('erin');

    const unknown = await http
      .post('/api/v1/auth/forgot-password')
      .send({ email: email('ghost') })
      .expect(200);
    const known = await http.post('/api/v1/auth/forgot-password').send({ email: e }).expect(200);
    expect(unknown.body).toEqual(known.body);

    const code = await mail.waitOtp(e, 'reset');
    await http
      .post('/api/v1/auth/reset-password')
      .send({ email: e, code, newPassword: 'NewPassw0rd!' })
      .expect(200);

    await http.post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
    await http.post('/api/v1/auth/login').send({ email: e, password: PASSWORD }).expect(401);
    await http.post('/api/v1/auth/login').send({ email: e, password: 'NewPassw0rd!' }).expect(200);

    // Rate limit: register sent 1 verify OTP + 1 reset = 2 sends; only 1 more allowed in the window
    await http.post('/api/v1/auth/forgot-password').send({ email: e }).expect(200);
    await http.post('/api/v1/auth/forgot-password').send({ email: e }).expect(200);
    await sleep(200); // background emails
    expect(mail.count(e, 'reset')).toBe(2);
  });

  // ───────────────────────── 1.10 ─────────────────────────

  it('1.10 guest checkout validates input and needs a cart (full flow: orders e2e)', async () => {
    const invalid = await http.post('/api/v1/auth/guest/checkout').send({}).expect(400);
    expect(invalid.body.errors).toEqual(expect.arrayContaining([expect.stringMatching(/customerEmail/)]));
    const empty = await http
      .post('/api/v1/auth/guest/checkout')
      .send({
        customerName: 'No Cart',
        customerEmail: `e2e_${RUN}_nocart@test.local`,
        customerPhone: '01000000000',
        governorate: 'Cairo',
        city: 'Cairo',
        street: 'Street 1',
        paymentMethod: 'COD',
      })
      .expect(400);
    expect(empty.body.message).toBe('Your cart is empty');
  });

  // ───────────────────────── 1.11 / 1.12 ─────────────────────────

  it('1.11/1.12 admin login rejects customers; only SUPER_ADMIN can create staff', async () => {
    const customer = await createVerifiedCustomer('frank');
    await http
      .post('/api/v1/auth/admin/login')
      .send({ email: customer.email, password: PASSWORD })
      .expect(403);

    const superEmail = email('root');
    await prisma.user.create({
      data: {
        email: superEmail,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        firstName: 'Root',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        isEmailVerified: true,
        referralCode: `R${RUN}`.toUpperCase(),
      },
    });
    const admin = await http
      .post('/api/v1/auth/admin/login')
      .send({ email: superEmail, password: PASSWORD })
      .expect(200);
    const superToken = admin.body.data.accessToken as string;

    const staffBody = {
      email: email('staff'),
      password: PASSWORD,
      firstName: 'Staff',
      lastName: 'One',
      role: 'STAFF',
    };

    await http.post('/api/v1/auth/admin/staff').send(staffBody).expect(401);
    await http
      .post('/api/v1/auth/admin/staff')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send(staffBody)
      .expect(403);
    await http
      .post('/api/v1/auth/admin/staff')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ ...staffBody, role: 'SUPER_ADMIN' })
      .expect(400);

    const created = await http
      .post('/api/v1/auth/admin/staff')
      .set('Authorization', `Bearer ${superToken}`)
      .send(staffBody)
      .expect(201);
    expect(created.body.data).toMatchObject({ role: 'STAFF', isEmailVerified: true });

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'STAFF_CREATED', entityId: created.body.data.id },
    });
    expect(audit).not.toBeNull();

    // Staff can use admin login but cannot create staff
    const staffLogin = await http
      .post('/api/v1/auth/admin/login')
      .send({ email: staffBody.email, password: PASSWORD })
      .expect(200);
    await http
      .post('/api/v1/auth/admin/staff')
      .set('Authorization', `Bearer ${staffLogin.body.data.accessToken}`)
      .send({ ...staffBody, email: email('staff2') })
      .expect(403);
  });

  // ───────────────────────── guest / user resolution ─────────────────────────

  it('public routes resolve guest or user and ignore bad tokens', async () => {
    const guestId = await newGuest();
    const { accessToken } = await createVerifiedCustomer('gina');

    const anon = await http
      .get('/api/v1/test-probe/optional')
      .set('x-guest-id', guestId)
      .expect(200);
    expect(anon.body.data).toEqual({ guestId });

    const stale = await http
      .get('/api/v1/test-probe/optional')
      .set('Authorization', 'Bearer expired.or.malformed')
      .set('Cookie', `guest_id=${guestId}`)
      .expect(200);
    expect(stale.body.data).toEqual({ guestId });

    const authed = await http
      .get('/api/v1/test-probe/optional')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(authed.body.data.userId).toBeTruthy();
    expect(authed.body.data.role).toBe('CUSTOMER');
  });

  // ───────────────────────── common: security, rate limit, cache ─────────────────────────

  it('sends security headers', async () => {
    const res = await http.get('/api/v1/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('@RateLimit returns 429 after the limit', async () => {
    await http.get('/api/v1/test-probe/limited').expect(200);
    await http.get('/api/v1/test-probe/limited').expect(200);
    const res = await http.get('/api/v1/test-probe/limited').expect(429);
    expect(res.body.success).toBe(false);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('login is rate limited per IP + email', async () => {
    const e = email('bruteforce');
    for (let i = 0; i < 5; i++) {
      await http.post('/api/v1/auth/login').send({ email: e, password: 'x' }).expect(401);
    }
    await http.post('/api/v1/auth/login').send({ email: e, password: 'x' }).expect(429);
    // A different email from the same IP is not blocked
    await http.post('/api/v1/auth/login').send({ email: email('other'), password: 'x' }).expect(401);
  });

  it('@Cache serves anonymous GETs from Redis inside the response envelope', async () => {
    const first = await http.get('/api/v1/test-probe/cached').expect(200);
    const second = await http.get('/api/v1/test-probe/cached').expect(200);
    expect(first.body).toEqual({ success: true, data: { hits: 1 }, message: 'OK' });
    expect(second.body).toEqual(first.body);
  });
});
