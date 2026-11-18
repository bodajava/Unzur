#!/usr/bin/env node
/**
 * Demo data for trying the dashboard and analytics. NEVER for production.
 *
 *   npm run demo:seed    replaces any earlier demo data with a fresh set
 *   npm run demo:clean   removes every demo row, nothing else
 *
 * Everything it writes is tagged so `clean` can find it:
 *   - people/emails  ...@demo.unzur.test   (customers, guest orders, subscribers, messages)
 *   - products       slug "demo-..."       SKU "DEMO-..."
 *   - coupons/gift   code "DEMO-..."
 *   - visitors       guest id "demo_..."
 * Real products get orders, views and reviews, but their own rows (price,
 * stock) are never changed.
 *
 * Run `demo:clean` before `npm run test:e2e`: a few e2e tests check top-10
 * lists (top customers, insights) and expect the database to hold only their own rows.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DOMAIN = 'demo.unzur.test';
const DAY = 86_400_000;
const NOW = Date.now();
const SPAN_DAYS = 365;

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run with NODE_ENV=production.');
  process.exit(1);
}
const mode = process.argv[2];
if (!['seed', 'clean'].includes(mode)) {
  console.error('Usage: node scripts/demo-data.mjs <seed|clean>');
  process.exit(1);
}

// ───────────── helpers ─────────────

/** Seeded random numbers: every run builds the same store. */
let state = 20261118;
const rand = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (list) => list[Math.floor(rand() * list.length)];
const chance = (p) => rand() < p;
const weighted = (entries) => {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) if ((r -= w) <= 0) return value;
  return entries[entries.length - 1][0];
};
const at = (daysAgo, hour = int(9, 23)) => {
  const d = new Date(NOW - daysAgo * DAY);
  d.setUTCHours(hour - 2, int(0, 59), int(0, 59), 0); // Cairo is UTC+2
  return d.getTime() > NOW ? new Date(NOW - int(5, 120) * 60_000) : d;
};
const plus = (date, hours) => new Date(Math.min(date.getTime() + hours * 3_600_000, NOW));
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (n) => Array.from({ length: n }, () => CODE[int(0, CODE.length - 1)]).join('');
/** Egyptian numbers never start with 0 after +20, so these can't reach anyone (WhatsApp/SMS). */
const fakePhone = (i) => `+2000${String(1_000_000 + i).slice(-7)}`;
const orderNumber = (d) => `ORD-${d.toISOString().slice(0, 10).replace(/-/g, '')}-${code(6)}`;

/** Multi-row INSERT in chunks. */
async function insert(db, table, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const size = Math.max(1, Math.floor(6000 / cols.length));
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const values = [];
    const tuples = chunk.map((row, r) => {
      cols.forEach((c) => values.push(row[c]));
      return `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(',')})`;
    });
    await db.query(`INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(',')}) VALUES ${tuples.join(',')}`, values);
  }
}

/** Drops the API's Redis cache (keys "cache:*") so the dashboard reads the new rows. */
async function flushApiCache() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return console.warn('Redis not configured: skipped cache flush.');
  const call = async (cmd) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    return (await res.json()).result;
  };
  let cursor = '0';
  let removed = 0;
  do {
    const [next, keys] = await call(['SCAN', cursor, 'MATCH', 'cache:*', 'COUNT', '500']);
    if (keys.length) removed += await call(['DEL', ...keys]);
    cursor = String(next);
  } while (cursor !== '0');
  console.log(`API cache cleared (${removed} keys).`);
}

// ───────────── clean ─────────────

async function clean(db) {
  const like = `%@${DOMAIN}`;
  const demoOrders = `SELECT id FROM orders WHERE customer_email LIKE $1`;
  const steps = [
    [`DELETE FROM payments WHERE order_id IN (${demoOrders})`, [like]],
    [`DELETE FROM payments WHERE gift_card_id IN (SELECT id FROM gift_cards WHERE code LIKE 'DEMO-%')`, []],
    [`DELETE FROM orders WHERE customer_email LIKE $1`, [like]],
    [`DELETE FROM product_views WHERE guest_id LIKE 'demo\\_%' OR user_id IN (SELECT id FROM users WHERE email LIKE $1)`, [like]],
    [`DELETE FROM recently_viewed WHERE guest_id LIKE 'demo\\_%'`, []],
    [`DELETE FROM users WHERE email LIKE $1 AND role = 'CUSTOMER'`, [like]],
    [`DELETE FROM products WHERE slug LIKE 'demo-%'`, []],
    [`DELETE FROM coupons WHERE code LIKE 'DEMO-%'`, []],
    [`DELETE FROM gift_cards WHERE code LIKE 'DEMO-%'`, []],
    [`DELETE FROM subscribers WHERE email LIKE $1`, [like]],
    [`DELETE FROM contact_messages WHERE email LIKE $1`, [like]],
    [`DELETE FROM stock_notifications WHERE email LIKE $1`, [like]],
  ];
  let total = 0;
  for (const [sql, params] of steps) total += (await db.query(sql, params)).rowCount ?? 0;
  return total;
}

// ───────────── seed ─────────────

const FIRST = ['Omar', 'Nour', 'Youssef', 'Mariam', 'Ahmed', 'Salma', 'Karim', 'Laila', 'Hassan', 'Farida', 'Mostafa', 'Habiba',
  'Ali', 'Malak', 'Tarek', 'Jana', 'Seif', 'Hana', 'Ziad', 'Rana', 'Amr', 'Dina', 'Khaled', 'Yasmin', 'Adham', 'Nadine', 'Sherif', 'Reem'];
const LAST = ['Mansour', 'El Sayed', 'Hamdy', 'Fawzy', 'Nasser', 'Ezzat', 'Shawky', 'Ragab', 'Kamel', 'Saleh', 'Zaki', 'Lotfy', 'Fahmy', 'Badawi'];
/** The same people in Arabic (how Egyptian customers write their names); Latin is kept for emails. */
const FIRST_AR = ['عمر', 'نور', 'يوسف', 'مريم', 'أحمد', 'سلمى', 'كريم', 'ليلى', 'حسن', 'فريدة', 'مصطفى', 'حبيبة',
  'علي', 'ملك', 'طارق', 'جنى', 'سيف', 'هنا', 'زياد', 'رنا', 'عمرو', 'دينا', 'خالد', 'ياسمين', 'أدهم', 'نادين', 'شريف', 'ريم'];
const LAST_AR = ['منصور', 'السيد', 'حمدي', 'فوزي', 'ناصر', 'عزت', 'شوقي', 'رجب', 'كامل', 'صالح', 'زكي', 'لطفي', 'فهمي', 'بدوي'];
const arName = () => `${pick(FIRST_AR)} ${pick(LAST_AR)}`;
const STREETS = ['شارع الميرغني', 'شارع 9', 'شارع عباس العقاد', 'شارع جامعة الدول', 'شارع النزهة', 'شارع سوريا', 'شارع فؤاد', 'شارع الثورة', 'شارع محمد مظهر'];
const CANCEL = ['العميل غيّر رأيه', 'طلب بالغلط', 'ميعاد التوصيل مش مناسب للعميل', 'لقاها أرخص في مكان تاني'];
const REFUND = ['وصلت وفيها خدش من فوق', 'اللون مختلف عن الصور', 'أكبر من مساحة الأوضة', 'التوصيل اتأخر'];
const NIL_REFUND = 'وصلت وفيها خدش من فوق';
const REVIEW_GOOD = [
  ['أحلى من الصور', 'التشطيب تحفة وغيّرت شكل الركن كله.'],
  ['تستاهل الانتظار', 'أخدت كام يوم بس الشغل باين فيه.'],
  ['قطعة فنية بجد', 'كل اللي بيجي البيت بيسأل عليها.'],
  ['تقيلة وشيك', 'خامة تقيلة ومتغلّفة كويس جدًا.'],
  ['النور اللي بتعمله يجنن', 'نور دافي وهادي وضل حلو على الحيطة.'],
];
const REVIEW_BAD = [
  ['مش زي ما توقعت', 'اللون مختلف عن الصور.'],
  ['وصلت مخدوشة', 'كان فيه خدش فوق. خدمة العملاء بدّلوها بس أخدت أسبوع.'],
];

/** Demo products, one per state the dashboard can show. */
const DEMO_PRODUCTS = [
  { slug: 'demo-mashrabiya-screen', nameAr: 'مشربية', shortAr: 'بارتشن بيتطبّق من خشب الزان المحفور، على طريقة شبابيك القاهرة القديمة.', name: 'Mashrabiya Screen', cat: 'furniture', price: 420000, cost: 210000, stock: 2, featured: true,
    short: 'Folding screen in carved beech, after old Cairo windows.' },
  { slug: 'demo-qamar-pendant', nameAr: 'نجفة قمر', shortAr: 'قمر من المعدن المخرّم بيرمي نجوم على السقف.', name: 'Qamar Pendant', cat: 'lights-up', price: 160000, sale: 132000, cost: 70000, stock: 0,
    short: 'Pierced metal moon that throws stars on the ceiling.',
    variants: [['Brass', 160000, 132000, 8, 'نحاسي'], ['Copper', 168000, null, 0, 'نحاس أحمر'], ['Smoked', 160000, null, 4, 'مدخّن']] },
  { slug: 'demo-sabil-side-table', nameAr: 'ترابيزة سبيل', shortAr: 'سطح ترافرتين مدوّر على قاعدة مضلّعة.', name: 'Sabil Side Table', cat: 'furniture', price: 115000, cost: 52000, stock: 0,
    short: 'Round travertine top on a ribbed base.' },
  { slug: 'demo-hayah-bench', nameAr: 'دكة حياة', shortAr: 'مسودة: دكة طويلة من البلوط بقعدة مجدولة.', name: 'Hayah Bench', cat: 'furniture', price: 275000, cost: 130000, stock: 5, active: false,
    short: 'Draft: long oak bench with a woven seat.' },
  { slug: 'demo-rimal-floor-lamp', nameAr: 'أباجورة رمال', shortAr: 'أباجورة طويلة بشيد كتان على قاعدة مصبوبة في الرمل.', name: 'Rimal Floor Lamp', cat: 'lights-up', price: 310000, cost: 150000, stock: 40,
    short: 'Tall linen shade on a sand-cast base.' },
  { slug: 'demo-nil-console', nameAr: 'كونسول النيل', shortAr: 'كونسول رفيع بواجهة متقطّعة زي الموج.', name: 'Nil Console', cat: 'furniture', price: 198000, cost: 95000, stock: 12,
    short: 'Slim console with a wave-cut front.' },
];

/** How often each product sells (by slug); the rest of the store's products sell rarely. */
const SALES_WEIGHT = {
  shamaa: 14, 'real-folder': 12, 'noor-column': 10, 'oud-kapteet': 9, elbordaya: 9, 'fanoos-dome': 7, 'el-blockaya': 4,
  'demo-mashrabiya-screen': 5, 'demo-qamar-pendant': 6, 'demo-sabil-side-table': 3, 'demo-rimal-floor-lamp': 0.6, 'demo-nil-console': 5,
};
/** Daily product-page views at the start of the period (grows with the store). */
const VIEW_BASE = { 'demo-rimal-floor-lamp': 24, 'demo-hayah-bench': 0 };

async function seed(db) {
  const removed = await clean(db);
  if (removed) console.log(`Removed ${removed} rows of earlier demo data.`);

  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const categories = Object.fromEntries((await q(`SELECT slug, id FROM categories WHERE deleted_at IS NULL`)).map((r) => [r.slug, r.id]));
  const [brand] = await q(`SELECT id FROM brands WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`);
  const zones = await q(`SELECT id, governorate, fee FROM shipping_zones WHERE is_active ORDER BY fee`);
  if (!categories.furniture || !categories['lights-up'] || !zones.length) {
    throw new Error('Run `npm run seed` first: the demo needs the catalog and shipping zones.');
  }

  // ── products ──
  const productRows = [];
  const variantRows = [];
  DEMO_PRODUCTS.forEach((p, i) => {
    const id = randomUUID();
    const created = at(SPAN_DAYS - 10 - i * 12);
    p.id = id;
    productRows.push({
      id, name: p.name, slug: p.slug, sku: `DEMO-${String(i + 1).padStart(3, '0')}`,
      description: `${p.short} Made in small batches in our Cairo workshop.`, short_description: p.short,
      name_ar: p.nameAr, short_description_ar: p.shortAr, description_ar: `${p.shortAr} معمولة بكميات صغيرة في ورشتنا في القاهرة.`,
      base_price: p.price, sale_price: p.sale ?? null, cost_price: p.cost, stock: p.stock, low_stock_threshold: 5,
      is_active: p.active ?? true, is_featured: p.featured ?? false, category_id: categories[p.cat], brand_id: brand?.id ?? null,
      created_at: created, updated_at: created,
    });
    (p.variants ?? []).forEach(([name, price, sale, stock, nameAr], v) => {
      variantRows.push({
        id: randomUUID(), product_id: id, name, name_ar: nameAr, sku: `DEMO-${String(i + 1).padStart(3, '0')}-${v + 1}`, price, sale_price: sale,
        stock, attributes: JSON.stringify({ finish: name }), is_active: true, created_at: created, updated_at: created,
      });
    });
  });
  await insert(db, 'products', productRows);
  await insert(db, 'product_variants', variantRows);

  // What can be bought: real products + active demo ones, with their versions.
  const catalog = await q(`
    SELECT p.id, p.slug, p.name, p.name_ar, p.is_active, COALESCE(p.sale_price, p.base_price) AS price, p.created_at,
           COALESCE(json_agg(json_build_object('id', v.id, 'name', v.name, 'nameAr', v.name_ar, 'price', COALESCE(v.sale_price, v.price)))
                    FILTER (WHERE v.id IS NOT NULL), '[]') AS variants
    FROM products p LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active
    WHERE p.deleted_at IS NULL GROUP BY p.id`);
  const sellable = catalog.filter((p) => p.is_active);
  // Real products were added recently; pretend they've always been on sale. Demo ones start on their own date.
  const onSale = (p, date) => !p.slug.startsWith('demo-') || p.created_at <= date;

  // ── customers ──
  const passwordHash = await bcrypt.hash(randomUUID(), 10); // nobody knows it: demo people can't sign in
  const customers = [];
  const addressRows = [];
  for (let i = 0; i < 140; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    const firstAr = FIRST_AR[i % FIRST_AR.length];
    const lastAr = LAST_AR[(i * 7) % LAST_AR.length];
    const created = at(int(1, SPAN_DAYS + 40));
    const zone = weighted(zones.map((z, idx) => [z, idx < 3 ? 10 : idx < 6 ? 3 : 1]));
    const user = {
      id: randomUUID(), email: `${first}.${last.replace(/ /g, '')}${i}@${DOMAIN}`.toLowerCase(),
      phone: fakePhone(i), password_hash: passwordHash,
      first_name: firstAr, last_name: lastAr, role: 'CUSTOMER', is_email_verified: chance(0.85), is_active: i % 23 !== 7,
      loyalty_points: 0, referral_code: `DEMO${code(6)}`, created_at: created, updated_at: created,
    };
    customers.push({ ...user, zone });
    addressRows.push({
      id: randomUUID(), user_id: user.id, label: 'البيت', full_name: `${firstAr} ${lastAr}`, phone: user.phone,
      governorate: zone.governorate, city: zone.governorate, street: `${int(2, 90)} ${pick(STREETS)}`,
      building: String(int(1, 40)), floor: String(int(1, 12)), apartment: String(int(1, 30)), notes: null,
      is_default: true, created_at: created, updated_at: created,
    });
  }
  await insert(db, 'users', customers.map(({ zone, ...u }) => u));
  await insert(db, 'addresses', addressRows);

  // ── coupons & gift cards ──
  const coupons = [
    { code: 'DEMO-WELCOME10', description: 'خصم 10% على أول طلب', type: 'PERCENTAGE', value: 10, min: 0, max: 50000, limit: null, starts: -150, ends: 60, active: true },
    { code: 'DEMO-VIP15', description: '15% للعملاء الراجعين', type: 'PERCENTAGE', value: 15, min: 150000, max: 80000, limit: 40, starts: -60, ends: 30, active: true },
    { code: 'DEMO-RAMADAN', description: 'خصم 200 جنيه، حملة رمضان', type: 'FIXED_AMOUNT', value: 20000, min: 100000, max: null, limit: null, starts: -170, ends: -120, active: true },
    { code: 'DEMO-SPRING', description: 'إطلاق الربيع (مجدول)', type: 'PERCENTAGE', value: 20, min: 0, max: 60000, limit: 100, starts: 20, ends: 50, active: true },
    { code: 'DEMO-PAUSED', description: 'متوقف من الإدارة', type: 'FIXED_AMOUNT', value: 15000, min: 0, max: null, limit: null, starts: -40, ends: 40, active: false },
  ].map((c) => ({ ...c, id: randomUUID(), used: 0 }));
  const giftCards = [
    { code: 'DEMO-GIFT-7KQ2', initial: 200000, current: 200000, expires: 300, active: true },
    { code: 'DEMO-GIFT-M4XA', initial: 150000, current: 0, expires: 200, active: true },
    { code: 'DEMO-GIFT-P9RT', initial: 100000, current: 0, expires: 120, active: true },
    { code: 'DEMO-GIFT-OLD1', initial: 50000, current: 50000, expires: -10, active: true },
    { code: 'DEMO-GIFT-OFF2', initial: 80000, current: 80000, expires: 90, active: false },
  ].map((g) => ({ ...g, id: randomUUID(), buyer: pick(customers) }));
  await insert(db, 'gift_cards', giftCards.map((g) => ({
    id: g.id, code: g.code, initial_balance: g.initial, current_balance: g.current, purchased_by_id: g.buyer.id,
    recipient_email: `friend.${g.code.slice(-4).toLowerCase()}@${DOMAIN}`, message: 'مبروك البيت الجديد!',
    expires_at: new Date(NOW + g.expires * DAY), is_active: g.active, created_at: at(int(40, 150)), updated_at: new Date(NOW),
  })));
  const spendable = giftCards.filter((g) => g.current === 0); // the used ones get spent on orders below

  // ── orders ──
  const orders = [];
  const items = [];
  const history = [];
  const payments = [];
  const usages = [];
  const loyalty = [];
  const reviews = [];
  const reviewed = new Set();
  const sold = new Map(); // product id -> units, for views
  const guestPool = Array.from({ length: 80 }, (_, i) => ({
    name: arName(), email: `guest${i}@${DOMAIN}`, phone: fakePhone(500 + i),
    guestId: `demo_buyer_${i}`, zone: weighted(zones.map((z, idx) => [z, idx < 3 ? 10 : 1])),
  }));

  for (let age = SPAN_DAYS; age >= 0; age--) {
    const growth = 0.7 + ((SPAN_DAYS - age) / SPAN_DAYS) ** 1.4 * 4.3; // under 1 order a day a year ago -> ~5 now
    const weekend = [4, 5].includes(new Date(NOW - age * DAY).getUTCDay()) ? 1.35 : 1; // Thu/Fri
    let count = Math.max(0, Math.round(growth * weekend * (0.55 + rand() * 0.9)));
    if (age === 0) count = Math.min(count, 3);
    for (let n = 0; n < count; n++) {
      let created = at(age);
      const asUser = chance(0.7);
      const buyer = asUser ? pick(customers.filter((c) => c.created_at <= created) || customers) : pick(guestPool);
      if (!buyer) continue;

      // Lines
      const lineCount = weighted([[1, 70], [2, 25], [3, 5]]);
      const lines = [];
      for (let l = 0; l < lineCount; l++) {
        const product = weighted(sellable.filter((p) => onSale(p, created)).map((p) => {
          let w = SALES_WEIGHT[p.slug] ?? 2;
          if (p.slug === 'elbordaya' && age <= 30) w = 16; // sells fast lately: stock-out warning
          if (p.slug === 'demo-mashrabiya-screen' && age <= 30) w = 9;
          return [p, w];
        }));
        if (!product || lines.some((x) => x.product.id === product.id)) continue;
        const variant = product.variants.length ? pick(product.variants) : null;
        const price = variant ? variant.price : product.price;
        lines.push({ product, variant, price, quantity: price < 100000 && chance(0.18) ? 2 : 1 });
      }
      if (!lines.length) continue;
      let subtotal = lines.reduce((s, x) => s + x.price * x.quantity, 0);

      // Status by age
      const hasNil = lines.some((x) => x.product.slug === 'demo-nil-console');
      const method = weighted([['COD', 50], ['PAYMOB_CARD', 35], ['PAYMOB_WALLET', 15]]);
      let status;
      if (hasNil && age > 5 && chance(0.5)) status = 'REFUNDED';
      else if (age > 14) status = weighted([['DELIVERED', 82], ['CANCELLED', 10], ['REFUNDED', 8]]);
      else if (age > 4) status = weighted([['DELIVERED', 45], ['SHIPPED', 30], ['PREPARING', 10], ['CANCELLED', 9], ['REFUNDED', 6]]);
      else status = weighted([['CONFIRMED', 40], ['PREPARING', 22], ['SHIPPED', 10], ['PENDING_PAYMENT', method === 'COD' ? 0 : 35], ['CANCELLED', 10]]);
      // The API's payment-timeout job cancels unpaid orders and puts their stock back.
      // Keep those orders to demo products so real stock never moves.
      if (status === 'PENDING_PAYMENT') {
        // Placed minutes ago: the API cancels unpaid orders after 30 minutes (store setting).
        created = new Date(NOW - int(2, 12) * 60_000);
        const demo = sellable.filter((p) => p.slug.startsWith('demo-') && onSale(p, created));
        lines.splice(0, lines.length, ...[pick(demo)].map((product) => {
          const variant = product.variants.length ? pick(product.variants) : null;
          return { product, variant, price: variant ? variant.price : product.price, quantity: 1 };
        }));
        subtotal = lines[0].price;
      }
      const timedOut = status === 'CANCELLED' && method !== 'COD' && chance(0.5);
      const paymentStatus =
        status === 'PENDING_PAYMENT' ? 'PENDING'
        : status === 'REFUNDED' ? 'REFUNDED'
        : status === 'CANCELLED' ? (timedOut ? 'FAILED' : method === 'COD' ? 'UNPAID' : 'REFUNDED')
        : method !== 'COD' || status === 'DELIVERED' ? 'PAID' : 'UNPAID';
      const reason =
        status === 'REFUNDED' ? (hasNil ? NIL_REFUND : pick(REFUND))
        : status === 'CANCELLED' ? (timedOut ? 'PAYMENT_TIMEOUT' : pick(CANCEL)) : null;

      // Discounts
      let couponCode = null;
      let discount = 0;
      const live = coupons.filter((c) => c.active && c.starts * DAY + NOW <= created.getTime() && c.ends * DAY + NOW > created.getTime()
        && subtotal >= c.min && (c.limit === null || c.used < c.limit));
      if (live.length && chance(0.2)) {
        const c = pick(live);
        discount = c.type === 'PERCENTAGE' ? Math.round((subtotal * c.value) / 100) : c.value;
        if (c.max) discount = Math.min(discount, c.max);
        couponCode = c.code;
        c.used++;
      }
      const shipping = buyer.zone.fee;
      let giftCard = null;
      let giftAmount = 0;
      if (spendable.length && age < 100 && status === 'DELIVERED' && chance(0.08)) {
        giftCard = spendable.shift();
        giftAmount = Math.min(giftCard.initial, subtotal + shipping - discount);
        giftCard.spent = giftAmount;
      }
      const total = subtotal + shipping - discount - giftAmount;

      const id = randomUUID();
      const name = asUser ? `${buyer.first_name} ${buyer.last_name}` : buyer.name;
      const address = { fullName: name, phone: buyer.phone, governorate: buyer.zone.governorate, city: buyer.zone.governorate,
        street: `${int(2, 90)} ${pick(STREETS)}`, building: String(int(1, 40)), floor: String(int(1, 12)), apartment: String(int(1, 30)) };

      // Timeline
      const path = { PENDING_PAYMENT: ['PENDING_PAYMENT'], CONFIRMED: ['CONFIRMED'], PREPARING: ['CONFIRMED', 'PREPARING'],
        SHIPPED: ['CONFIRMED', 'PREPARING', 'SHIPPED'], DELIVERED: ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'],
        REFUNDED: ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'REFUNDED'],
        CANCELLED: timedOut ? ['PENDING_PAYMENT', 'CANCELLED'] : ['CONFIRMED', 'CANCELLED'] }[status];
      const start = method !== 'COD' && !timedOut && status !== 'PENDING_PAYMENT' ? ['PENDING_PAYMENT', ...path] : path;
      const gaps = { CONFIRMED: 0.2, PREPARING: 18, SHIPPED: 30, DELIVERED: 40, REFUNDED: 70, CANCELLED: timedOut ? 0.5 : 6 };
      let when = created;
      let from = null;
      let updated = created;
      for (const to of start) {
        when = from === null ? created : plus(when, (gaps[to] ?? 1) * (0.6 + rand() * 0.8));
        history.push({ id: randomUUID(), order_id: id, from_status: from, to_status: to,
          note: to === status && reason ? (reason === 'PAYMENT_TIMEOUT' ? 'Payment not completed in time' : reason) : null,
          changed_by_id: null, created_at: when });
        from = to;
        updated = when;
      }

      orders.push({
        id, order_number: orderNumber(created), user_id: asUser ? buyer.id : null, guest_id: asUser ? null : buyer.guestId,
        customer_name: name, customer_email: buyer.email, customer_phone: buyer.phone, shipping_address: JSON.stringify(address),
        shipping_zone_id: buyer.zone.id, subtotal, shipping_cost: shipping, discount_amount: discount, gift_card_amount: giftAmount,
        gift_card_id: giftCard?.id ?? null, loyalty_discount: 0, total_amount: total, payment_method: method, payment_status: paymentStatus,
        status, coupon_code: couponCode, notes: chance(0.12) ? pick(['كلّمني قبل ما توصل', 'سيبها مع البواب', 'هدية: من غير فاتورة جوه']) : null,
        cancel_or_refund_reason: reason, created_at: created, updated_at: updated,
      });
      for (const x of lines) {
        items.push({ id: randomUUID(), order_id: id, product_id: x.product.id, variant_id: x.variant?.id ?? null,
          product_name: x.product.name, variant_name: x.variant?.name ?? null,
          product_name_ar: x.product.name_ar ?? null, variant_name_ar: x.variant?.nameAr ?? null, price_at_purchase: x.price, image_url: null,
          quantity: x.quantity, created_at: created, updated_at: created });
        sold.set(x.product.id, (sold.get(x.product.id) ?? 0) + x.quantity);
      }
      if (method !== 'COD') {
        payments.push({ id: randomUUID(), order_id: id, provider: 'PAYMOB', paymob_order_id: `demo-${code(10)}`,
          paymob_transaction_id: paymentStatus === 'PENDING' || paymentStatus === 'FAILED' ? null : `demo-tx-${code(10)}`,
          amount_piasters: total, refunded_piasters: paymentStatus === 'REFUNDED' ? total : 0, currency: 'EGP', status: paymentStatus,
          created_at: created, updated_at: updated });
      }
      if (couponCode) {
        const c = coupons.find((x) => x.code === couponCode);
        usages.push({ id: randomUUID(), coupon_id: c.id, order_id: id, user_id: asUser ? buyer.id : null, guest_id: asUser ? null : buyer.guestId,
          customer_email: buyer.email, discount_applied: discount, created_at: created });
      }
      if (asUser && status === 'DELIVERED') {
        const points = Math.floor(total / 1000); // 1 point per 10 EGP
        buyer.loyalty_points += points;
        loyalty.push({ id: randomUUID(), user_id: buyer.id, order_id: id, points, type: 'EARNED_PURCHASE',
          description: 'نقاط طلب اتسلم', created_at: updated });
        const first = lines[0];
        const key = `${buyer.id}:${first.product.id}`;
        if (!reviewed.has(key) && chance(0.45)) {
          reviewed.add(key);
          const bad = first.product.slug === 'demo-nil-console' ? chance(0.6) : chance(0.08);
          const [title, comment] = bad ? pick(REVIEW_BAD) : pick(REVIEW_GOOD);
          const reviewedAt = plus(updated, int(24, 240));
          reviews.push({ id: randomUUID(), product_id: first.product.id, user_id: buyer.id, order_id: id,
            rating: bad ? int(1, 2) : weighted([[5, 65], [4, 30], [3, 5]]), title, comment,
            is_approved: age > 10 ? chance(0.9) : chance(0.3), created_at: reviewedAt, updated_at: reviewedAt });
        }
      }
    }
  }

  await insert(db, 'orders', orders);
  await insert(db, 'order_items', items);
  await insert(db, 'order_status_history', history);
  await insert(db, 'payments', payments);
  await insert(db, 'coupons', coupons.map((c) => ({
    id: c.id, code: c.code, description: c.description, discount_type: c.type, discount_value: c.value, min_order_amount: c.min,
    max_discount_amount: c.max, usage_limit: c.limit, per_user_limit: 1, used_count: c.used,
    starts_at: new Date(NOW + c.starts * DAY), expires_at: new Date(NOW + c.ends * DAY), is_active: c.active,
    created_at: new Date(NOW + (c.starts - 5) * DAY), updated_at: new Date(NOW),
  })));
  await insert(db, 'coupon_usages', usages);
  await insert(db, 'loyalty_transactions', loyalty);
  for (const g of giftCards.filter((x) => x.current === 0)) {
    await db.query('UPDATE gift_cards SET current_balance = $1 WHERE id = $2', [g.initial - (g.spent ?? 0), g.id]);
  }
  await insert(db, 'reviews', reviews);
  for (const c of customers.filter((x) => x.loyalty_points)) {
    await db.query('UPDATE users SET loyalty_points = $1 WHERE id = $2', [c.loyalty_points, c.id]);
  }

  // ── views: every product page, growing over time; a few odd ones on purpose ──
  const views = [];
  for (const p of catalog) {
    if (!p.is_active) continue;
    const units = sold.get(p.id) ?? 0;
    const base = VIEW_BASE[p.slug] ?? Math.max(2, (units / SPAN_DAYS) * int(14, 22));
    for (let age = SPAN_DAYS; age >= 0; age--) {
      if (!onSale(p, new Date(NOW - age * DAY))) continue;
      const growth = 0.7 + ((SPAN_DAYS - age) / SPAN_DAYS) * 1.2;
      const count = Math.round(base * growth * (0.5 + rand()));
      for (let v = 0; v < count; v++) {
        const asUser = chance(0.25);
        const viewer = asUser ? pick(customers) : null;
        views.push({ id: randomUUID(), product_id: p.id, user_id: viewer?.id ?? null,
          guest_id: asUser ? null : `demo_v_${int(1, 2500)}`, source: pick(['home', 'shop', 'search', 'category', 'related']),
          created_at: at(age, int(0, 23)) });
      }
    }
  }
  await insert(db, 'product_views', views);

  // ── abandoned carts: signed-in customers who left pieces behind (1 h – 3 days ago) ──
  const cartRows = [];
  const cartItemRows = [];
  const usedCarts = new Set();
  for (let i = 0; i < 12; i++) {
    const c = pick(customers);
    if (usedCarts.has(c.id)) continue;
    usedCarts.add(c.id);
    const id = randomUUID();
    const left = new Date(NOW - int(1, 72) * 3_600_000);
    cartRows.push({ id, user_id: c.id, guest_id: null, coupon_code: null, created_at: left, updated_at: left });
    const picked = new Set();
    for (let n = 0; n < int(1, 3); n++) {
      const p = pick(sellable);
      if (picked.has(p.id)) continue;
      picked.add(p.id);
      const v = p.variants.length ? pick(p.variants) : null;
      cartItemRows.push({ id: randomUUID(), cart_id: id, product_id: p.id, variant_id: v?.id ?? null, quantity: 1, created_at: left, updated_at: left });
    }
  }
  await insert(db, 'carts', cartRows);
  await insert(db, 'cart_items', cartItemRows);

  // ── wishlists, back-in-stock requests, newsletter, contact form ──
  const wish = new Set();
  const wishRows = [];
  for (let i = 0; i < 90; i++) {
    const c = pick(customers);
    const p = pick(sellable);
    if (wish.has(c.id + p.id)) continue;
    wish.add(c.id + p.id);
    wishRows.push({ id: randomUUID(), user_id: c.id, product_id: p.id, created_at: at(int(0, 90)) });
  }
  await insert(db, 'wishlist_items', wishRows);

  const sabil = productRows.find((p) => p.slug === 'demo-sabil-side-table');
  const qamar = productRows.find((p) => p.slug === 'demo-qamar-pendant');
  const copper = variantRows.find((v) => v.product_id === qamar.id && v.name === 'Copper');
  const fanoos = catalog.find((p) => p.slug === 'fanoos-dome');
  await insert(db, 'stock_notifications', [
    ...Array.from({ length: 7 }, (_, i) => ({ product_id: sabil.id, variant_id: null, i })),
    ...Array.from({ length: 4 }, (_, i) => ({ product_id: qamar.id, variant_id: copper.id, i: i + 10 })),
    ...(fanoos ? Array.from({ length: 3 }, (_, i) => ({ product_id: fanoos.id, variant_id: null, i: i + 20 })) : []),
  ].map((r) => ({ id: randomUUID(), product_id: r.product_id, variant_id: r.variant_id, email: `waiting${r.i}@${DOMAIN}`,
    notified_at: null, created_at: at(int(0, 30)) })));

  await insert(db, 'subscribers', Array.from({ length: 48 }, (_, i) => ({
    id: randomUUID(), email: `reader${i}@${DOMAIN}`, is_active: i % 9 !== 4, created_at: at(int(0, SPAN_DAYS)),
  })));

  const messages = [
    ['مقاس مخصوص للمشربية', 'ينفع تعملوها 4 ضلف بدل 3؟ عشان لوبي فندق.', false, null],
    ['جملة لكافيه', 'هنفتح كافيه في الزمالك وعايزين 12 أباجورة شمعة.', false, null],
    ['توصيل لأسوان', 'بتوصلوا أسوان؟ وبياخد قد إيه؟', true, 2],
    ['الطلب وصل مخدوش', 'كونسول النيل وصلني وفيه خدش من فوق. نعمل إيه؟', true, 1],
    ['زيارة المعرض', 'فيه معرض أقدر أشوف فيه القطع على الطبيعة؟', true, null],
    ['سؤال عن كارت الهدية', 'ينفع أستخدم كارت الهدية مع كوبون؟', false, null],
    ['تعاون', 'أنا مهندسة ديكور ونفسي أستخدم شغلكم في مشروع.', true, 5],
    ['تغيير اللمبة', 'عمود النور بياخد لمبة نوعها إيه؟', false, null],
  ];
  await insert(db, 'contact_messages', messages.map(([subject, message, read, replied], i) => {
    const created = at(int(0, 40));
    return { id: randomUUID(), name: arName(), email: `visitor${i}@${DOMAIN}`, phone: fakePhone(900 + i),
      subject, message, is_read: read, replied_at: replied ? plus(created, replied * 3) : null, created_at: created };
  }));

  return { products: productRows.length, customers: customers.length, orders: orders.length, items: items.length,
    reviews: reviews.length, views: views.length, abandonedCarts: cartRows.length, coupons: coupons.length, giftCards: giftCards.length };
}

// ───────────── run ─────────────

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN');
  if (mode === 'clean') console.log(`Removed ${await clean(db)} demo rows.`);
  else console.log('Demo data created:', await seed(db));
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  console.error('Nothing was changed:', error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
if (!process.exitCode) await flushApiCache();
