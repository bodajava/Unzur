"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate, formatPrice } from "@/i18n/format";
import { marketingApi, useCoupons, useMarketingChange } from "@/lib/admin/api";
import type { Coupon, CouponInput, CouponStatus, CouponTarget } from "@/lib/admin/types";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { MONEY, toEgp, toPiasters } from "./money";
import { Panel, Skeleton } from "./ui";

const STATUS_TONE: Record<CouponStatus, string> = {
  ACTIVE: "bg-[#1f9d55]/14 text-[#16773f] dark:text-[#7ee2a8]",
  SCHEDULED: "bg-blue/12 text-blue dark:text-[#a3b3ff]",
  EXPIRED: "bg-ink/8 text-muted",
  INACTIVE: "bg-ink/8 text-muted",
  EXHAUSTED: "bg-[#f5b301]/15 text-[#a87900] dark:text-[#ffd45c]",
};

/** YYYY-MM-DD of a moment, in Cairo (the store's calendar). */
const cairoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d);
const day = (iso?: string) => (iso ? cairoDay(new Date(iso)) : "");
const today = () => cairoDay(new Date());
const plusDays = (n: number) => cairoDay(new Date(Date.now() + n * 86_400_000));
/** Dates are whole days in Cairo: a coupon starts at 00:00 and ends at 23:59. */
const startOf = (d: string) => `${d}T00:00:00+02:00`;
const endOf = (d: string) => `${d}T23:59:59+02:00`;

interface Draft {
  code: string;
  description: string;
  discountType: Coupon["discountType"];
  value: string;
  minOrder: string;
  maxDiscount: string;
  usageLimit: string;
  perUser: string;
  starts: string;
  expires: string;
  isActive: boolean;
}

const fromCoupon = (c?: Coupon): Draft => ({
  code: c?.code ?? "",
  description: c?.description ?? "",
  discountType: c?.discountType ?? "PERCENTAGE",
  value: c ? (c.discountType === "PERCENTAGE" ? String(c.discountValue) : toEgp(c.discountValue)) : "",
  minOrder: c && c.minOrderAmount > 0 ? toEgp(c.minOrderAmount) : "",
  maxDiscount: toEgp(c?.maxDiscountAmount),
  usageLimit: c?.usageLimit ? String(c.usageLimit) : "",
  perUser: String(c?.perUserLimit ?? 1),
  starts: day(c?.startsAt) || today(),
  expires: day(c?.expiresAt) || plusDays(30),
  isActive: c?.isActive ?? true,
});

const field = "mt-1.5 w-full rounded-xl border border-ink/20 bg-transparent px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none aria-[invalid=true]:border-[#d1342f]";

function CouponEditor({ coupon, onDone }: { coupon?: Coupon; onDone: () => void }) {
  const { t } = useI18n();
  const tm = t.admin.marketing;
  const [d, setD] = useState<Draft>(() => fromCoupon(coupon));
  const [bad, setBad] = useState<string[]>([]);
  const save = useMarketingChange("coupons", (input: CouponInput) =>
    coupon ? marketingApi.updateCoupon(coupon.id, input) : marketingApi.createCoupon(input),
  );
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setD({ ...d, [k]: e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const pct = d.discountType === "PERCENTAGE";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const wrong: string[] = [];
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(d.code.trim())) wrong.push("code");
    if (pct ? !/^\d{1,3}$/.test(d.value) || +d.value < 1 || +d.value > 100 : !MONEY.test(d.value) || toPiasters(d.value) < 1) wrong.push("value");
    if (d.minOrder && !MONEY.test(d.minOrder)) wrong.push("minOrder");
    if (d.maxDiscount && !MONEY.test(d.maxDiscount)) wrong.push("maxDiscount");
    if (d.usageLimit && !/^\d+$/.test(d.usageLimit)) wrong.push("usageLimit");
    if (!/^\d+$/.test(d.perUser)) wrong.push("perUser");
    if (!d.starts || !d.expires || d.expires < d.starts) wrong.push("expires");
    setBad(wrong);
    if (wrong.length) return;
    const nullable = (v: string, toNum: (s: string) => number) => (v ? toNum(v) : coupon ? null : undefined);
    save.mutate(
      {
        code: d.code.trim().toUpperCase(),
        description: d.description.trim() || (coupon ? null : undefined),
        discountType: d.discountType,
        discountValue: pct ? Number(d.value) : toPiasters(d.value),
        minOrderAmount: d.minOrder ? toPiasters(d.minOrder) : coupon ? 0 : undefined,
        maxDiscountAmount: pct ? nullable(d.maxDiscount, toPiasters) : coupon ? null : undefined,
        usageLimit: nullable(d.usageLimit, Number),
        perUserLimit: Number(d.perUser),
        startsAt: startOf(d.starts),
        expiresAt: endOf(d.expires),
        isActive: d.isActive,
      },
      { onSuccess: onDone },
    );
  };

  const serverErrors = save.error instanceof ApiError && Array.isArray(save.error.errors) ? (save.error.errors as string[]) : [];
  const inv = (k: string) => bad.includes(k) || undefined;
  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-ink/15 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold sm:col-span-2">
          {tm.code}
          <input value={d.code} onChange={set("code")} dir="ltr" aria-invalid={inv("code")} className={`${field} uppercase rtl:text-right`} />
          <span className="mt-1 block text-xs font-normal text-muted">{tm.codeHint}</span>
        </label>
        <label className="text-sm font-semibold">
          {tm.type}
          <select value={d.discountType} onChange={set("discountType")} className={field}>
            <option value="PERCENTAGE" className="bg-canvas">{tm.percentage}</option>
            <option value="FIXED_AMOUNT" className="bg-canvas">{tm.fixed}</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          {pct ? tm.valuePct : tm.valueEgp}
          <input value={d.value} onChange={set("value")} inputMode="decimal" dir="ltr" aria-invalid={inv("value")} className={`${field} rtl:text-right`} />
        </label>
        <label className="text-sm font-semibold">
          {tm.minOrder}
          <input value={d.minOrder} onChange={set("minOrder")} inputMode="decimal" dir="ltr" aria-invalid={inv("minOrder")} className={`${field} rtl:text-right`} />
        </label>
        {pct && (
          <label className="text-sm font-semibold">
            {tm.maxDiscount}
            <input value={d.maxDiscount} onChange={set("maxDiscount")} placeholder={tm.unlimited} inputMode="decimal" dir="ltr" aria-invalid={inv("maxDiscount")} className={`${field} rtl:text-right`} />
          </label>
        )}
        <label className="text-sm font-semibold">
          {tm.usageLimit}
          <input value={d.usageLimit} onChange={set("usageLimit")} placeholder={tm.unlimited} inputMode="numeric" dir="ltr" aria-invalid={inv("usageLimit")} className={`${field} rtl:text-right`} />
        </label>
        <label className="text-sm font-semibold">
          {tm.perUser}
          <input value={d.perUser} onChange={set("perUser")} inputMode="numeric" dir="ltr" aria-invalid={inv("perUser")} className={`${field} rtl:text-right`} />
        </label>
        <label className="text-sm font-semibold">
          {tm.starts}
          <input type="date" value={d.starts} onChange={set("starts")} className={field} />
        </label>
        <label className="text-sm font-semibold">
          {tm.expires}
          <input type="date" value={d.expires} min={d.starts} onChange={set("expires")} aria-invalid={inv("expires")} className={field} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          {tm.description}
          <input value={d.description} onChange={set("description")} className={field} />
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input type="checkbox" checked={d.isActive} onChange={set("isActive")} className="size-4 accent-[var(--color-ink)]" />
          {tm.active}
        </label>
      </div>
      {bad.length > 0 && <p className="mt-3 text-xs text-[#d1342f]">{tm.invalidValue}</p>}
      {save.isError && <p lang={serverErrors.length ? "en" : undefined} className="mt-3 text-xs text-[#d1342f]">{serverErrors.length ? serverErrors.join(" · ") : errorMessage(save.error, t)}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm hover:bg-ink/8">{tm.cancel}</button>
        <button type="submit" disabled={save.isPending} className="rounded-full bg-blue px-5 py-2 text-sm font-semibold text-haze hover:bg-blue-deep disabled:opacity-50">
          {save.isPending ? tm.saving : tm.save}
        </button>
      </div>
    </form>
  );
}

function SendForm({ coupon, onDone }: { coupon: Coupon; onDone: () => void }) {
  const { t } = useI18n();
  const tm = t.admin.marketing;
  const [target, setTarget] = useState<CouponTarget>("SPECIFIC_EMAILS");
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const send = useMarketingChange("coupons", marketingApi.sendCoupon);
  return (
    <form
      className="mt-3 rounded-2xl border border-ink/15 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const list = emails.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
        if (target === "SPECIFIC_EMAILS" && !list.length) return;
        send.mutate({ couponId: coupon.id, target, emails: target === "SPECIFIC_EMAILS" ? list : undefined, message: message.trim() || undefined });
      }}
    >
      <p className="text-sm font-semibold">{fmt(tm.sendTitle, { code: coupon.code })}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {(Object.keys(tm.targets) as CouponTarget[]).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <input type="radio" name={`target-${coupon.id}`} checked={target === k} onChange={() => setTarget(k)} className="accent-[var(--color-ink)]" />
            {tm.targets[k]}
          </label>
        ))}
      </div>
      {target === "SPECIFIC_EMAILS" && (
        <label className="mt-3 block text-sm">
          {tm.emails}
          <textarea rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} dir="ltr" className={`${field} rtl:text-right`} />
        </label>
      )}
      <label className="mt-3 block text-sm">
        {tm.message}
        <input value={message} onChange={(e) => setMessage(e.target.value)} className={field} />
      </label>
      <div className="mt-4 flex items-center justify-end gap-3">
        <span role="status" className="text-xs">
          {send.isSuccess && <span className="text-[#16773f] dark:text-[#7ee2a8]">{fmt(tm.sent, { count: send.data.recipients })}</span>}
          {send.isError && <span className="text-[#d1342f]">{errorMessage(send.error, t)}</span>}
        </span>
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm hover:bg-ink/8">{tm.cancel}</button>
        <button type="submit" disabled={send.isPending} className="rounded-full bg-blue px-5 py-2 text-sm font-semibold text-haze disabled:opacity-50">
          {send.isPending ? tm.sending : tm.sendNow}
        </button>
      </div>
    </form>
  );
}

export function CouponsManager() {
  const { lang, t } = useI18n();
  const tm = t.admin.marketing;
  const [page, setPage] = useState(1);
  const coupons = useCoupons({ page, limit: 20, sort: "-createdAt" });
  const [editing, setEditing] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const remove = useMarketingChange("coupons", marketingApi.removeCoupon);
  const data = coupons.data;

  const valueText = (c: Coupon) => (c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : formatPrice(c.discountValue, lang));

  return (
    <Panel
      title={tm.coupons}
      action={
        editing !== "new" && (
          <button type="button" onClick={() => setEditing("new")} className="rounded-full border border-ink/25 px-4 py-1.5 text-sm hover:border-ink">
            + {tm.add}
          </button>
        )
      }
    >
      <p className="mb-4 text-sm text-muted">{tm.couponsHint}</p>
      {editing === "new" && <div className="mb-4"><CouponEditor onDone={() => setEditing(null)} /></div>}
      {notice && <p className="mb-3 text-sm text-[#a87900] dark:text-[#ffd45c]">{notice}</p>}
      {coupons.isError && <p className="text-sm text-[#d1342f]">{errorMessage(coupons.error, t)}</p>}
      {!data ? (
        <Skeleton className="h-40" />
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted">{tm.noCoupons}</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {data.items.map((c) => (
            <li key={c.id} className="py-3">
              {editing === c.id ? (
                <CouponEditor coupon={c} onDone={() => setEditing(null)} />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span dir="ltr" className="font-mono text-base font-semibold tracking-wide">{c.code}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[c.status]}`}>{tm.status[c.status]}</span>
                    <span className="text-sm font-semibold tabular-nums">{valueText(c)}</span>
                    <span className="text-xs text-muted">
                      {c.usageLimit ? fmt(tm.usedOf, { used: c.usedCount, limit: c.usageLimit }) : fmt(tm.used, { used: c.usedCount })}
                      {" · "}
                      {formatDate(c.startsAt, lang)} – {formatDate(c.expiresAt, lang)}
                    </span>
                    <span className="ms-auto flex gap-1">
                      <button type="button" onClick={() => setSending(sending === c.id ? null : c.id)} className="rounded-full px-3 py-1.5 text-sm hover:bg-ink/8">{tm.send}</button>
                      <button type="button" onClick={() => setEditing(c.id)} className="rounded-full px-3 py-1.5 text-sm hover:bg-ink/8">{tm.edit}</button>
                      <button
                        type="button"
                        disabled={remove.isPending}
                        onClick={() =>
                          window.confirm(fmt(tm.removeConfirm, { code: c.code })) &&
                          remove.mutate(c.id, { onSuccess: (r) => setNotice(r.deactivated ? fmt(tm.removedOff, { code: c.code }) : null) })
                        }
                        className="rounded-full px-3 py-1.5 text-sm text-[#b02a26] hover:bg-[#d1342f]/8 dark:text-[#ff8f8a]"
                      >
                        {tm.remove}
                      </button>
                    </span>
                  </div>
                  {c.description && <p className="mt-1 text-xs text-muted">{c.description}</p>}
                  {sending === c.id && <SendForm coupon={c} onDone={() => setSending(null)} />}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {remove.isError && <p className="mt-2 text-xs text-[#d1342f]">{errorMessage(remove.error, t)}</p>}
      {data && data.meta.totalPages > 1 && (
        <nav aria-label={t.shop.pagination} className="mt-4 flex items-center justify-between">
          <button type="button" disabled={!data.meta.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-ink/25 px-4 py-1.5 text-sm disabled:opacity-30">{t.shop.prev}</button>
          <span className="text-xs text-muted tabular-nums">{data.meta.page} / {data.meta.totalPages}</span>
          <button type="button" disabled={!data.meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-ink/25 px-4 py-1.5 text-sm disabled:opacity-30">{t.shop.next}</button>
        </nav>
      )}
    </Panel>
  );
}
