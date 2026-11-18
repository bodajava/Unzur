"use client";

import { useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { errorMessage } from "@/lib/api/errors";
import { useContact } from "@/lib/api/hooks";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Egyptian mobile: 01X XXXX XXXX, with or without +20. */
const PHONE = /^(\+20|0020|0)?1[0125]\d{8}$/;

/**
 * Written like a new email: "To" the store, "From" the visitor's email, their
 * phone, and the message. It lands in Dashboard → Messages and the store inbox.
 */
export function ContactForm({ to }: { to: string | null }) {
  const { t } = useI18n();
  const tc = t.contact;
  const send = useContact();
  const uid = useId();
  const [form, setForm] = useState({ email: "", phone: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  const row = "flex flex-col gap-1 border-b border-ink/10 px-5 py-3 sm:flex-row sm:items-center sm:gap-4";
  const label = "w-28 shrink-0 text-xs font-semibold text-muted";
  const input = "w-full min-w-0 bg-transparent py-1 text-base focus:outline-none";

  if (sentTo) {
    return (
      <div role="status" className="rounded-2xl bg-panel px-6 py-14 text-center dark:ring-1 dark:ring-white/8">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-blue text-xl text-haze">
          ✓
        </span>
        <h2 className="mt-5 text-xl font-semibold">{tc.sentTitle}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{fmt(tc.sentBody, { email: "⁨" + sentTo + "⁩" })}</p>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            setForm((f) => ({ ...f, message: "" }));
          }}
          className="nav-link mt-6 text-sm"
        >
          {tc.another}
        </button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="overflow-hidden rounded-2xl bg-panel dark:ring-1 dark:ring-white/8"
      onSubmit={(e) => {
        e.preventDefault();
        const email = form.email.trim();
        const phone = form.phone.replace(/[\s-]/g, "");
        const message = form.message.trim();
        const next = {
          email: EMAIL.test(email) ? undefined : tc.badEmail,
          phone: PHONE.test(phone) ? undefined : tc.badPhone,
          message: message.length >= 5 ? undefined : tc.shortMessage,
        };
        setErrors(next);
        if (next.email || next.phone || next.message) return;
        send.mutate({ email, phone, message }, { onSuccess: () => setSentTo(email) });
      }}
    >
      {to && (
        <div className={row}>
          <span className={label}>{tc.to}</span>
          <span dir="ltr" className="text-sm font-semibold rtl:text-right">
            {to}
          </span>
        </div>
      )}
      <div className={row}>
        <label htmlFor={`${uid}-email`} className={label}>
          {tc.from}
        </label>
        <input
          id={`${uid}-email`}
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? `${uid}-email-err` : undefined}
          className={`${input} rtl:text-right`}
        />
      </div>
      {errors.email && (
        <p id={`${uid}-email-err`} className="px-5 pt-2 text-xs text-[#d1342f]">
          {errors.email}
        </p>
      )}
      <div className={row}>
        <label htmlFor={`${uid}-phone`} className={label}>
          {tc.phone}
        </label>
        <input
          id={`${uid}-phone`}
          type="tel"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? `${uid}-phone-err` : undefined}
          className={`${input} rtl:text-right`}
        />
      </div>
      {errors.phone && (
        <p id={`${uid}-phone-err`} className="px-5 pt-2 text-xs text-[#d1342f]">
          {errors.phone}
        </p>
      )}
      <label htmlFor={`${uid}-message`} className="sr-only">
        {tc.message}
      </label>
      <textarea
        id={`${uid}-message`}
        required
        rows={9}
        dir="auto"
        placeholder={tc.messagePlaceholder}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        aria-invalid={!!errors.message}
        aria-describedby={errors.message ? `${uid}-message-err` : undefined}
        className="block w-full resize-y bg-transparent px-5 py-4 text-base leading-relaxed placeholder:text-ink/40 focus:outline-none"
      />
      {errors.message && (
        <p id={`${uid}-message-err`} className="px-5 text-xs text-[#d1342f]">
          {errors.message}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 px-5 py-4">
        <p role="alert" className="min-h-5 text-sm text-[#d1342f]">
          {send.isError && errorMessage(send.error, t)}
        </p>
        <button
          type="submit"
          disabled={send.isPending}
          className="rounded-full bg-blue px-7 py-3 font-semibold text-haze transition-colors hover:bg-blue-deep disabled:opacity-60"
        >
          {send.isPending ? tc.sending : tc.send}
        </button>
      </div>
    </form>
  );
}
