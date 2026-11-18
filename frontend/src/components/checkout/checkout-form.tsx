"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatPrice, isFallback, localized } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useCart, useGiftCardBalance, usePlaceOrder, useSession, useShippingRate, usePaymentMethods } from "@/lib/api/hooks";
import type { CheckoutInput, PaymentMethod } from "@/lib/api/types";
import { GOVERNORATES } from "@/lib/governorates";
import { rememberOrder } from "./last-order";

type Fields = Omit<CheckoutInput, "paymentMethod" | "redeemLoyaltyPoints" | "couponCode">;
type FieldError = Partial<Record<"customerName" | "customerEmail" | "customerPhone" | "governorate" | "city" | "street", string>>;

const EMPTY: Fields = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  governorate: "",
  city: "",
  street: "",
  building: "",
  floor: "",
  apartment: "",
  notes: "",
  giftCardCode: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Same rule as the API: Egyptian mobile (01x…) or an international number.
const PHONE = /^(?:\+?20)?01[0125][0-9]{8}$|^\+?[1-9][0-9]{7,14}$/;

function Field({
  label,
  error,
  hint,
  children,
  id,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  id: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-[#d1342f]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputClass = (invalid: boolean) =>
  `mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-base transition-colors placeholder:text-ink/35 focus:outline-none focus-visible:outline-none ${
    invalid ? "border-[#d1342f]" : "border-ink/25 hover:border-ink/50 focus:border-ink"
  }`;

export function CheckoutForm() {
  const { lang, t, href } = useI18n();
  const available = usePaymentMethods();
  const router = useRouter();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const { user } = useSession();
  const { data: cart, isPending: cartLoading } = useCart();
  const place = usePlaceOrder();
  const gift = useGiftCardBalance();

  const [f, setF] = useState<Fields>(EMPTY);
  const [method, setMethod] = useState<PaymentMethod>("COD");
  const [errors, setErrors] = useState<FieldError>({});
  const [redirecting, setRedirecting] = useState(false);

  // Signed-in customers start with their details filled in (once per user).
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (user && prefilledFor !== user.id) {
    setPrefilledFor(user.id);
    setF((prev) => ({
      ...prev,
      customerName: prev.customerName || `${user.firstName} ${user.lastName}`.trim(),
      customerEmail: prev.customerEmail || user.email,
      customerPhone: prev.customerPhone || user.phone || "",
    }));
  }

  const afterDiscount = cart ? cart.subtotal - cart.discountAmount : 0;
  const rate = useShippingRate(f.governorate || undefined, cart ? afterDiscount : undefined);
  const noZone = rate.isError && rate.error instanceof ApiError && rate.error.status === 404;
  const shippingFee = rate.data?.fee ?? 0;
  const giftValid = gift.data?.isValid && gift.variables === f.giftCardCode?.trim().toUpperCase();
  const beforeGift = afterDiscount + (rate.data ? shippingFee : 0);
  const giftAmount = giftValid ? Math.min(gift.data!.currentBalance, beforeGift) : 0;
  const total = beforeGift - giftAmount;

  const set = (key: keyof Fields) => (e: { target: { value: string } }) => {
    setF((prev) => ({ ...prev, [key]: e.target.value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): FieldError => {
    const e: FieldError = {};
    if (f.customerName.trim().length < 2) e.customerName = t.checkout.errors.name;
    if (!EMAIL.test(f.customerEmail.trim())) e.customerEmail = t.checkout.errors.email;
    if (!PHONE.test(f.customerPhone.replace(/[\s-]/g, ""))) e.customerPhone = t.checkout.errors.phone;
    if (!f.governorate) e.governorate = t.checkout.errors.governorate;
    if (f.city.trim().length < 2) e.city = t.checkout.errors.city;
    if (f.street.trim().length < 2) e.street = t.checkout.errors.street;
    return e;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(id(Object.keys(found)[0]))?.focus();
      return;
    }
    const trimmed = (v?: string) => (v && v.trim() ? v.trim() : undefined);
    const input: CheckoutInput = {
      customerName: f.customerName.trim(),
      customerEmail: f.customerEmail.trim(),
      customerPhone: f.customerPhone.replace(/[\s-]/g, ""),
      governorate: f.governorate,
      city: f.city.trim(),
      street: f.street.trim(),
      building: trimmed(f.building),
      floor: trimmed(f.floor),
      apartment: trimmed(f.apartment),
      notes: trimmed(f.notes),
      giftCardCode: giftValid ? trimmed(f.giftCardCode)?.toUpperCase() : undefined,
      couponCode: cart?.coupon?.valid ? cart.coupon.code : undefined,
      paymentMethod: method,
    };
    place.mutate(input, {
      onSuccess: (result) => {
        rememberOrder(result.order.orderNumber, input.customerEmail);
        if (result.payment?.checkoutUrl) {
          setRedirecting(true);
          window.location.assign(result.payment.checkoutUrl);
          return;
        }
        // Online payment that couldn't start: the order is saved; the result page offers "Pay now".
        const paymentFailed = method !== "COD" ? "&payment=error" : "";
        router.push(
          `${href("/checkout/result")}?orderNumber=${encodeURIComponent(result.order.orderNumber)}&placed=1${paymentFailed}`,
        );
      },
    });
  };

  if (cartLoading) {
    return <div className="h-96 animate-pulse rounded-2xl bg-panel" aria-label={t.shop.loading} role="status" />;
  }
  if (!cart || cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">{t.checkout.emptyCart}</p>
        <Link href={href("/shop")} className="mt-6 inline-flex rounded-full border-2 border-ink px-6 py-2.5 text-sm font-semibold hover:bg-ink hover:text-canvas">
          {t.cart.emptyCta}
        </Link>
      </div>
    );
  }

  const describedBy = (name: keyof FieldError, hint = false) =>
    errors[name] ? `${id(name)}-error` : hint ? `${id(name)}-hint` : undefined;
  const methods = (
    [
      { key: "COD", label: t.checkout.cod, hint: t.checkout.codHint },
      { key: "PAYMOB_CARD", label: t.checkout.card, hint: t.checkout.cardHint },
      { key: "PAYMOB_WALLET", label: t.checkout.wallet, hint: t.checkout.walletHint },
    ] satisfies { key: PaymentMethod; label: string; hint: string }[]
  ).filter((m) => (available.data ? available.data.methods.includes(m.key) : m.key === "COD")); // only what's set up
  const busy = place.isPending || redirecting;
  const serverErrors = place.error instanceof ApiError && Array.isArray(place.error.errors) ? (place.error.errors as string[]) : [];

  return (
    <form onSubmit={submit} noValidate className="grid gap-12 lg:grid-cols-[1fr_26rem] lg:gap-16">
      <div className="space-y-12">
        <fieldset>
          <legend className="display text-2xl">{t.checkout.contact}</legend>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id={id("customerName")} label={t.checkout.name} error={errors.customerName} className="sm:col-span-2">
              <input
                id={id("customerName")}
                autoComplete="name"
                value={f.customerName}
                onChange={set("customerName")}
                aria-invalid={!!errors.customerName}
                aria-describedby={describedBy("customerName")}
                className={inputClass(!!errors.customerName)}
              />
            </Field>
            <Field id={id("customerEmail")} label={t.checkout.email} error={errors.customerEmail}>
              <input
                id={id("customerEmail")}
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                value={f.customerEmail}
                onChange={set("customerEmail")}
                aria-invalid={!!errors.customerEmail}
                aria-describedby={describedBy("customerEmail")}
                className={`${inputClass(!!errors.customerEmail)} rtl:text-right`}
              />
            </Field>
            <Field id={id("customerPhone")} label={t.checkout.phone} error={errors.customerPhone} hint={t.checkout.phoneHint}>
              <input
                id={id("customerPhone")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                value={f.customerPhone}
                onChange={set("customerPhone")}
                aria-invalid={!!errors.customerPhone}
                aria-describedby={describedBy("customerPhone", true)}
                className={`${inputClass(!!errors.customerPhone)} rtl:text-right`}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <legend className="display text-2xl">{t.checkout.delivery}</legend>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id={id("governorate")} label={t.checkout.governorate} error={errors.governorate}>
              <select
                id={id("governorate")}
                autoComplete="address-level1"
                value={f.governorate}
                onChange={set("governorate")}
                aria-invalid={!!errors.governorate}
                aria-describedby={describedBy("governorate")}
                className={`${inputClass(!!errors.governorate)} appearance-none`}
              >
                <option value="" disabled className="bg-canvas">
                  {t.checkout.chooseGovernorate}
                </option>
                {GOVERNORATES.map((g) => (
                  <option key={g.value} value={g.value} className="bg-canvas text-ink">
                    {lang === "ar" ? g.ar : g.value}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={id("city")} label={t.checkout.city} error={errors.city}>
              <input
                id={id("city")}
                autoComplete="address-level2"
                value={f.city}
                onChange={set("city")}
                aria-invalid={!!errors.city}
                aria-describedby={describedBy("city")}
                className={inputClass(!!errors.city)}
              />
            </Field>
            <Field id={id("street")} label={t.checkout.street} error={errors.street} className="sm:col-span-2">
              <input
                id={id("street")}
                autoComplete="address-line1"
                value={f.street}
                onChange={set("street")}
                aria-invalid={!!errors.street}
                aria-describedby={describedBy("street")}
                className={inputClass(!!errors.street)}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3 sm:col-span-2">
              {(["building", "floor", "apartment"] as const).map((key) => (
                <Field key={key} id={id(key)} label={t.checkout[key]}>
                  <input id={id(key)} value={f[key] ?? ""} onChange={set(key)} className={inputClass(false)} />
                </Field>
              ))}
            </div>
            <Field id={id("notes")} label={t.checkout.notes} className="sm:col-span-2">
              <textarea id={id("notes")} rows={2} value={f.notes ?? ""} onChange={set("notes")} className={`${inputClass(false)} resize-y`} />
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <legend className="display text-2xl">{t.checkout.payment}</legend>
          <div className="mt-6 space-y-3" role="radiogroup">
            {methods.map((m) => (
              <label
                key={m.key}
                className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors ${
                  method === m.key ? "border-ink bg-ink/[0.04]" : "border-ink/20 hover:border-ink/50"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={m.key}
                  checked={method === m.key}
                  onChange={() => setMethod(m.key)}
                  className="mt-1 size-4 accent-[var(--color-ink)]"
                />
                <span>
                  <span className="block font-semibold">{m.label}</span>
                  <span className="mt-0.5 block text-sm text-muted">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-8">
            <label htmlFor={id("gift")} className="text-sm font-semibold">
              {t.checkout.giftCard} <span className="font-normal text-muted">({t.checkout.optional})</span>
            </label>
            <div className="mt-2 flex gap-3">
              <input
                id={id("gift")}
                dir="ltr"
                autoComplete="off"
                placeholder={t.checkout.giftCardCode}
                value={f.giftCardCode ?? ""}
                onChange={(e) => setF((p) => ({ ...p, giftCardCode: e.target.value.toUpperCase() }))}
                className={`${inputClass(false)} mt-0 uppercase placeholder:normal-case rtl:text-right`}
              />
              <button
                type="button"
                disabled={!f.giftCardCode?.trim() || gift.isPending}
                onClick={() => gift.mutate(f.giftCardCode!.trim().toUpperCase())}
                className="shrink-0 rounded-xl border border-ink/25 px-5 text-sm font-semibold hover:border-ink disabled:opacity-40"
              >
                {t.checkout.check}
              </button>
            </div>
            <p role="status" className="mt-1.5 min-h-4 text-xs">
              {gift.data &&
                (gift.data.isValid ? (
                  fmt(t.checkout.giftBalance, { amount: formatPrice(gift.data.currentBalance, lang) })
                ) : (
                  <span className="text-[#d1342f]">{gift.data.message}</span>
                ))}
              {gift.isError && <span className="text-[#d1342f]">{errorMessage(gift.error, t)}</span>}
            </p>
          </div>
        </fieldset>
      </div>

      {/* Summary */}
      <aside aria-labelledby={id("summary")} className="self-start rounded-2xl bg-panel p-6 lg:sticky lg:top-32 dark:ring-1 dark:ring-white/8">
        <h2 id={id("summary")} className="display text-2xl">
          {t.checkout.summary}
        </h2>
        <ul className="mt-5 max-h-72 divide-y divide-ink/10 overflow-y-auto overscroll-contain" data-lenis-prevent>
          {cart.items.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-3">
              <div className="relative grid aspect-[4/5] w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-canvas/60">
                {line.product.primaryImage ? (
                  <Image src={line.product.primaryImage.url} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <span aria-hidden lang="en" className="display text-xs text-soft">
                    {line.product.name.slice(0, 2)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p lang={isFallback(lang, line.product.nameAr) ? "en" : undefined} className="truncate font-semibold">
                  {localized(lang, line.product.name, line.product.nameAr)}
                </p>
                <p className="text-muted">
                  {line.variant && <span lang={isFallback(lang, line.variant.nameAr) ? "en" : undefined}>{localized(lang, line.variant.name, line.variant.nameAr)} · </span>}× {line.quantity}
                </p>
              </div>
              <p className="text-sm tabular-nums">{formatPrice(line.lineTotal, lang)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-ink/15 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t.cart.subtotal}</dt>
            <dd className="tabular-nums">{formatPrice(cart.subtotal, lang)}</dd>
          </div>
          {cart.discountAmount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">
                {t.cart.discount} {cart.coupon?.code && <span dir="ltr">({cart.coupon.code})</span>}
              </dt>
              <dd className="tabular-nums">−{formatPrice(cart.discountAmount, lang)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted">
              {t.checkout.shipping}
              {rate.data && <span className="block text-xs">{fmt(t.checkout.days, { days: rate.data.estimatedDays })}</span>}
            </dt>
            <dd className="text-end tabular-nums">
              {!f.governorate
                ? <span className="text-muted">{t.checkout.shippingTbd}</span>
                : rate.isPending
                  ? "…"
                  : rate.data
                    ? rate.data.fee === 0
                      ? t.checkout.free
                      : formatPrice(rate.data.fee, lang)
                    : "—"}
            </dd>
          </div>
          {giftAmount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">{t.checkout.giftApplied}</dt>
              <dd className="tabular-nums">−{formatPrice(giftAmount, lang)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-ink/15 pt-3 text-base font-semibold">
            <dt>{t.checkout.total}</dt>
            <dd className="tabular-nums">{formatPrice(total, lang)}</dd>
          </div>
        </dl>
        {noZone && (
          <p className="mt-3 text-xs font-semibold text-[#d1342f]">
            {fmt(t.checkout.noDelivery, {
              place: GOVERNORATES.find((g) => g.value === f.governorate)?.[lang === "ar" ? "ar" : "value"] ?? f.governorate,
            })}
          </p>
        )}
        {rate.data?.amountToFreeShipping ? (
          <p className="mt-3 text-xs text-muted">
            {fmt(t.checkout.freeAbove, { amount: formatPrice(rate.data.freeShippingThreshold ?? 0, lang) })}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || noZone || !cart.canCheckout}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-blue px-6 py-4 font-semibold text-haze transition-colors hover:bg-blue-deep disabled:opacity-50 dark:shadow-[0_0_40px_-8px_rgba(27,68,255,0.7)]"
        >
          {redirecting
            ? t.checkout.redirecting
            : place.isPending
              ? t.checkout.placing
              : method === "COD"
                ? t.checkout.place
                : t.checkout.placeAndPay}
        </button>
        <p className="mt-3 text-center text-xs text-muted">{t.checkout.terms}</p>

        <div role="alert" className="mt-3 text-sm text-[#d1342f]">
          {Object.values(errors).some(Boolean) && <p>{t.checkout.fixFields}</p>}
          {place.isError &&
            (serverErrors.length && lang === "en" ? (
              <ul className="list-disc space-y-1 ps-5">
                {serverErrors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            ) : (
              <p>{errorMessage(place.error, t)}</p>
            ))}
        </div>
      </aside>
    </form>
  );
}
