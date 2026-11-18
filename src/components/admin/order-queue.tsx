"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDateTime, formatPrice } from "@/i18n/format";
import { useAdminOrders, useQuickStatus } from "@/lib/admin/api";
import type { AdminOrderRow } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import type { OrderStatus } from "@/lib/api/types";
import { Panel, Skeleton } from "./ui";

/** Each stage the team moves by hand, and where the order goes next. */
const STAGES = [
  { status: "CONFIRMED", next: "PREPARING" },
  { status: "PREPARING", next: "SHIPPED" },
  { status: "SHIPPED", next: "DELIVERED" },
] as const satisfies readonly { status: OrderStatus; next: OrderStatus }[];

const SHOWN = 5;

/**
 * The orders waiting on the team, oldest first, one column per step, with a
 * button that moves each one forward. Unpaid online orders are only counted:
 * nothing to do until the customer pays.
 */
export function OrderQueue() {
  const { lang, t, href } = useI18n();
  const tt = t.admin.overview;
  const move = useQuickStatus();
  const [done, setDone] = useState<string | null>(null);
  const waiting = useAdminOrders({ status: "PENDING_PAYMENT", limit: 1 });
  const stages = [
    { ...STAGES[0], query: useAdminOrders({ status: "CONFIRMED", sort: "createdAt", limit: SHOWN }) },
    { ...STAGES[1], query: useAdminOrders({ status: "PREPARING", sort: "createdAt", limit: SHOWN }) },
    { ...STAGES[2], query: useAdminOrders({ status: "SHIPPED", sort: "createdAt", limit: SHOWN }) },
  ];
  const loaded = stages.every((s) => s.query.data);
  const total = stages.reduce((sum, s) => sum + (s.query.data?.meta.total ?? 0), 0);
  const unpaid = waiting.data?.meta.total ?? 0;

  const advance = (o: AdminOrderRow, next: OrderStatus) =>
    move.mutate(
      { id: o.id, status: next },
      { onSuccess: () => setDone(fmt(tt.moved, { number: o.orderNumber, status: t.orderStatus[next] })) },
    );

  return (
    <Panel
      title={tt.queue}
      className="mb-6"
      action={
        unpaid > 0 ? (
          <Link href={`${href("/admin/orders")}?status=PENDING_PAYMENT`} className="text-xs text-muted underline-offset-4 hover:underline" title={tt.waitingNote}>
            {tt.stage.PENDING_PAYMENT}: <span className="tabular-nums">{unpaid}</span>
          </Link>
        ) : undefined
      }
    >
      {/* Announces each move for screen readers; also the visible confirmation. */}
      <p role="status" className="-mt-2 mb-3 min-h-5 text-xs text-[#16773f] dark:text-[#7ee2a8]">
        {move.isError ? <span className="text-[#d1342f]">{errorMessage(move.error, t)}</span> : done}
      </p>

      {loaded && total === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{tt.queueEmpty}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {stages.map(({ status, next, query }) => {
            const count = query.data?.meta.total ?? 0;
            return (
              <section key={status} aria-labelledby={`queue-${status}`} className="rounded-xl border border-ink/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 id={`queue-${status}`} className="text-sm font-semibold">
                    {tt.stage[status]}
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${count ? "bg-blue text-haze" : "bg-ink/8 text-muted"}`}>
                    {query.data ? count : "…"}
                  </span>
                </div>
                {!query.data ? (
                  <Skeleton className="h-28" />
                ) : count === 0 ? (
                  <p className="py-4 text-center text-xs text-muted">—</p>
                ) : (
                  <ul className="divide-y divide-ink/8">
                    {query.data.items.map((o) => {
                      const busy = move.isPending && move.variables?.id === o.id;
                      return (
                        <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                          <Link href={href(`/admin/orders/${o.id}`)} className="min-w-0 text-ink hover:underline">
                            <span lang="en" className="block truncate font-mono text-xs">
                              {o.orderNumber}
                            </span>
                            <span lang="en" dir="auto" className="block truncate text-sm rtl:text-right">
                              {o.customerName}
                            </span>
                            <span className="block text-xs text-muted tabular-nums">
                              {formatPrice(o.totalAmount, lang)} · {formatDateTime(o.createdAt, lang)}
                            </span>
                          </Link>
                          <button
                            type="button"
                            disabled={move.isPending}
                            onClick={() => advance(o, next)}
                            aria-label={fmt(tt.advanceFor, { action: tt.advance[status], number: o.orderNumber })}
                            className="shrink-0 rounded-full border border-ink/20 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-blue hover:bg-blue hover:text-haze disabled:opacity-50"
                          >
                            {busy ? t.admin.order.updating : tt.advance[status]}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {count > SHOWN && (
                  <Link href={`${href("/admin/orders")}?status=${status}`} className="mt-2 block text-xs text-muted underline-offset-4 hover:underline">
                    {fmt(tt.seeAll, { count })} {t.common.arrow}
                  </Link>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

