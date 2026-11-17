"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatPrice } from "@/i18n/format";
import { useInsights, useLowStock, useOverview, useSalesTrend, useTopProducts } from "@/lib/admin/api";
import type { DateRange, Granularity } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import { TrendChart } from "./trend-chart";
import { PageTitle, Panel, Skeleton } from "./ui";

const RANGES = [7, 30, 90] as const;

function rangeOf(days: number): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  // Round to the minute so the query key is stable between renders.
  const iso = (d: Date) => new Date(Math.floor(d.getTime() / 60_000) * 60_000).toISOString();
  return { fromDate: iso(from), toDate: iso(to) };
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={`text-xs font-semibold tabular-nums ${up ? "text-[#16773f] dark:text-[#7ee2a8]" : "text-[#b02a26] dark:text-[#ff8f8a]"}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Kpi({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number | null }) {
  return (
    <div className="rounded-2xl bg-panel p-5 dark:ring-1 dark:ring-white/8">
      <p className="eyebrow text-muted">{label}</p>
      <p className="mt-3 text-[clamp(1.6rem,2.6vw,2.2rem)] font-semibold tabular-nums">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        {delta !== undefined && <Delta value={delta} />}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

export function OverviewView() {
  const { lang, t, href } = useI18n();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const range = useMemo(() => rangeOf(days), [days]);
  const granularity: Granularity = days > 31 ? "week" : "day";
  const overview = useOverview(range);
  const trend = useSalesTrend(range, granularity);
  const top = useTopProducts(range);
  const insights = useInsights();
  const lowStock = useLowStock();
  const o = overview.data;
  const tt = t.admin.overview;

  return (
    <div>
      <PageTitle
        aside={
          <div role="radiogroup" aria-label={t.admin.range.label} className="inline-flex rounded-full border border-ink/20 p-1">
            {RANGES.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={days === d}
                onClick={() => setDays(d)}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${days === d ? "bg-ink text-canvas" : "hover:bg-ink/8"}`}
              >
                {t.admin.range[`d${d}`]}
              </button>
            ))}
          </div>
        }
      >
        {tt.title}
      </PageTitle>

      {overview.isError && <p className="mb-6 text-sm text-[#d1342f]">{errorMessage(overview.error, t)}</p>}

      {/* Waiting orders: the first thing to act on. */}
      <Link
        href={`${href("/admin/orders")}?status=CONFIRMED`}
        className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-blue px-5 py-4 text-haze transition-colors hover:bg-blue-deep"
      >
        <span className="font-semibold">
          {o ? (o.pendingOrdersCount ? fmt(tt.pending, { count: o.pendingOrdersCount }) : tt.pendingNone) : "…"}
        </span>
        <span className="text-sm">
          {tt.pendingCta} {t.common.arrow}
        </span>
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
        {o ? (
          <>
            <Kpi label={tt.revenue} value={formatPrice(o.totalRevenue, lang)} delta={o.deltas.revenue} sub={fmt(tt.vsPrev, { days })} />
            <Kpi label={tt.orders} value={String(o.totalOrders)} delta={o.deltas.orders} />
            <Kpi label={tt.aov} value={formatPrice(o.averageOrderValue, lang)} delta={o.deltas.averageOrderValue} />
            <Kpi
              label={tt.customers}
              value={String(o.totalCustomers)}
              delta={o.deltas.customers}
              sub={fmt(tt.newReturning, { new: o.newCustomers, returning: o.returningCustomers })}
            />
            <Kpi label={tt.conversion} value={`${o.conversionRate.toFixed(1)}%`} sub={fmt(tt.visitors, { count: o.visitors })} />
          </>
        ) : (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-32" />)
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title={tt.trend} className="xl:col-span-2">
          {trend.data ? (
            trend.data.some((p) => p.revenue > 0) ? (
              <TrendChart points={trend.data} lang={lang} label={tt.trend} />
            ) : (
              <p className="py-16 text-center text-sm text-muted">{tt.trendEmpty}</p>
            )
          ) : (
            <Skeleton className="h-56" />
          )}
        </Panel>

        <Panel title={tt.insights}>
          {insights.data?.length ? (
            <ul className="space-y-4">
              {insights.data.slice(0, 5).map((i, n) => (
                <li key={n}>
                  <span
                    className={`eyebrow rounded-full px-2 py-0.5 text-[0.6rem] ${
                      i.severity === "HIGH" ? "bg-[#d1342f]/12 text-[#b02a26]" : i.severity === "MEDIUM" ? "bg-[#f5b301]/15 text-[#a87900]" : "bg-ink/8 text-muted"
                    }`}
                  >
                    {tt.severity[i.severity]}
                  </span>
                  <p lang="en" className="mt-1.5 text-sm font-semibold">
                    {i.title}
                  </p>
                  <p lang="en" className="text-xs text-muted">
                    {i.description}
                  </p>
                </li>
              ))}
            </ul>
          ) : insights.data ? (
            <p className="text-sm text-muted">{tt.insightsEmpty}</p>
          ) : (
            <Skeleton className="h-40" />
          )}
        </Panel>

        <Panel title={tt.topProducts} className="xl:col-span-2">
          {top.data ? (
            top.data.some((p) => p.unitsSold > 0) ? (
              <ol className="divide-y divide-ink/10">
                {top.data
                  .filter((p) => p.unitsSold > 0)
                  .map((p, i) => (
                    <li key={p.productId} className="flex items-center gap-4 py-3 text-sm">
                      <span className="w-5 text-muted tabular-nums">{i + 1}</span>
                      <span lang="en" className="min-w-0 flex-1 truncate font-semibold">
                        {p.name}
                      </span>
                      <span className="text-muted">{fmt(tt.sold, { count: p.unitsSold })}</span>
                      <span className="w-28 text-end tabular-nums">{formatPrice(p.revenue, lang)}</span>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">{tt.topEmpty}</p>
            )
          ) : (
            <Skeleton className="h-40" />
          )}
        </Panel>

        <Panel title={tt.lowStock}>
          {lowStock.data ? (
            lowStock.data.length ? (
              <ul className="divide-y divide-ink/10">
                {lowStock.data.map((item) => (
                  <li key={`${item.productId}-${item.variantId}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span lang="en" className="block truncate font-semibold">
                        {item.name}
                        {item.variantName && <span className="font-normal text-muted"> · {item.variantName}</span>}
                      </span>
                      <span lang="en" className="text-xs text-muted">
                        {item.sku}
                      </span>
                    </span>
                    <span className={`shrink-0 text-xs font-semibold ${item.stock <= 0 ? "text-[#b02a26] dark:text-[#ff8f8a]" : "text-[#a87900] dark:text-[#ffd45c]"}`}>
                      {item.stock <= 0 ? tt.soldOut : fmt(tt.left, { count: item.stock })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{tt.lowStockEmpty}</p>
            )
          ) : (
            <Skeleton className="h-40" />
          )}
        </Panel>
      </div>
    </div>
  );
}
