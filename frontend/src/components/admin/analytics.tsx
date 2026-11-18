"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { intlLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate, formatPrice, localized, plural } from "@/i18n/format";
import {
  useBreakdown,
  useCustomerAnalytics,
  useOverview,
  useProductPerformance,
  useSalesTrend,
  useZones,
} from "@/lib/admin/api";
import type { BreakdownRow, Granularity, PerformanceSort } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import { useCategories } from "@/lib/api/hooks";
import type { OrderStatus, PaymentMethod } from "@/lib/api/types";
import { BarList } from "./bar-list";
import { granularityFor, RangePicker, rangeOf, type RangeDays } from "./range";
import { TrendChart } from "./trend-chart";
import { PageTitle, Panel, Skeleton } from "./ui";

const RANGES = [7, 30, 90, 365] as const satisfies readonly RangeDays[];
const LIFECYCLE: OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
/** Egypt's week starts on Saturday. 0 = Sunday, as the API sends it. */
const WEEK = [6, 0, 1, 2, 3, 4, 5];
const SORTS: PerformanceSort[] = ["revenue", "unitsSold", "conversionRate", "views", "refunds"];

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

export function AnalyticsView() {
  const { lang, t } = useI18n();
  const ta = t.admin.analytics;
  const [days, setDays] = useState<RangeDays>(30);
  const range = useMemo(() => rangeOf(days), [days]);
  const [pickedGranularity, setGranularity] = useState<Granularity | null>(null);
  const granularity = pickedGranularity ?? granularityFor(days);
  const [sortBy, setSortBy] = useState<PerformanceSort>("revenue");

  const trend = useSalesTrend(range, granularity);
  const breakdown = useBreakdown(range);
  const overview = useOverview(range);
  const customers = useCustomerAnalytics(range);
  const performance = useProductPerformance(range, sortBy, "desc");
  const zones = useZones();
  const categoryList = useCategories();
  const b = breakdown.data;
  const error = [trend, breakdown, overview, customers, performance].find((q) => q.isError)?.error;

  const sales = b ? b.byPaymentMethod.reduce((s, r) => s + r.revenue, 0) : 0;
  const governorateName = (key: string) =>
    lang === "ar" ? (zones.data?.find((z) => z.governorate === key)?.nameAr ?? key) : key;
  const ordersText = (n: number) => plural(lang, t.admin.orders.count, n);
  // The breakdown names categories in English; show the Arabic name on Arabic pages.
  const categoryName = (key: string) => {
    const all = (categoryList.data ?? []).flatMap((c) => [c, ...c.children]);
    const found = all.find((c) => c.name === key);
    return found ? localized(lang, found.name, found.nameAr) : key;
  };
  const salesRows = (rows: BreakdownRow[], label: (key: string) => string, units = false) =>
    rows.map((r) => ({
      key: r.key,
      label: label(r.key),
      value: r.revenue,
      valueText: formatPrice(r.revenue, lang),
      sub: [units ? fmt(ta.units, { count: r.units }) : ordersText(r.orders), fmt(ta.share, { pct: pct(r.revenue, sales) })].join(" · "),
    }));

  return (
    <div>
      <PageTitle aside={<RangePicker value={days} onChange={(d) => { setDays(d); setGranularity(null); }} options={RANGES} />}>
        {ta.title}
      </PageTitle>

      {error && <p className="mb-6 text-sm text-[#d1342f]">{errorMessage(error, t)}</p>}

      <Panel
        title={ta.trend}
        action={<GranularityPicker value={granularity} onChange={setGranularity} days={days} />}
      >
        {trend.data ? (
          trend.data.some((p) => p.revenue > 0) ? (
            <TrendChart points={trend.data} lang={lang} label={ta.trend} granularity={granularity} />
          ) : (
            <p className="py-16 text-center text-sm text-muted">{ta.empty}</p>
          )
        ) : (
          <Skeleton className="h-56" />
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={ta.status}>
          {b ? (
            <>
              <p className="-mt-2 mb-4 text-xs text-muted">{ta.statusNote}</p>
              <BarList
                caption={ta.status}
                rows={LIFECYCLE.map((s) => b.byStatus.find((r) => r.key === s) ?? { key: s, orders: 0, units: 0, revenue: 0 })
                  .filter((r) => r.orders > 0)
                  .map((r) => {
                    const all = b.byStatus.reduce((s, x) => s + x.orders, 0);
                    return {
                      key: r.key,
                      label: t.orderStatus[r.key as OrderStatus],
                      value: r.orders,
                      valueText: String(r.orders),
                      sub: `${pct(r.orders, all)}% · ${formatPrice(r.revenue, lang)}`,
                    };
                  })}
              />
            </>
          ) : (
            <Skeleton className="h-64" />
          )}
        </Panel>

        <Panel title={ta.payment}>
          {b ? (
            b.byPaymentMethod.length ? (
              <BarList caption={ta.payment} rows={salesRows(b.byPaymentMethod, (k) => t.paymentMethod[k as PaymentMethod] ?? k)} />
            ) : (
              <Empty text={ta.empty} />
            )
          ) : (
            <Skeleton className="h-40" />
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title={ta.category}>
          {b ? (
            b.byCategory.length ? (
              <BarList caption={ta.category} rows={salesRows(b.byCategory, categoryName, true)} />
            ) : (
              <Empty text={ta.empty} />
            )
          ) : (
            <Skeleton className="h-40" />
          )}
        </Panel>

        <Panel title={ta.governorate}>
          {b ? (
            b.byGovernorate.length ? (
              <BarList caption={ta.governorate} rows={salesRows(b.byGovernorate.slice(0, 8), governorateName)} />
            ) : (
              <Empty text={ta.empty} />
            )
          ) : (
            <Skeleton className="h-64" />
          )}
        </Panel>

        <Panel title={ta.weekday}>
          {b ? <WeekdayBars rows={b.byWeekday} /> : <Skeleton className="h-56" />}
        </Panel>
      </div>

      <h2 className="eyebrow mt-12 mb-4 text-muted">{ta.customers}</h2>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          {customers.data && overview.data ? (
            <div className="space-y-6">
              <Stat label={ta.repeatRate} value={`${(customers.data.repeatPurchaseRate * 100).toFixed(1)}%`} note={ta.repeatNote} />
              <Stat
                label={ta.guestShare}
                value={`${pct(overview.data.guestOrdersCount, overview.data.totalOrders)}%`}
                note={`${overview.data.guestOrdersCount} / ${ordersText(overview.data.totalOrders)}`}
              />
              <SplitBar
                label={ta.newVsReturning}
                parts={[
                  { label: ta.newCustomers, value: customers.data.newVsReturning.newCount, className: "bg-blue" },
                  { label: ta.returning, value: customers.data.newVsReturning.returningCount, className: "bg-ink/35" },
                ]}
              />
            </div>
          ) : (
            <Skeleton className="h-64" />
          )}
        </Panel>

        <Panel title={ta.topCustomers} className="lg:col-span-2">
          {customers.data ? (
            customers.data.topCustomers.length ? (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-start text-xs text-muted">
                      <th className="px-2 pb-2 text-start font-normal">{t.admin.orders.col.customer}</th>
                      <th className="px-2 pb-2 text-end font-normal">{t.admin.overview.orders}</th>
                      <th className="px-2 pb-2 text-end font-normal">{ta.spent}</th>
                      <th className="px-2 pb-2 text-end font-normal">{ta.lastOrder}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/8">
                    {customers.data.topCustomers.map((c) => (
                      <tr key={c.identifier}>
                        <td className="px-2 py-2.5">
                          <span lang="en" dir="auto" className="block font-semibold rtl:text-right">{c.name}</span>
                          <span className="text-xs text-muted">
                            <span lang="en" dir="ltr">{c.email}</span> · {c.isRegistered ? ta.registered : ta.guest}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-end tabular-nums">{c.ordersCount}</td>
                        <td className="px-2 py-2.5 text-end font-semibold tabular-nums">{formatPrice(c.totalSpent, lang)}</td>
                        <td className="px-2 py-2.5 text-end text-xs text-muted tabular-nums">{formatDate(c.lastOrderAt, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text={ta.empty} />
            )
          ) : (
            <Skeleton className="h-64" />
          )}
        </Panel>
      </div>

      <Panel
        title={ta.products}
        className="mt-6"
        action={
          <label className="flex items-center gap-2 text-xs text-muted">
            {ta.sortBy}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as PerformanceSort)}
              className="rounded-full border border-ink/20 bg-transparent px-3 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {ta.sort[s]}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <ProductTable sortBy={sortBy} rows={performance.data} loading={!performance.data} />
      </Panel>
    </div>
  );
}

function ProductTable({ rows, loading, sortBy }: { rows?: ReturnType<typeof useProductPerformance>["data"]; loading: boolean; sortBy: PerformanceSort }) {
  const { lang, t, href } = useI18n();
  const ta = t.admin.analytics;
  if (loading || !rows) return <Skeleton className="h-72" />;
  if (!rows.length) return <Empty text={ta.productsEmpty} />;
  const head = (label: string, sort?: PerformanceSort) => (
    <th scope="col" aria-sort={sort === sortBy ? "descending" : undefined} className={`px-2 pb-2 text-end font-normal ${sort === sortBy ? "text-ink" : ""}`}>
      {label}
    </th>
  );
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th scope="col" className="px-2 pb-2 text-start font-normal">{ta.col.piece}</th>
            {head(ta.col.views, "views")}
            {head(ta.col.sold, "unitsSold")}
            {head(ta.col.conversion, "conversionRate")}
            {head(ta.col.revenue, "revenue")}
            {head(ta.col.profit)}
            {head(ta.col.rating)}
            {head(ta.col.returns, "refunds")}
            {head(ta.col.stock)}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/8">
          {rows.map((p) => {
            const low = p.stock <= p.lowStockThreshold;
            return (
              <tr key={p.productId}>
                <td className="px-2 py-2.5">
                  <Link href={href(`/admin/products/${p.productId}`)} className="font-semibold hover:underline">
                    {localized(lang, p.name, p.nameAr)}
                  </Link>
                  {!p.isActive && <span className="ms-2 rounded-full bg-ink/8 px-2 py-0.5 text-[0.65rem] text-muted">{ta.draft}</span>}
                </td>
                <td className="px-2 py-2.5 text-end tabular-nums">{p.viewsCount.toLocaleString(intlLocale[lang])}</td>
                <td className="px-2 py-2.5 text-end tabular-nums">{p.unitsSold}</td>
                <td className="px-2 py-2.5 text-end tabular-nums">{(p.conversionRate * 100).toFixed(1)}%</td>
                <td className="px-2 py-2.5 text-end font-semibold tabular-nums">{formatPrice(p.revenue, lang)}</td>
                <td className="px-2 py-2.5 text-end tabular-nums">{p.costPrice === null ? "—" : formatPrice(p.estimatedProfit, lang)}</td>
                <td className="px-2 py-2.5 text-end tabular-nums">
                  {p.averageRating === null ? ta.noRating : `★ ${p.averageRating.toFixed(1)} (${p.reviewCount})`}
                </td>
                <td className={`px-2 py-2.5 text-end tabular-nums ${p.refundCount + p.cancellationCount > 0 ? "text-[#b02a26] dark:text-[#ff8f8a]" : "text-muted"}`}>
                  {p.refundCount} / {p.cancellationCount}
                </td>
                <td className={`px-2 py-2.5 text-end tabular-nums ${p.stock <= 0 ? "font-semibold text-[#b02a26] dark:text-[#ff8f8a]" : low ? "font-semibold text-[#a87900] dark:text-[#f5c84b]" : ""}`}>
                  {p.stock}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GranularityPicker({ value, onChange, days }: { value: Granularity; onChange: (g: Granularity) => void; days: number }) {
  const { t } = useI18n();
  const tg = t.admin.analytics.granularity;
  // Days over a year would be 365 thin bars; months under a month would be one.
  const options: Granularity[] = (["day", "week", "month"] as const).filter((g) => !(g === "month" && days < 60) && !(g === "week" && days < 14));
  if (options.length < 2) return null;
  return (
    <div role="radiogroup" aria-label={tg.label} className="inline-flex rounded-full border border-ink/15 p-0.5 text-xs">
      {options.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value === g}
          onClick={() => onChange(g)}
          className={`rounded-full px-3 py-1 transition-colors ${value === g ? "bg-ink text-canvas" : "hover:bg-ink/8"}`}
        >
          {tg[g]}
        </button>
      ))}
    </div>
  );
}

/** Orders per weekday, Saturday first. Bars rise from a shared baseline; counts sit on top. */
function WeekdayBars({ rows }: { rows: BreakdownRow[] }) {
  const { lang, t } = useI18n();
  const id = useId();
  const name = (dow: number) =>
    new Intl.DateTimeFormat(intlLocale[lang], { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + dow))); // 4 Jan 2026 = Sunday
  const byDay = WEEK.map((d) => ({ d, row: rows.find((r) => Number(r.key) === d) ?? { key: String(d), orders: 0, units: 0, revenue: 0 } }));
  const max = Math.max(1, ...byDay.map((x) => x.row.orders));
  const best = byDay.reduce((a, x) => (x.row.orders > a.row.orders ? x : a), byDay[0]);
  return (
    <figure aria-labelledby={`${id}-cap`}>
      <figcaption id={`${id}-cap`} className="sr-only">
        {t.admin.analytics.weekday}
      </figcaption>
      <div className="flex h-48 items-end gap-2" aria-hidden>
        {byDay.map(({ d, row }) => (
          <div key={d} className="flex h-full flex-1 flex-col justify-end text-center" title={`${name(d)} · ${row.orders} · ${formatPrice(row.revenue, lang)}`}>
            <span className="mb-1 text-xs tabular-nums text-muted">{row.orders}</span>
            <div
              className={`rounded-t-[4px] transition-[height] duration-700 ease-float ${d === best.d && row.orders > 0 ? "bg-blue" : "bg-blue/45"}`}
              style={{ height: `${(row.orders / max) * 78}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-ink/25 pt-2 text-center text-[0.7rem] text-muted" aria-hidden>
        {byDay.map(({ d }) => (
          <span key={d} className="flex-1 truncate">
            {name(d)}
          </span>
        ))}
      </div>
      <div className="sr-only">
        <table>
          <tbody>
            {byDay.map(({ d, row }) => (
              <tr key={d}>
                <th scope="row">{name(d)}</th>
                <td>{row.orders}</td>
                <td>{formatPrice(row.revenue, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function SplitBar({ label, parts }: { label: string; parts: { label: string; value: number; className: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <p className="eyebrow text-muted">{label}</p>
      <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map((p) =>
          p.value > 0 ? <div key={p.label} className={`${p.className} first:rounded-s-full last:rounded-e-full`} style={{ flexGrow: p.value }} /> : null,
        )}
        {total === 0 && <div className="flex-1 rounded-full bg-ink/8" />}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span aria-hidden className={`size-2.5 rounded-full ${p.className}`} />
            {p.label}
            <span className="font-semibold tabular-nums">{p.value}</span>
            <span className="text-xs text-muted tabular-nums">({pct(p.value, total)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <p className="eyebrow text-muted">{label}</p>
      <p className="mt-2 text-[clamp(1.6rem,2.6vw,2.2rem)] font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{note}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted">{text}</p>;
}
