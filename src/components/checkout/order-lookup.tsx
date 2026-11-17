"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatDate, formatPrice } from "@/i18n/format";
import { errorMessage } from "@/lib/api/errors";
import { useCancelOrder, useDownloadInvoice, usePaymentStatus, useStartPayment, useTrackOrder } from "@/lib/api/hooks";
import type { Order } from "@/lib/api/types";
import { governorateLabel } from "@/lib/governorates";
import { recallOrder, rememberOrder } from "./last-order";

const CANCELLABLE = new Set(["PENDING_PAYMENT", "CONFIRMED"]);

function TrackForm({ initialNumber, onFind }: { initialNumber?: string; onFind: (n: string, c: string) => void }) {
  const { t } = useI18n();
  const uid = useId();
  const [number, setNumber] = useState(initialNumber ?? "");
  const [contact, setContact] = useState("");
  const input =
    "mt-2 w-full rounded-xl border border-ink/25 bg-transparent px-4 py-3 hover:border-ink/50 focus:border-ink focus:outline-none";
  return (
    <form
      className="max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        if (number.trim() && contact.trim()) onFind(number.trim().toUpperCase(), contact.trim());
      }}
    >
      <p className="text-muted">{t.order.trackIntro}</p>
      <label htmlFor={`${uid}-n`} className="mt-8 block text-sm font-semibold">
        {t.order.trackNumber}
      </label>
      <input id={`${uid}-n`} dir="ltr" required value={number} onChange={(e) => setNumber(e.target.value)} placeholder="ORD-…" className={`${input} uppercase rtl:text-right`} />
      <label htmlFor={`${uid}-c`} className="mt-5 block text-sm font-semibold">
        {t.order.trackContact}
      </label>
      <input id={`${uid}-c`} dir="ltr" required autoComplete="email" value={contact} onChange={(e) => setContact(e.target.value)} className={`${input} rtl:text-right`} />
      <button type="submit" className="mt-6 rounded-full bg-blue px-8 py-3.5 font-semibold text-haze hover:bg-blue-deep">
        {t.order.trackSubmit}
      </button>
    </form>
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

function OrderDetails({ order, contact, justPlaced, paymobSuccess }: { order: Order; contact: string; justPlaced: boolean; paymobSuccess?: string | null }) {
  const { lang, t, href } = useI18n();
  const online = order.paymentMethod !== "COD";
  const payment = usePaymentStatus(online && order.paymentStatus !== "PAID" ? order.orderNumber : undefined, contact);
  const payStatus = payment.data?.paymentStatus ?? order.paymentStatus;
  const orderStatus = payment.data?.orderStatus ?? order.status;
  const pay = useStartPayment();
  const cancel = useCancelOrder();
  const invoice = useDownloadInvoice();
  const status = cancel.data?.status ?? orderStatus;

  const headline = (() => {
    if (status === "CANCELLED") return t.order.cancelled;
    if (!online) return t.order.thanks;
    if (payStatus === "PAID") return t.order.paid;
    // Paymob said no (or the payment link couldn't be created): say so, even if the API still says "pending".
    if (payStatus === "FAILED" || paymobSuccess === "false") return t.order.failed;
    if (payStatus === "PENDING" || paymobSuccess === "true") return t.order.pending;
    return justPlaced ? t.order.thanks : t.order.failed;
  })();
  const canPay =
    online && status === "PENDING_PAYMENT" && payStatus !== "PAID" && (payStatus !== "PENDING" || paymobSuccess === "false");
  const address = order.shippingAddress;

  return (
    <div>
      <h1 className="display text-[clamp(2.2rem,6vw,4.5rem)]">{headline}</h1>
      <p className="mt-4 max-w-xl text-muted">
        {t.order.emailSent} {t.order.keepNumber}
      </p>

      {canPay && (
        <div className="mt-8">
          <button
            type="button"
            disabled={pay.isPending}
            onClick={() =>
              pay.mutate(
                { orderId: order.id, contact },
                { onSuccess: (s) => window.location.assign(s.checkoutUrl) },
              )
            }
            className="rounded-full bg-blue px-8 py-3.5 font-semibold text-haze hover:bg-blue-deep disabled:opacity-60"
          >
            {t.order.payAgain}
          </button>
          {pay.isError && <p className="mt-2 text-sm text-[#d1342f]">{errorMessage(pay.error, t)}</p>}
        </div>
      )}

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              [t.order.number, order.orderNumber],
              [t.order.placedOn, formatDate(order.createdAt, lang)],
              [t.order.status, t.orderStatus[status]],
              [t.order.payment, `${t.paymentMethod[order.paymentMethod]} · ${t.paymentStatus[payStatus]}`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="eyebrow text-muted">{label}</dt>
                <dd className="mt-1.5 text-sm font-semibold" dir={label === t.order.number ? "ltr" : undefined}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <h2 className="eyebrow mt-12 text-muted">{t.order.items}</h2>
          <ul className="mt-3 divide-y divide-ink/10">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span>
                  <span lang="en" className="font-semibold">
                    {item.productName}
                  </span>
                  {item.variantName && <span lang="en" className="text-muted"> · {item.variantName}</span>}
                  <span className="text-muted"> × {item.quantity}</span>
                </span>
                <span className="tabular-nums">{formatPrice(item.priceAtPurchase * item.quantity, lang)}</span>
              </li>
            ))}
          </ul>

          <h2 className="eyebrow mt-10 text-muted">{t.order.timeline}</h2>
          <ol className="mt-4 space-y-3 border-s border-ink/20 ps-5">
            {order.statusHistory.map((event) => (
              <li key={event.id} className="relative text-sm">
                <span aria-hidden className="absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full bg-ink" />
                <span className="font-semibold">{t.orderStatus[event.toStatus]}</span>
                <time dateTime={event.createdAt} className="ms-2 text-muted">
                  {formatDate(event.createdAt, lang)}
                </time>
              </li>
            ))}
          </ol>
        </div>

        <aside className="self-start rounded-2xl bg-panel p-6 dark:ring-1 dark:ring-white/8">
          <dl className="space-y-2 text-sm">
            <Row label={t.order.subtotal} value={formatPrice(order.subtotal, lang)} />
            {order.discountAmount > 0 && <Row label={t.order.discount} value={`−${formatPrice(order.discountAmount, lang)}`} />}
            <Row label={t.order.shipping} value={order.shippingCost === 0 ? t.checkout.free : formatPrice(order.shippingCost, lang)} />
            {order.giftCardAmount > 0 && <Row label={t.order.giftCard} value={`−${formatPrice(order.giftCardAmount, lang)}`} />}
            {order.loyaltyDiscount > 0 && <Row label={t.order.loyalty} value={`−${formatPrice(order.loyaltyDiscount, lang)}`} />}
            <Row label={t.order.total} value={formatPrice(order.totalAmount, lang)} strong />
          </dl>
          <h2 className="eyebrow mt-6 text-muted">{t.order.deliverTo}</h2>
          <p className="mt-2 text-sm leading-relaxed">
            {order.customerName}
            <br />
            {/* Tracking only shows the delivery area, never the full street address. */}
            {[address.city, governorateLabel(address.governorate, lang)].filter(Boolean).join(lang === "ar" ? "، " : ", ")}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={invoice.isPending}
              onClick={() => invoice.mutate({ orderId: order.id, contact, filename: `${order.orderNumber}.pdf` })}
              className="rounded-full border border-ink/30 px-5 py-2.5 text-sm font-semibold hover:border-ink disabled:opacity-50"
            >
              {t.order.invoice}
            </button>
            {CANCELLABLE.has(status) && (
              <button
                type="button"
                disabled={cancel.isPending}
                onClick={() => {
                  if (window.confirm(t.order.cancelConfirm)) cancel.mutate({ orderId: order.id, contact });
                }}
                className="nav-link self-center text-sm text-muted"
              >
                {cancel.isPending ? t.order.cancelling : t.order.cancel}
              </button>
            )}
            {(invoice.isError || cancel.isError) && (
              <p className="text-xs text-[#d1342f]">{errorMessage(invoice.error ?? cancel.error, t)}</p>
            )}
          </div>
        </aside>
      </div>

      <Link href={href("/shop")} className="nav-link mt-14 inline-block">
        {t.order.continue} {t.common.arrow}
      </Link>
    </div>
  );
}

/**
 * Shows an order. The contact (email/phone) proves it's yours: after checkout
 * it comes from this tab's session storage; otherwise the visitor types it.
 */
export function OrderLookup({
  orderNumber: initialNumber,
  justPlaced = false,
  paymobSuccess,
}: {
  orderNumber?: string;
  justPlaced?: boolean;
  paymobSuccess?: string | null;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState<{ number: string; contact: string } | null>(null);
  // Until session storage has been read, show a placeholder instead of flashing the form.
  const [checked, setChecked] = useState(!initialNumber);

  useEffect(() => {
    if (!initialNumber) return;
    const contact = recallOrder(initialNumber);
    /* eslint-disable react-hooks/set-state-in-effect -- session storage is only readable after mount */
    if (contact) setQuery({ number: initialNumber, contact });
    setChecked(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialNumber]);

  const track = useTrackOrder(query?.number, query?.contact);

  if (!checked) {
    return <div role="status" aria-label={t.shop.loading} className="h-80 animate-pulse rounded-2xl bg-panel" />;
  }

  if (!query || track.isError) {
    return (
      <div>
        <h1 className="display text-[clamp(2.2rem,6vw,4.5rem)]">{t.order.trackTitle}</h1>
        {track.isError && <p className="mt-4 text-sm font-semibold text-[#d1342f]">{t.order.notFound}</p>}
        <div className="mt-8">
          <TrackForm
            initialNumber={initialNumber}
            onFind={(number, contact) => {
              rememberOrder(number, contact);
              setQuery({ number, contact });
            }}
          />
        </div>
      </div>
    );
  }
  if (!track.data) {
    return <div role="status" aria-label={t.shop.loading} className="h-80 animate-pulse rounded-2xl bg-panel" />;
  }
  return <OrderDetails order={track.data} contact={query.contact} justPlaced={justPlaced} paymobSuccess={paymobSuccess} />;
}

export function useOrderParams(search: URLSearchParams) {
  return {
    orderNumber: search.get("orderNumber") ?? search.get("order") ?? undefined,
    justPlaced: search.get("placed") === "1",
    paymobSuccess: search.get("success") ?? (search.get("payment") === "error" ? "false" : null),
  };
}
