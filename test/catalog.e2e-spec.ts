import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { StorageService } from '../src/common/services/s3/storage.service.js';
import { RedisService } from '../src/common/utilities/caching/redis.service.js';
import { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/models/prisma.service.js';

const RUN = randomBytes(4).toString('hex');
const PASSWORD = 'Str0ngPass!123';
const API = '/api/v1';
// Smallest valid PNG (1x1). Multer only checks the declared MIME type.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const uploadsDir = resolve(process.env.UPLOAD_DIR || resolve(process.cwd(), 'uploads'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Catalog, variants & discovery (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let redis: RedisService;

  const userIds: string[] = [];
  let adminToken: string;
  let staffToken: string;
  const guestId = `guest_${RUN}${'0'.repeat(16)}`;

  // created during the run
  let parentCat: { id: string; slug: string };
  let childCat: { id: string; slug: string };
  let brand: { id: string; slug: string };
  let arabic: { id: string; slug: string; images: { id: string; url: string; isPrimary: boolean }[] };
  let english: { id: string; slug: string };
  let variantId: string;
  const uploadedUrls: string[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const noCostPrice = (body: unknown) => expect(JSON.stringify(body)).not.toContain('costPrice');

  async function staffUser(role: UserRole, name: string): Promise<string> {
    const email = `e2e_${RUN}_${name}@test.local`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        firstName: name,
        lastName: 'E2E',
        role,
        isEmailVerified: true,
        referralCode: `E2E${RUN}${name}`.toUpperCase().slice(0, 20),
      },
    });
    userIds.push(user.id);
    const res = await http.post(`${API}/auth/admin/login`).send({ email, password: PASSWORD }).expect(200);
    return res.body.data.accessToken as string;
  }

  async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
    let value = await fn();
    for (let i = 0; i < 100 && !ok(value); i++) {
      await sleep(30);
      value = await fn();
    }
    return value;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication()) as INestApplication<App>;
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await mkdir(uploadsDir, { recursive: true });

    const keys = [
      ...(await redis.client.keys('rl:*')),
      ...(await redis.client.keys('cache:suggest*')),
      ...(await redis.client.keys('view_dedup:*')),
    ];
    if (keys.length) await redis.client.del(...keys);

    adminToken = await staffUser(UserRole.ADMIN, 'admin');
    staffToken = await staffUser(UserRole.STAFF, 'staff');
  });

  afterAll(async () => {
    const products = await prisma.product.findMany({
      where: { slug: { contains: RUN } },
      select: { id: true, images: { select: { url: true } } },
    });
    const productIds = products.map((p) => p.id);
    await prisma.order.deleteMany({ where: { customerEmail: { startsWith: `e2e_${RUN}_` } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } }); // cascades images, variants, views…
    await prisma.category.deleteMany({ where: { slug: { contains: RUN }, parentId: { not: null } } });
    await prisma.category.deleteMany({ where: { slug: { contains: RUN } } });
    await prisma.brand.deleteMany({ where: { slug: { contains: RUN } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    const urls = [...uploadedUrls, ...products.flatMap((p) => p.images.map((i) => i.url))];
    await app.get(StorageService).deleteFiles([...new Set(urls)]);
    const keys = await redis.client.keys(`view_dedup:*`);
    if (keys.length) await redis.client.del(...keys);
    await app.close();
  });

  // ───────────────────────── 2.9 / 2.12 categories & brands ─────────────────────────

  it('2.9 / 2.12 admin creates categories and a brand with auto slugs and audit logs', async () => {
    await http.post(`${API}/categories`).send({ name: 'x' }).expect(401);
    await http.post(`${API}/categories`).set(auth(staffToken)).send({ name: 'Nope' }).expect(403);

    const parent = await http
      .post(`${API}/categories`)
      .set(auth(adminToken))
      .send({ name: `قهوة ${RUN}`, description: 'كل أنواع القهوة' })
      .expect(201);
    parentCat = parent.body.data;
    expect(parentCat.slug).toBe(`قهوة-${RUN}`);

    // multipart with an image
    const child = await http
      .post(`${API}/categories`)
      .set(auth(adminToken))
      .field('name', `Single Origin ${RUN}`)
      .field('parentId', parentCat.id)
      .attach('image', PNG, { filename: 'c.png', contentType: 'image/png' })
      .expect(201);
    childCat = child.body.data;
    expect(child.body.data.imageUrl).toMatch(/\/uploads\/categories\/.+\.png$/);
    uploadedUrls.push(child.body.data.imageUrl);

    // explicit slug that is already taken -> 409
    await http
      .post(`${API}/categories`)
      .set(auth(adminToken))
      .send({ name: 'Dup', slug: parentCat.slug })
      .expect(409);

    const b = await http
      .post(`${API}/brands`)
      .set(auth(adminToken))
      .send({ name: `Abu Auf ${RUN}` })
      .expect(201);
    brand = b.body.data;

    const logs = await prisma.auditLog.findMany({
      where: { entityId: { in: [parentCat.id, childCat.id, brand.id] } },
      select: { action: true },
    });
    expect(logs.map((l) => l.action).sort()).toEqual([
      'BRAND_CREATED',
      'CATEGORY_CREATED',
      'CATEGORY_CREATED',
    ]);
  });

  it('2.7 / 2.8 / 2.10 / 2.11 public category tree, category by slug, brand by id or slug', async () => {
    const tree = await http.get(`${API}/categories`).expect(200);
    const node = tree.body.data.find((c: { id: string }) => c.id === parentCat.id);
    expect(node.children.map((c: { id: string }) => c.id)).toEqual([childCat.id]);
    expect(JSON.stringify(tree.body.data)).not.toContain('deletedAt');

    const one = await http.get(`${API}/categories/${encodeURIComponent(parentCat.slug)}`).expect(200);
    expect(one.body.data.children).toHaveLength(1);

    const byId = await http.get(`${API}/brands/${brand.id}`).expect(200);
    const bySlug = await http.get(`${API}/brands/${brand.slug}`).expect(200);
    expect(byId.body.data.id).toBe(bySlug.body.data.id);
    const list = await http.get(`${API}/brands`).expect(200);
    expect(list.body.data.some((x: { id: string }) => x.id === brand.id)).toBe(true);
  });

  // ───────────────────────── 2.4 create product (multipart) ─────────────────────────

  it('2.4 creates a product from multipart with images, rejects bad input', async () => {
    const res = await http
      .post(`${API}/products`)
      .set(auth(adminToken))
      .field('name', `قهوة عربية Arabic Coffee ${RUN}`)
      .field('description', 'بن محمص طازة بالهيل')
      .field('shortDescription', 'Cardamom roast')
      .field('basePrice', '18500')
      .field('salePrice', '15000')
      .field('costPrice', '9000')
      .field('stock', '0')
      .field('isFeatured', 'true')
      .field('categoryId', parentCat.id)
      .attach('images', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('images', PNG, { filename: 'b.png', contentType: 'image/png' })
      .expect(201);

    arabic = res.body.data;
    expect(res.body.data).toMatchObject({
      basePrice: 18500,
      salePrice: 15000,
      costPrice: 9000, // admin response
      isFeatured: true,
      stock: 0,
    });
    expect(arabic.slug).toBe(`قهوة-عربية-arabic-coffee-${RUN}`);
    expect(arabic.images).toHaveLength(2);
    expect(arabic.images.filter((i) => i.isPrimary)).toHaveLength(1);
    // the file is really stored and served
    const path = new URL(arabic.images[0].url).pathname;
    await http.get(path).expect(200);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: arabic.id, action: 'PRODUCT_CREATED' },
    });
    expect(audit?.actorId).toBe(userIds[0]);

    const eng = await http
      .post(`${API}/products`)
      .set(auth(adminToken))
      .send({
        name: `Ethiopian Yirgacheffe ${RUN}`,
        description: 'Floral light roast',
        basePrice: 30000,
        costPrice: 20000,
        stock: 5,
        categoryId: childCat.id,
        brandId: brand.id,
      })
      .expect(201);
    english = eng.body.data;

    // bad MIME type, salePrice >= basePrice, negative / decimal money, unknown field
    await http
      .post(`${API}/products`)
      .set(auth(adminToken))
      .field('name', 'Bad file')
      .field('description', 'd')
      .field('basePrice', '100')
      .field('categoryId', parentCat.id)
      .attach('images', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' })
      .expect(400);
    // an SVG (scriptable) renamed and declared as PNG: rejected by magic bytes, nothing written
    const filesBefore = (await readdir(uploadsDir, { recursive: true })).length;
    const disguised = await http
      .post(`${API}/products`)
      .set(auth(adminToken))
      .field('name', 'Disguised file')
      .field('description', 'd')
      .field('basePrice', '100')
      .field('categoryId', parentCat.id)
      .attach('images', PNG, { filename: 'ok.png', contentType: 'image/png' })
      .attach('images', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), {
        filename: 'cat.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(disguised.body.message).toMatch(/File #2 is not a valid image/);
    expect((await readdir(uploadsDir, { recursive: true })).length).toBe(filesBefore);
    expect(await prisma.product.count({ where: { name: 'Disguised file' } })).toBe(0);

    const invalid = await http
      .post(`${API}/products`)
      .set(auth(adminToken))
      .send({
        name: 'Bad prices',
        description: 'd',
        basePrice: 100,
        salePrice: 100,
        costPrice: -5,
        stock: 1.5,
        categoryId: parentCat.id,
        hacker: true,
      })
      .expect(400);
    expect(invalid.body.errors.join(' ')).toMatch(/salePrice must be less than basePrice/);
    expect(invalid.body.errors.join(' ')).toMatch(/hacker should not exist/);
    // staff can read but not write
    await http.post(`${API}/products`).set(auth(staffToken)).send({}).expect(403);
  });

  // ───────────────────────── 2.1 public list ─────────────────────────

  it('2.1 filters by category (incl. sub-categories), brand, price and full-text search; hides costPrice', async () => {
    const ids = async (query: string) => {
      const res = await http.get(`${API}/products?${query}`).expect(200);
      noCostPrice(res.body);
      return res.body.data.items.map((p: { id: string }) => p.id).sort();
    };
    const both = [arabic.id, english.id].sort();
    const cat = `category=${encodeURIComponent(parentCat.slug)}`;

    expect(await ids(cat)).toEqual(both);
    expect(await ids(`category=${childCat.id}`)).toEqual([english.id]);
    expect(await ids(`${cat}&brand=${brand.slug}`)).toEqual([english.id]);
    // arabic costs 15000 after sale, english 30000
    expect(await ids(`${cat}&minPrice=16000`)).toEqual([english.id]);
    expect(await ids(`${cat}&maxPrice=15000`)).toEqual([arabic.id]);
    expect(await ids(`${cat}&inStock=true`)).toEqual([english.id]);
    expect(await ids(`${cat}&isFeatured=true`)).toEqual([arabic.id]);
    expect(await ids(`${cat}&search=${encodeURIComponent('قهوة عربية')}`)).toEqual([arabic.id]);
    expect(await ids(`${cat}&search=yirga`)).toEqual([english.id]); // prefix match
    expect(await ids(`${cat}&search=${encodeURIComponent('coffee & (')}`)).toEqual([arabic.id]);
    expect(await ids(`category=no-such-category-${RUN}`)).toEqual([]);

    const page = await http.get(`${API}/products?${cat}&limit=1&sort=-basePrice`).expect(200);
    expect(page.body.data.items[0].id).toBe(english.id);
    expect(page.body.data.meta).toMatchObject({ total: 2, totalPages: 2, hasNextPage: true });
    expect(page.body.data.items[0].primaryImage).toBeNull();
  });

  // ───────────────────────── 13.x variants ─────────────────────────

  it('13.1 / 13.2 adds and edits a variant with price validation and audit logs', async () => {
    await http
      .post(`${API}/products/${arabic.id}/variants`)
      .set(auth(adminToken))
      .send({ name: '250g', sku: `AR-${RUN}-250`, price: 9000, salePrice: 9500 })
      .expect(400);

    const created = await http
      .post(`${API}/products/${arabic.id}/variants`)
      .set(auth(adminToken))
      .send({ name: '250g', sku: `AR-${RUN}-250`, price: 9000, stock: 0, attributes: { weight: '250g' } })
      .expect(201);
    variantId = created.body.data.id;

    // duplicate SKU -> 409
    await http
      .post(`${API}/products/${arabic.id}/variants`)
      .set(auth(adminToken))
      .send({ name: 'dup', sku: `AR-${RUN}-250`, price: 9000 })
      .expect(409);

    // merged check: stored price 9000, new salePrice 9000 -> invalid
    await http.patch(`${API}/variants/${variantId}`).set(auth(adminToken)).send({ salePrice: 9000 }).expect(400);
    const edited = await http
      .patch(`${API}/variants/${variantId}`)
      .set(auth(adminToken))
      .send({ price: 9900, salePrice: 8900 })
      .expect(200);
    expect(edited.body.data).toMatchObject({ price: 9900, salePrice: 8900 });

    const actions = await prisma.auditLog.findMany({ where: { entityId: variantId }, select: { action: true } });
    expect(actions.map((a) => a.action).sort()).toEqual(['VARIANT_CREATED', 'VARIANT_UPDATED']);
  });

  // ───────────────────────── 2.2 + 16.3 views ─────────────────────────

  it('2.2 product page logs one deduplicated view per guest and feeds recently-viewed', async () => {
    const path = `${API}/products/${encodeURIComponent(arabic.slug)}`;
    const res = await http.get(path).set('x-guest-id', guestId).expect(200);
    noCostPrice(res.body);
    expect(res.body.data).toMatchObject({ id: arabic.id, averageRating: null, reviewCount: 0 });
    expect(res.body.data.variants.map((v: { id: string }) => v.id)).toEqual([variantId]);
    expect(res.body.data.images[0].isPrimary).toBe(true);
    expect(res.body.data).not.toHaveProperty('deletedAt');
    expect(Array.isArray(res.body.data.relatedProducts)).toBe(true);

    const views = () => prisma.productView.count({ where: { productId: arabic.id, guestId } });
    expect(await waitFor(views, (n) => n === 1)).toBe(1);

    // second view within 5 minutes is not counted again
    await http.get(path).set('x-guest-id', guestId).expect(200);
    await sleep(300);
    expect(await views()).toBe(1);
    expect(await redis.ttl(`view_dedup:${arabic.id}:${guestId}`)).toBeGreaterThan(200);

    const recent = await http.get(`${API}/products/recently-viewed`).set('x-guest-id', guestId).expect(200);
    expect(recent.body.data.map((p: { id: string }) => p.id)).toEqual([arabic.id]);
    noCostPrice(recent.body);

    const anonymous = await http.get(`${API}/products/recently-viewed`).expect(200);
    expect(anonymous.body.data).toEqual([]);

    await http.get(`${API}/products/no-such-product-${RUN}`).expect(404);
  });

  // ───────────────────────── 16.1 suggest ─────────────────────────

  it('16.1 suggests by prefix in Arabic and English and survives tsquery operators', async () => {
    const suggest = async (q: string) => {
      const res = await http.get(`${API}/search/suggest?q=${encodeURIComponent(q)}`).expect(200);
      noCostPrice(res.body);
      return res.body.data as { id: string; primaryImage: unknown }[];
    };
    const arabicHits = await suggest('قهو');
    expect(arabicHits.map((p) => p.id)).toContain(arabic.id);
    expect(arabicHits.find((p) => p.id === arabic.id)?.primaryImage).toBeTruthy();
    expect((await suggest('yirg')).map((p) => p.id)).toContain(english.id);
    expect((await suggest('coffee & (')).map((p) => p.id)).toContain(arabic.id);
    for (const nasty of ["&&((", "')|!:*\\", '%_%', ' ']) await suggest(nasty);
    expect((await suggest('a')).length).toBeLessThanOrEqual(8);
    await http.get(`${API}/search/suggest?q=${'x'.repeat(101)}`).expect(400);
  });

  // ───────────────────────── 16.4 notify-me ─────────────────────────

  it('16.4 accepts notify-me for out-of-stock items once, rejects in-stock items', async () => {
    const body = { email: `e2e_${RUN}_Buyer@Test.local`, variantId };
    const first = await http.post(`${API}/products/${arabic.id}/notify-me`).send(body).expect(200);
    expect(first.body.data).toEqual({ subscribed: true, alreadySubscribed: false });
    const again = await http.post(`${API}/products/${arabic.id}/notify-me`).send(body).expect(200);
    expect(again.body.data.alreadySubscribed).toBe(true);
    expect(
      await prisma.stockNotification.count({ where: { productId: arabic.id, email: body.email.toLowerCase() } }),
    ).toBe(1);

    await http
      .post(`${API}/products/${english.id}/notify-me`)
      .send({ email: `e2e_${RUN}_x@test.local` })
      .expect(400);
    // variant of another product
    await http
      .post(`${API}/products/${english.id}/notify-me`)
      .send({ email: `e2e_${RUN}_x@test.local`, variantId })
      .expect(404);
  });

  // ───────────────────────── 16.2 recommendations + 13.3 ─────────────────────────

  it('16.2 recommends co-purchased products; 13.3 deactivates ordered variants, deletes others', async () => {
    await prisma.order.create({
      data: {
        orderNumber: `E2E-${RUN}`,
        customerName: 'E2E',
        customerEmail: `e2e_${RUN}_order@test.local`,
        customerPhone: '01000000000',
        shippingAddress: {},
        subtotal: 1,
        shippingCost: 0,
        totalAmount: 1,
        paymentMethod: 'COD',
        status: 'DELIVERED',
        items: {
          create: [
            { productId: arabic.id, variantId, productName: 'a', priceAtPurchase: 1, quantity: 1 },
            { productId: english.id, productName: 'e', priceAtPurchase: 1, quantity: 1 },
          ],
        },
      },
    });
    const rec = await http.get(`${API}/products/${arabic.id}/recommendations`).expect(200);
    expect(rec.body.data[0]).toMatchObject({ id: english.id, reason: 'bought_together' });
    expect(rec.body.data.length).toBeLessThanOrEqual(8);
    noCostPrice(rec.body);

    const ordered = await http.delete(`${API}/variants/${variantId}`).set(auth(adminToken)).expect(200);
    expect(ordered.body.data).toMatchObject({ deleted: false, deactivated: true });
    expect((await prisma.productVariant.findUnique({ where: { id: variantId } }))?.isActive).toBe(false);

    const spare = await http
      .post(`${API}/products/${arabic.id}/variants`)
      .set(auth(adminToken))
      .send({ name: '1kg', sku: `AR-${RUN}-1KG`, price: 30000 })
      .expect(201);
    const removed = await http.delete(`${API}/variants/${spare.body.data.id}`).set(auth(adminToken)).expect(200);
    expect(removed.body.data).toMatchObject({ deleted: true });
    expect(await prisma.productVariant.findUnique({ where: { id: spare.body.data.id } })).toBeNull();
    expect(
      await prisma.auditLog.count({ where: { entityId: { in: [variantId, spare.body.data.id] }, action: { in: ['VARIANT_DEACTIVATED', 'VARIANT_DELETED'] } } }),
    ).toBe(2);
  });

  // ───────────────────────── 2.5 update ─────────────────────────

  it('2.5 updates fields, regenerates the slug, removes images and sets the primary', async () => {
    const [first, second] = arabic.images;
    const res = await http
      .patch(`${API}/products/${arabic.id}`)
      .set(auth(adminToken))
      .field('name', `Arabic Coffee Gold ${RUN}`)
      .field('salePrice', 'null')
      .field('removeImageIds', first.id)
      .field('primaryImageId', second.id)
      .attach('images', PNG, { filename: 'c.png', contentType: 'image/png' })
      .expect(200);

    expect(res.body.data.slug).toBe(`arabic-coffee-gold-${RUN}`);
    expect(res.body.data.salePrice).toBeNull();
    const images: { id: string; isPrimary: boolean }[] = res.body.data.images;
    expect(images).toHaveLength(2);
    expect(images[0]).toMatchObject({ id: second.id, isPrimary: true });
    expect(images.filter((i) => i.isPrimary)).toHaveLength(1);
    arabic = res.body.data;

    // removed file is deleted from storage in the background
    const removedPath = new URL(first.url).pathname;
    await waitFor(
      async () => (await http.get(removedPath)).status,
      (s) => s === 404,
    );
    await http.get(removedPath).expect(404);

    // image from another product -> 400; unknown product -> 404
    await http
      .patch(`${API}/products/${english.id}`)
      .set(auth(adminToken))
      .send({ removeImageIds: [second.id] })
      .expect(400);
    await http
      .patch(`${API}/products/00000000-0000-4000-8000-000000000000`)
      .set(auth(adminToken))
      .send({ name: 'Ghost product' })
      .expect(404);

    const audit = await prisma.auditLog.findFirst({ where: { entityId: arabic.id, action: 'PRODUCT_UPDATED' } });
    expect(audit?.oldValues).toMatchObject({ salePrice: 15000 });
    expect(audit?.newValues).toMatchObject({ salePrice: null, addedImages: 1 });
  });

  // ───────────────────────── 2.6 delete + 2.3 admin list ─────────────────────────

  it('2.6 soft-deletes a product: gone publicly, still in admin/all with includeDeleted', async () => {
    await http.delete(`${API}/products/${english.id}`).set(auth(staffToken)).expect(403);
    await http.delete(`${API}/products/${english.id}`).set(auth(adminToken)).expect(200);

    await http.get(`${API}/products/${english.slug}`).expect(404);
    const list = await http.get(`${API}/products?category=${childCat.id}`).expect(200);
    expect(list.body.data.items).toEqual([]);
    await http.post(`${API}/products/${english.id}/notify-me`).send({ email: `e2e_${RUN}_y@test.local` }).expect(404);

    await http.get(`${API}/products/admin/all`).expect(401);
    const admin = async (query: string) =>
      (await http.get(`${API}/products/admin/all?search=${RUN}&${query}`).set(auth(staffToken)).expect(200)).body
        .data.items as { id: string; deletedAt: string | null; costPrice: number; stockStats: unknown }[];

    expect((await admin('')).map((p) => p.id)).toEqual([arabic.id]);
    const all = await admin('includeDeleted=true');
    const deleted = all.find((p) => p.id === english.id);
    expect(deleted?.deletedAt).toBeTruthy();
    expect(deleted?.costPrice).toBe(20000);
    expect(deleted?.stockStats).toMatchObject({ totalStock: 5, isOutOfStock: false });

    // category with live products cannot be deleted; empty child can
    await http.delete(`${API}/categories/${parentCat.id}`).set(auth(adminToken)).expect(409);
    await http.delete(`${API}/categories/${childCat.id}`).set(auth(adminToken)).expect(200);
    await http.get(`${API}/categories/${encodeURIComponent(childCat.slug)}`).expect(404);

    expect(
      await prisma.auditLog.count({ where: { entityId: { in: [english.id, childCat.id] }, action: { endsWith: '_DELETED' } } }),
    ).toBe(2);
  });
});
