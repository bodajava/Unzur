"use client";

import { useId, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate, formatPrice, plural } from "@/i18n/format";
import { errorMessage } from "@/lib/api/errors";
import {
  useAddresses,
  useApplyReferral,
  useBuyGiftCard,
  useChangePassword,
  useLoyalty,
  useMyGiftCards,
  useRedeemPoints,
  useReferrals,
  useRemoveAddress,
  useSaveAddress,
  useSetDefaultAddress,
} from "@/lib/api/hooks";
import type { Address, AddressInput, LoyaltyRedemption } from "@/lib/api/types";
import { GOVERNORATES } from "@/lib/governorates";

const field =
  "mt-2 w-full rounded-xl border border-ink/25 bg-transparent px-4 py-3 hover:border-ink/50 focus:border-ink focus:outline-none";
const primary =
  "rounded-full bg-blue px-6 py-3 text-sm font-semibold text-haze hover:bg-blue-deep disabled:opacity-60";
const ERROR = "text-[#d1342f]";
const PHONE = /^(?:\+?20)?01[0125][0-9]{8}$|^\+?[1-9][0-9]{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Skeleton() {
  return <div className="h-48 animate-pulse rounded-2xl bg-panel" />;
}

function Label({ htmlFor, children, optional }: { htmlFor: string; children: ReactNode; optional?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold">
      {children}
      {optional && <span className="font-normal text-muted"> ({optional})</span>}
    </label>
  );
}

function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="nav-link text-xs"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? done : label}
    </button>
  );
}

// ───────────────────────── password ─────────────────────────

/** Change password while signed in (the session is renewed by the API). */
export function PasswordForm() {
  const { t } = useI18n();
  const ta = t.account;
  const change = useChangePassword();
  const id = useId();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <form
      className="max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.next.length < 8) return setProblem(ta.tooShort);
        if (f.next !== f.confirm) return setProblem(ta.mismatch);
        setProblem(null);
        change.mutate(
          { currentPassword: f.current, newPassword: f.next },
          { onSuccess: () => setF({ current: "", next: "", confirm: "" }) },
        );
      }}
    >
      <h2 className="text-sm font-semibold">{ta.passwordTitle}</h2>
      {(
        [
          ["current", ta.currentPassword, "current-password"],
          ["next", ta.newPassword, "new-password"],
          ["confirm", ta.confirmPassword, "new-password"],
        ] as const
      ).map(([k, label, auto]) => (
        <div key={k} className="mt-5">
          <Label htmlFor={`${id}-${k}`}>{label}</Label>
          <input
            id={`${id}-${k}`}
            type="password"
            dir="ltr"
            required
            autoComplete={auto}
            value={f[k]}
            onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))}
            className={field}
          />
          {k === "next" && <p className="mt-1.5 text-xs text-muted">{ta.passwordHint}</p>}
        </div>
      ))}
      <button type="submit" disabled={change.isPending} className={`mt-8 ${primary}`}>
        {change.isPending ? ta.saving : ta.changePassword}
      </button>
      <p role="status" className="mt-3 min-h-5 text-sm">
        {problem && <span className={ERROR}>{problem}</span>}
        {!problem && change.isSuccess && ta.passwordChanged}
        {!problem && change.isError && <span className={ERROR}>{errorMessage(change.error, t)}</span>}
      </p>
    </form>
  );
}

// ───────────────────────── addresses ─────────────────────────

type AddressForm = {
  label: string;
  fullName: string;
  phone: string;
  governorate: string;
  city: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
  notes: string;
  isDefault: boolean;
};

const emptyAddress = (fullName: string, phone: string): AddressForm => ({
  label: "",
  fullName,
  phone,
  governorate: "",
  city: "",
  street: "",
  building: "",
  floor: "",
  apartment: "",
  notes: "",
  isDefault: false,
});

const fromAddress = (a: Address): AddressForm => ({
  label: a.label,
  fullName: a.fullName,
  phone: a.phone,
  governorate: a.governorate,
  city: a.city,
  street: a.street,
  building: a.building ?? "",
  floor: a.floor ?? "",
  apartment: a.apartment ?? "",
  notes: a.notes ?? "",
  isDefault: a.isDefault,
});

export function Addresses({ fullName, phone }: { fullName: string; phone: string }) {
  const { t, lang } = useI18n();
  const ta = t.account.addresses;
  const list = useAddresses();
  const setDefault = useSetDefaultAddress();
  const remove = useRemoveAddress();
  // null = closed, "new" = adding, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);

  if (list.isError) return <p className={`text-sm ${ERROR}`}>{errorMessage(list.error, t)}</p>;
  if (!list.data) return <Skeleton />;
  const addresses = list.data;
  const govName = (v: string) => {
    const g = GOVERNORATES.find((x) => x.value === v || x.ar === v);
    return g ? (lang === "ar" ? g.ar : g.value) : v;
  };
  const actionError = setDefault.error ?? remove.error;
  const sep = lang === "ar" ? "، " : ", ";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-2xl">{ta.title}</h2>
          <p className="mt-2 max-w-md text-sm text-muted">{ta.intro}</p>
        </div>
        {editing !== "new" && (
          <button type="button" onClick={() => setEditing("new")} className={primary}>
            + {ta.add}
          </button>
        )}
      </div>

      {editing === "new" && (
        <div className="mt-8">
          <AddressEditor
            initial={emptyAddress(fullName, phone)}
            first={addresses.length === 0}
            onDone={() => setEditing(null)}
          />
        </div>
      )}

      {actionError && <p className={`mt-4 text-sm ${ERROR}`}>{errorMessage(actionError, t)}</p>}

      {addresses.length === 0 && editing !== "new" ? (
        <div className="mt-8 rounded-2xl bg-panel px-6 py-14 text-center text-muted">{ta.empty}</div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {addresses.map((a) =>
            editing === a.id ? (
              <li key={a.id} className="md:col-span-2">
                <AddressEditor id={a.id} initial={fromAddress(a)} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={a.id} className="rounded-2xl bg-panel p-5 dark:ring-1 dark:ring-white/8">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{a.label}</p>
                  {a.isDefault && (
                    <span className="eyebrow rounded-full bg-blue px-2.5 py-1 text-[0.65rem] text-haze">
                      {ta.default}
                    </span>
                  )}
                </div>
                <address className="mt-3 text-sm leading-relaxed not-italic text-muted">
                  {a.fullName}
                  <br />
                  <span dir="ltr">{a.phone}</span>
                  <br />
                  {[a.street, a.building && `${ta.building} ${a.building}`, a.floor && `${ta.floor} ${a.floor}`, a.apartment && `${ta.apartment} ${a.apartment}`]
                    .filter(Boolean)
                    .join(sep)}
                  <br />
                  {a.city}
                  {sep}
                  {govName(a.governorate)}
                </address>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <button type="button" className="nav-link" onClick={() => setEditing(a.id)}>
                    {ta.edit}
                  </button>
                  {!a.isDefault && (
                    <button
                      type="button"
                      className="nav-link disabled:opacity-50"
                      disabled={setDefault.isPending}
                      onClick={() => setDefault.mutate(a.id)}
                    >
                      {ta.makeDefault}
                    </button>
                  )}
                  <button
                    type="button"
                    className="nav-link text-muted disabled:opacity-50"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(ta.removeConfirm)) remove.mutate(a.id);
                    }}
                  >
                    {ta.remove}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function AddressEditor({
  id: addressId,
  initial,
  first,
  onDone,
}: {
  id?: string;
  initial: AddressForm;
  first?: boolean;
  onDone: () => void;
}) {
  const { t, lang } = useI18n();
  const ta = t.account.addresses;
  const save = useSaveAddress();
  const uid = useId();
  const [f, setF] = useState<AddressForm>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});
  const set = (k: keyof AddressForm) => (e: { target: { value: string } }) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = () => {
    const e: typeof errors = {};
    for (const k of ["label", "fullName", "governorate", "city", "street"] as const) {
      if (f[k].trim().length < (k === "label" ? 1 : 2)) e[k] = ta.required;
    }
    if (!PHONE.test(f.phone.replace(/[\s-]/g, ""))) e.phone = ta.badPhone;
    setErrors(e);
    if (Object.keys(e).length) return;

    const optional = (v: string) => (v.trim() ? v.trim() : addressId ? null : undefined);
    const input: AddressInput = {
      label: f.label.trim(),
      fullName: f.fullName.trim(),
      phone: f.phone.replace(/[\s-]/g, ""),
      governorate: f.governorate,
      city: f.city.trim(),
      street: f.street.trim(),
      building: optional(f.building),
      floor: optional(f.floor),
      apartment: optional(f.apartment),
      notes: optional(f.notes),
      ...(f.isDefault || first ? { isDefault: true } : {}),
    };
    save.mutate({ id: addressId, input }, { onSuccess: onDone });
  };

  const text = (k: keyof AddressForm, label: string, opts: { optional?: boolean; auto?: string; wide?: boolean; ltr?: boolean; placeholder?: string } = {}) => (
    <div className={opts.wide ? "sm:col-span-2" : ""}>
      <Label htmlFor={`${uid}-${k}`} optional={opts.optional ? ta.optional : undefined}>
        {label}
      </Label>
      <input
        id={`${uid}-${k}`}
        value={f[k] as string}
        onChange={set(k)}
        autoComplete={opts.auto}
        placeholder={opts.placeholder}
        dir={opts.ltr ? "ltr" : "auto"}
        type={k === "phone" ? "tel" : "text"}
        aria-invalid={!!errors[k]}
        className={`${field} rtl:text-right ${errors[k] ? "border-[#d1342f]" : ""}`}
      />
      {errors[k] && <p className={`mt-1.5 text-xs ${ERROR}`}>{errors[k]}</p>}
    </div>
  );

  return (
    <form
      noValidate
      className="rounded-2xl border border-ink/15 p-5 sm:p-7"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {text("label", ta.label, { placeholder: ta.labelPlaceholder })}
        {text("fullName", ta.fullName, { auto: "name" })}
        {text("phone", ta.phone, { auto: "tel", ltr: true })}
        <div>
          <Label htmlFor={`${uid}-governorate`}>{ta.governorate}</Label>
          <select
            id={`${uid}-governorate`}
            autoComplete="address-level1"
            value={f.governorate}
            onChange={set("governorate")}
            aria-invalid={!!errors.governorate}
            className={`${field} appearance-none ${errors.governorate ? "border-[#d1342f]" : ""}`}
          >
            <option value="" disabled className="bg-canvas">
              {ta.choose}
            </option>
            {GOVERNORATES.map((g) => (
              <option key={g.value} value={g.value} className="bg-canvas text-ink">
                {lang === "ar" ? g.ar : g.value}
              </option>
            ))}
          </select>
          {errors.governorate && <p className={`mt-1.5 text-xs ${ERROR}`}>{errors.governorate}</p>}
        </div>
        {text("city", ta.city, { auto: "address-level2" })}
        {text("street", ta.street, { auto: "address-line1", wide: true })}
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          {text("building", ta.building, { optional: true })}
          {text("floor", ta.floor, { optional: true })}
          {text("apartment", ta.apartment, { optional: true })}
        </div>
        {text("notes", ta.notes, { optional: true, wide: true })}
      </div>
      {!first && !initial.isDefault && (
        <label className="mt-5 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={f.isDefault}
            onChange={(e) => setF((s) => ({ ...s, isDefault: e.target.checked }))}
            className="size-4 accent-[var(--color-blue,#1b44ff)]"
          />
          {ta.setDefault}
        </label>
      )}
      <div className="mt-7 flex flex-wrap items-center gap-5">
        <button type="submit" disabled={save.isPending} className={primary}>
          {save.isPending ? ta.saving : ta.save}
        </button>
        <button type="button" onClick={onDone} className="nav-link text-sm">
          {ta.cancel}
        </button>
      </div>
      {save.isError && <p className={`mt-3 text-sm ${ERROR}`}>{errorMessage(save.error, t)}</p>}
    </form>
  );
}

// ───────────────────────── points & referrals ─────────────────────────

export function Rewards() {
  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <Points />
      <Referrals />
    </div>
  );
}

function Points() {
  const { t, lang } = useI18n();
  const tr = t.account.rewards;
  const [page, setPage] = useState(1);
  const loyalty = useLoyalty({ page, limit: 10 });
  const redeem = useRedeemPoints();
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState<LoyaltyRedemption | null>(null);
  const uid = useId();

  if (loyalty.isError) return <p className={`text-sm ${ERROR}`}>{errorMessage(loyalty.error, t)}</p>;
  if (!loyalty.data) return <Skeleton />;
  const l = loyalty.data;
  const canRedeem = l.points >= l.minRedeemPoints;
  const wanted = Number(amount);
  const valid = Number.isInteger(wanted) && wanted >= l.minRedeemPoints && wanted <= l.points;

  return (
    <section aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="display text-2xl">
        {tr.pointsTitle}
      </h2>
      <div className="mt-6 rounded-2xl bg-blue p-6 text-haze">
        <p className="eyebrow opacity-80">{tr.balance}</p>
        <p className="display mt-2 text-5xl tabular-nums">{l.points.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</p>
        <p className="mt-2 text-sm opacity-85">{fmt(tr.worth, { amount: formatPrice(l.valuePiasters, lang) })}</p>
      </div>
      <p className="mt-4 text-sm text-muted">{tr.howEarn}</p>

      {canRedeem ? (
        <form
          className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            redeem.mutate(wanted, {
              onSuccess: (r) => {
                setCode(r);
                setAmount("");
              },
            });
          }}
        >
          <div className="min-w-40 flex-1">
            <Label htmlFor={`${uid}-points`}>{tr.redeemLabel}</Label>
            <input
              id={`${uid}-points`}
              type="number"
              inputMode="numeric"
              min={l.minRedeemPoints}
              max={l.points}
              step={1}
              dir="ltr"
              value={amount}
              placeholder={String(l.points)}
              onChange={(e) => setAmount(e.target.value)}
              className={field}
            />
          </div>
          <button type="submit" disabled={!valid || redeem.isPending} className={primary}>
            {redeem.isPending ? tr.redeeming : tr.redeem}
          </button>
          <p className="w-full text-xs text-muted">{fmt(tr.redeemHint, { min: l.minRedeemPoints })}</p>
        </form>
      ) : (
        <p className="mt-6 text-sm text-muted">{fmt(tr.notEnough, { min: l.minRedeemPoints })}</p>
      )}
      {redeem.isError && <p className={`mt-3 text-sm ${ERROR}`}>{errorMessage(redeem.error, t)}</p>}
      {code && (
        <div role="status" className="mt-5 rounded-2xl border-2 border-blue p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">
              {fmt(tr.codeReady, { code: "" })}
              <span lang="en" dir="ltr" className="font-mono">
                {code.couponCode}
              </span>
            </p>
            <CopyButton text={code.couponCode} label={tr.copy} done={tr.copied} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {fmt(tr.codeWorth, { amount: formatPrice(code.discountValue, lang), date: formatDate(code.expiresAt, lang) })}
          </p>
        </div>
      )}

      <h3 className="mt-10 text-sm font-semibold">{tr.history}</h3>
      {l.history.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{tr.historyEmpty}</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-ink/10 rounded-2xl bg-panel px-5 dark:ring-1 dark:ring-white/8">
            {l.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <p>{tr.types[h.type as keyof typeof tr.types] ?? h.type}</p>
                  <p className="text-xs text-muted">{formatDate(h.createdAt, lang)}</p>
                </div>
                <span className={`font-semibold tabular-nums ${h.points < 0 ? "text-muted" : ""}`} dir="ltr">
                  {h.points > 0 ? "+" : ""}
                  {h.points}
                </span>
              </li>
            ))}
          </ul>
          {l.meta.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-4 text-sm">
              <button type="button" disabled={!l.meta.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="nav-link disabled:opacity-40">
                ‹
              </button>
              <span className="tabular-nums">
                {l.meta.page} / {l.meta.totalPages}
              </span>
              <button type="button" disabled={!l.meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="nav-link disabled:opacity-40">
                ›
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Referrals() {
  const { t, lang, href } = useI18n();
  const tr = t.account.rewards;
  const refs = useReferrals();
  const apply = useApplyReferral();
  const [friendCode, setFriendCode] = useState("");
  const uid = useId();

  if (refs.isError) return <p className={`text-sm ${ERROR}`}>{errorMessage(refs.error, t)}</p>;
  if (!refs.data) return <Skeleton />;
  const r = refs.data;
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}${href("/account")}`;
  const shareText = fmt(tr.shareText, { code: r.referralCode, url: shareUrl });

  return (
    <section aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="display text-2xl">
        {tr.referTitle}
      </h2>
      <p className="mt-4 text-sm text-muted">{fmt(tr.referIntro, { points: r.bonusPoints })}</p>
      <div className="mt-6 rounded-2xl bg-panel p-6 dark:ring-1 dark:ring-white/8">
        <p className="eyebrow text-muted">{tr.yourCode}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <p lang="en" dir="ltr" className="font-mono text-3xl font-semibold tracking-wider">
            {r.referralCode}
          </p>
          <div className="flex items-center gap-5">
            <CopyButton text={r.referralCode} label={tr.copy} done={tr.copied} />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link text-xs"
            >
              {tr.share} · WhatsApp
            </a>
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm font-semibold">{plural(lang, tr.invited, r.totalReferrals)}</p>
      {r.referrals.length > 0 && (
        <ul className="mt-3 divide-y divide-ink/10 rounded-2xl bg-panel px-5 dark:ring-1 dark:ring-white/8">
          {r.referrals.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <p>{x.name}</p>
                <p className="text-xs text-muted">{formatDate(x.joinedAt, lang)}</p>
              </div>
              <span className={`text-xs ${x.rewarded ? "font-semibold text-blue" : "text-muted"}`}>
                {x.rewarded ? tr.rewarded : tr.waiting}
              </span>
            </li>
          ))}
        </ul>
      )}

      {r.canApplyCode && (
        <form
          className="mt-8 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const code = friendCode.trim().toUpperCase();
            if (code) apply.mutate(code, { onSuccess: () => setFriendCode("") });
          }}
        >
          <div className="min-w-40 flex-1">
            <Label htmlFor={`${uid}-friend`}>{tr.haveCode}</Label>
            <input
              id={`${uid}-friend`}
              dir="ltr"
              autoCapitalize="characters"
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value)}
              className={`${field} font-mono uppercase`}
            />
          </div>
          <button type="submit" disabled={!friendCode.trim() || apply.isPending} className={primary}>
            {apply.isPending ? tr.applying : tr.apply}
          </button>
        </form>
      )}
      <p role="status" className="mt-3 min-h-5 text-sm">
        {apply.isSuccess && fmt(tr.applied, { points: apply.data.bonusPoints })}
        {apply.isError && <span className={ERROR}>{errorMessage(apply.error, t)}</span>}
      </p>
    </section>
  );
}

// ───────────────────────── gift cards ─────────────────────────

const PRESETS = [500, 1000, 2000, 5000]; // EGP

export function GiftCards() {
  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <BuyGiftCard />
      <MyGiftCards />
    </div>
  );
}

function BuyGiftCard() {
  const { t, lang } = useI18n();
  const tg = t.account.giftCards;
  const buy = useBuyGiftCard();
  const uid = useId();
  const [preset, setPreset] = useState<number | null>(1000);
  const [custom, setCustom] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const egp = preset ?? Number(custom);
  const piasters = Math.round(egp * 100);
  const amountOk = Number.isFinite(egp) && piasters >= 5_000 && piasters <= 1_000_000;

  return (
    <form
      noValidate
      aria-labelledby={`${uid}-title`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!amountOk) return setProblem(tg.badAmount);
        if (recipient.trim() && !EMAIL.test(recipient.trim())) return setProblem(tg.badEmail);
        setProblem(null);
        buy.mutate(
          {
            amountPiasters: piasters,
            recipientEmail: recipient.trim() || undefined,
            message: message.trim() || undefined,
            paymentMethod: "PAYMOB_CARD",
          },
          {
            onSuccess: (r) => {
              if (r.payment?.checkoutUrl) window.location.assign(r.payment.checkoutUrl);
            },
          },
        );
      }}
    >
      <h2 id={`${uid}-title`} className="display text-2xl">
        {tg.buyTitle}
      </h2>
      <p className="mt-4 text-sm text-muted">{tg.buyIntro}</p>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">{tg.amount}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              onClick={() => {
                setPreset(p);
                setCustom("");
              }}
              className={`rounded-full border px-4 py-2 text-sm tabular-nums transition-colors ${preset === p ? "border-ink bg-ink text-canvas" : "border-ink/25 hover:border-ink"}`}
            >
              {formatPrice(p * 100, lang)}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Label htmlFor={`${uid}-custom`}>{tg.custom}</Label>
          <input
            id={`${uid}-custom`}
            type="number"
            inputMode="decimal"
            min={50}
            max={10000}
            dir="ltr"
            value={custom}
            onFocus={() => setPreset(null)}
            onChange={(e) => {
              setPreset(null);
              setCustom(e.target.value);
            }}
            className={field}
          />
          <p className="mt-1.5 text-xs text-muted">{tg.amountHint}</p>
        </div>
      </fieldset>

      <div className="mt-5">
        <Label htmlFor={`${uid}-to`}>{tg.recipient}</Label>
        <input
          id={`${uid}-to`}
          type="email"
          dir="ltr"
          autoComplete="off"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className={field}
        />
        <p className="mt-1.5 text-xs text-muted">{tg.recipientHint}</p>
      </div>
      <div className="mt-5">
        <Label htmlFor={`${uid}-msg`}>{tg.message}</Label>
        <textarea
          id={`${uid}-msg`}
          rows={3}
          maxLength={300}
          dir="auto"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${field} resize-none`}
        />
      </div>

      <button type="submit" disabled={buy.isPending || buy.isSuccess} className={`mt-7 ${primary}`}>
        {buy.isPending || buy.isSuccess ? tg.paying : fmt(tg.pay, { amount: amountOk ? formatPrice(piasters, lang) : "" })}
      </button>
      <p role="status" className="mt-3 min-h-5 text-sm">
        {problem && <span className={ERROR}>{problem}</span>}
        {!problem && buy.isError && <span className={ERROR}>{errorMessage(buy.error, t)}</span>}
      </p>
    </form>
  );
}

function MyGiftCards() {
  const { t, lang } = useI18n();
  const tg = t.account.giftCards;
  const cards = useMyGiftCards();
  const uid = useId();

  return (
    <section aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="display text-2xl">
        {tg.mineTitle}
      </h2>
      {cards.isError ? (
        <p className={`mt-4 text-sm ${ERROR}`}>{errorMessage(cards.error, t)}</p>
      ) : !cards.data ? (
        <div className="mt-6">
          <Skeleton />
        </div>
      ) : cards.data.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-panel px-6 py-10 text-center text-sm text-muted">{tg.mineEmpty}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {cards.data.map((c) => {
            const unpaid = !c.code;
            return (
              <li key={c.id} className="rounded-2xl bg-panel p-5 dark:ring-1 dark:ring-white/8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="display text-xl tabular-nums">{formatPrice(c.initialBalance, lang)}</p>
                  <span className="text-xs text-muted">
                    {c.recipientEmail ? (
                      <span dir="ltr">{fmt(tg.to, { email: c.recipientEmail })}</span>
                    ) : (
                      tg.toYou
                    )}
                  </span>
                </div>
                {unpaid ? (
                  <p className="mt-2 text-sm text-muted">{tg.waitingPayment}</p>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span lang="en" dir="ltr" className="font-mono text-sm tracking-wide">
                        {c.code}
                      </span>
                      <CopyButton text={c.code ?? ""} label={tg.copy} done={tg.copied} />
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {fmt(tg.balance, { left: formatPrice(c.currentBalance, lang), total: formatPrice(c.initialBalance, lang) })}
                      {c.expiresAt && ` · ${fmt(tg.expires, { date: formatDate(c.expiresAt, lang) })}`}
                      {!c.isActive && ` · ${tg.inactive}`}
                    </p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
