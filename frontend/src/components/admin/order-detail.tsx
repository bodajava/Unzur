"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDateTime, formatPrice, localized } from "@/i18n/format";
import { useAdminOrder, useRefundOrder, useSetOrderStatus } from "@/lib/admin/api";
import { ORDER_TRANSITIONS, REFUNDABLE } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import type { OrderStatus } from "@/lib/api/types";
import { useDownloadInvoice } from "@/lib/api/hooks";
import { governorateLabel } from "@/lib/governorates";
import { OrderStatusBadge, PaymentStatusText } from "./status-badge";
import { Panel, Skeleton } from "./ui";

function Copy({ text }: { text: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="nav-link text-xs text-muted"
    >
      {done ? t.admin.order.copied : t.admin.order.copy}
    </button>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-ink/15 pt-3 text-base font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function OrderDetail({ id }: { id: string }) {
  const { lang, t, href } = useI18n();
  const uid = useId();
  const { data: order, isError, error } = useAdminOrder(id);
  const setStatus = useSetOrderStatus(id);
  const refund = useRefundOrder(id);
  const invoice = useDownloadInvoice();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [restock, setRestock] = useState(true);
  const [reasonError, setReasonError] = useState(false);
  const to = t.admin.order;

  if (isError) return <p className="text-[#d1342f]">{errorMessage(error, t)}</p>;
  if (!order) return <Skeleton className="h-[30rem]" />;

  const moves = ORDER_TRANSITIONS[order.status];
  const canRefund = REFUNDABLE.includes(order.status);
  const online = order.paymentMethod !== "COD";
  const a = order.shippingAddress;
  const busy = setStatus.isPending || refund.isPending;

  return (
    <div>
      <Link href={href("/admin/orders")} className="nav-link text-sm text-muted">
        {t.common.arrow === "→" ? "←" : "→"} {to.back}
      </Link>
      <div className="mt-4 mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 dir="ltr" className="display text-[clamp(1.8rem,4vw,3rem)]">
          {order.orderNumber}
        </h1>
        <OrderStatusBadge status={order.status} />
        <Copy text={order.orderNumber} />
        <p className="w-full text-sm text-muted">{fmt(to.placed, { date: formatDateTime(order.createdAt, lang) })}</p>
      </div>

      <OrderProgress status={order.status} history={order.statusHistory} />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Panel title={to.items}>
            <ul className="divide-y divide-ink/10">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span>
                    <span className="font-semibold">{localized(lang, item.productName, item.productNameAr)}</span>
                    {item.variantName && <span className="text-muted"> · {localized(lang, item.variantName, item.variantNameAr)}</span>}
                    {item.choice && <span className="font-semibold text-blue"> · <bdi>{item.choice}</bdi></span>}
                    <span className="text-muted"> × {item.quantity}</span>
                    <span className="block text-xs text-muted tabular-nums">{formatPrice(item.priceAtPurchase, lang)}</span>
                  </span>
                  <span className="tabular-nums">{formatPrice(item.priceAtPurchase * item.quantity, lang)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
              <Row label={t.order.subtotal} value={formatPrice(order.subtotal, lang)} />
              {order.discountAmount > 0 && (
                <Row label={`${t.order.discount}${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`−${formatPrice(order.discountAmount, lang)}`} />
              )}
              <Row label={t.order.shipping} value={formatPrice(order.shippingCost, lang)} />
              {order.giftCardAmount > 0 && <Row label={t.order.giftCard} value={`−${formatPrice(order.giftCardAmount, lang)}`} />}
              {order.loyaltyDiscount > 0 && <Row label={t.order.loyalty} value={`−${formatPrice(order.loyaltyDiscount, lang)}`} />}
              <Row label={t.order.total} value={formatPrice(order.totalAmount, lang)} strong />
            </dl>
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel title={to.customer}>
              <Link
                href={href(`/admin/customers/${encodeURIComponent(order.userId ?? order.customerEmail.toLowerCase())}`)}
                className="font-semibold hover:underline"
              >
                {order.customerName} {t.common.arrow}
              </Link>
              <p dir="ltr" className="mt-1 flex items-center gap-2 text-sm rtl:justify-end">
                <a href={`mailto:${order.customerEmail}`} className="hover:underline">{order.customerEmail}</a>
              </p>
              <p dir="ltr" className="mt-1 text-sm rtl:text-right">
                <a href={`tel:${order.customerPhone}`} className="hover:underline">{order.customerPhone}</a>
              </p>
              <p className="mt-3 text-xs text-muted">{order.user ? to.account : to.guest}</p>
            </Panel>
            <Panel title={to.address}>
              <p className="text-sm leading-relaxed">
                {[a.street, a.building && `${t.checkout.building} ${a.building}`, a.floor && `${t.checkout.floor} ${a.floor}`, a.apartment && `${t.checkout.apartment} ${a.apartment}`]
                  .filter(Boolean)
                  .join(lang === "ar" ? "، " : ", ")}
                <br />
                {[a.city, a.governorate && governorateLabel(a.governorate, lang)].filter(Boolean).join(lang === "ar" ? "، " : ", ")}
              </p>
              {order.notes && (
                <>
                  <h3 className="eyebrow mt-4 text-muted">{to.notes}</h3>
                  <p className="mt-1 text-sm">{order.notes}</p>
                </>
              )}
            </Panel>
          </div>

          <Panel title={to.payment}>
            <p className="text-sm">
              {t.paymentMethod[order.paymentMethod]} · <PaymentStatusText status={order.paymentStatus} />
            </p>
            {order.payments.length > 0 && (
              <>
                <h3 className="eyebrow mt-4 text-muted">{to.payments}</h3>
                <ul className="mt-2 divide-y divide-ink/10 text-sm">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>
                        {p.provider} · {p.status}
                        {p.paymobTransactionId && <span dir="ltr" className="text-xs text-muted"> · #{p.paymobTransactionId}</span>}
                      </span>
                      <span className="tabular-nums">
                        {formatPrice(p.amountPiasters, lang)}
                        {p.refundedPiasters > 0 && <span className="text-xs text-muted"> (−{formatPrice(p.refundedPiasters, lang)})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {order.cancelOrRefundReason && (
              <>
                <h3 className="eyebrow mt-4 text-muted">{to.reason}</h3>
                <p className="mt-1 text-sm">{order.cancelOrRefundReason}</p>
              </>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={to.actions}>
            {moves.length === 0 && !canRefund ? (
              <p className="text-sm text-muted">{to.closed}</p>
            ) : (
              <>
                {moves.length > 0 && (
                  <>
                    <label htmlFor={`${uid}-note`} className="text-xs text-muted">{to.note}</label>
                    <input
                      id={`${uid}-note`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-ink/20 bg-transparent px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
                    />
                    <div className="mt-3 flex flex-col gap-2">
                      {moves.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busy}
                          onClick={() => setStatus.mutate({ status: s, note: note.trim() || undefined }, { onSuccess: () => setNote("") })}
                          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                            s === "CANCELLED" ? "border border-[#d1342f]/40 text-[#b02a26] hover:bg-[#d1342f]/8 dark:text-[#ff8f8a]" : "bg-blue text-haze hover:bg-blue-deep"
                          }`}
                        >
                          {setStatus.isPending && setStatus.variables?.status === s ? to.updating : fmt(to.moveTo, { status: t.orderStatus[s] })}
                        </button>
                      ))}
                    </div>
                    {moves.includes("CANCELLED") && <p className="mt-2 text-xs text-muted">{to.cancelWarn}</p>}
                    {setStatus.isError && <p className="mt-2 text-xs text-[#d1342f]">{errorMessage(setStatus.error, t)}</p>}
                  </>
                )}

                {canRefund && (
                  <details className="mt-6 border-t border-ink/10 pt-4">
                    <summary className="cursor-pointer text-sm font-semibold">{to.refund}</summary>
                    <form
                      className="mt-3 space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!reason.trim()) return setReasonError(true);
                        const egp = Number.parseFloat(amount);
                        refund.mutate({
                          reason: reason.trim(),
                          restock,
                          amountPiasters: online && Number.isFinite(egp) && egp > 0 ? Math.round(egp * 100) : undefined,
                        });
                      }}
                    >
                      <label htmlFor={`${uid}-reason`} className="text-xs text-muted">{to.refundReason}</label>
                      <textarea
                        id={`${uid}-reason`}
                        rows={2}
                        value={reason}
                        onChange={(e) => {
                          setReason(e.target.value);
                          setReasonError(false);
                        }}
                        aria-invalid={reasonError}
                        className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm focus:outline-none ${reasonError ? "border-[#d1342f]" : "border-ink/20 focus:border-ink"}`}
                      />
                      {reasonError && <p className="text-xs text-[#d1342f]">{to.reasonRequired}</p>}
                      {online && (
                        <>
                          <label htmlFor={`${uid}-amount`} className="block text-xs text-muted">{to.refundAmount}</label>
                          <input
                            id={`${uid}-amount`}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            dir="ltr"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full rounded-xl border border-ink/20 bg-transparent px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none"
                          />
                        </>
                      )}
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="size-4 accent-[var(--color-ink)]" />
                        {to.restock}
                      </label>
                      <button type="submit" disabled={busy} className="w-full rounded-full border border-[#d1342f]/40 px-5 py-2.5 text-sm font-semibold text-[#b02a26] hover:bg-[#d1342f]/8 disabled:opacity-50 dark:text-[#ff8f8a]">
                        {refund.isPending ? to.refunding : to.refundSubmit}
                      </button>
                      {refund.isError && <p className="text-xs text-[#d1342f]">{errorMessage(refund.error, t)}</p>}
                    </form>
                  </details>
                )}
              </>
            )}
            <button
              type="button"
              disabled={invoice.isPending}
              onClick={() => invoice.mutate({ orderId: order.id, filename: `${order.orderNumber}.pdf` })}
              className="mt-6 w-full rounded-full border border-ink/25 px-5 py-2.5 text-sm font-semibold hover:border-ink disabled:opacity-50"
            >
              {to.invoice}
            </button>
          </Panel>

          <Panel title={to.timeline}>
            <ol className="space-y-4 border-s border-ink/20 ps-5">
              {order.statusHistory.map((ev) => (
                <li key={ev.id} className="relative text-sm">
                  <span aria-hidden className="absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full bg-ink" />
                  <OrderStatusBadge status={ev.toStatus} />
                  <p className="mt-1 text-xs text-muted">
                    {formatDateTime(ev.createdAt, lang)} ·{" "}
                    {ev.changedBy ? fmt(to.by, { name: `${ev.changedBy.firstName} ${ev.changedBy.lastName}` }) : to.auto}
                  </p>
                  {ev.note && <p className="mt-1">{ev.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}

const STEPS: OrderStatus[] = ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"];

/**
 * Where the order is, at a glance: four steps from confirmed to delivered,
 * with the time each one happened. Cancelled and refunded orders say so instead.
 */
function OrderProgress({ status, history }: { status: OrderStatus; history: { toStatus: OrderStatus; createdAt: string }[] }) {
  const { lang, t } = useI18n();
  const when = (s: OrderStatus) => history.filter((h) => h.toStatus === s).at(-1)?.createdAt;
  if (status === "CANCELLED" || status === "REFUNDED") {
    const at = when(status);
    return (
      <p className="mb-8 rounded-2xl bg-[#d1342f]/8 px-5 py-4 text-sm font-semibold text-[#b02a26] dark:text-[#ff8f8a]">
        {t.orderStatus[status]}
        {at && <span className="ms-2 font-normal opacity-80">· {formatDateTime(at, lang)}</span>}
      </p>
    );
  }
  const reached = status === "PENDING_PAYMENT" ? -1 : STEPS.indexOf(status);
  return (
    <ol className="mb-8 grid grid-cols-4 gap-2" aria-label={t.admin.order.progress}>
      {STEPS.map((s, i) => {
        const done = i <= reached;
        const at = when(s);
        return (
          <li key={s} aria-current={i === reached ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${done ? "bg-blue" : "bg-ink/12"}`} />
            <p className={`mt-2 text-xs font-semibold sm:text-sm ${done ? "" : "text-muted"}`}>{t.orderStatus[s]}</p>
            <p className="text-[0.7rem] text-muted tabular-nums">{done && at ? formatDateTime(at, lang) : "\u00a0"}</p>
          </li>
        );
      })}
    </ol>
  );
}
