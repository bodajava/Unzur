"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatPrice, localized } from "@/i18n/format";
import { useInsights, useLowStock, useOverview, useSalesTrend, useTopProducts } from "@/lib/admin/api";
import { errorMessage } from "@/lib/api/errors";
import { PushToggle } from "@/components/notifications/push-toggle";
import { OrderQueue } from "./order-queue";
import { granularityFor, RangePicker, rangeOf, type RangeDays } from "./range";
import { TrendChart } from "./trend-chart";
import { PageTitle, Panel, Skeleton } from "./ui";

const RANGES = [7, 30, 90] as const satisfies readonly RangeDays[];

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
  const { lang, t } = useI18n();
  const [days, setDays] = useState<RangeDays>(30);
  const range = useMemo(() => rangeOf(days), [days]);
  const granularity = granularityFor(days);
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
        aside={<RangePicker value={days} onChange={setDays} options={RANGES} />}
      >
        {tt.title}
      </PageTitle>

      {overview.isError && <p className="mb-6 text-sm text-[#d1342f]">{errorMessage(overview.error, t)}</p>}

      {/* Orders waiting on the team: the first thing to act on. */}
      <OrderQueue />

      {/* Alerts on this device for new orders, messages and low stock. */}
      <PushToggle audience="staff" className="mb-6 rounded-2xl border border-ink/10 px-5 py-4" />

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
            <Kpi label={tt.conversion} value={`${(o.conversionRate * 100).toFixed(1)}%` /* API sends a 0–1 ratio */} sub={fmt(tt.visitors, { count: o.visitors })} />
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
                  <p lang="en" dir="ltr" className="mt-1.5 text-sm font-semibold rtl:text-right">
                    {i.title}
                  </p>
                  <p lang="en" dir="ltr" className="text-xs text-muted rtl:text-right">
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
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {localized(lang, p.name, p.nameAr)}
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
                        {localized(lang, item.name, item.nameAr)}
                        {item.variantName && <span className="font-normal text-muted"> · {localized(lang, item.variantName, item.variantNameAr)}</span>}
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
