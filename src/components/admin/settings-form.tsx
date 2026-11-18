"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSaveSettings, useStoreSettings } from "@/lib/admin/api";
import type { StoreSetting } from "@/lib/admin/types";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { MONEY, toEgp, toPiasters } from "./money";
import { Panel, Skeleton } from "./ui";

type Kind = "text" | "phone" | "email" | "url" | "currency" | "egp" | "int" | "bool";
/** The store's known settings, how to edit each one, and whether the store front may read it. */
const FIELDS: { key: string; kind: Kind; public: boolean; fallback?: number }[] = [
  { key: "store_name", kind: "text", public: true },
  { key: "contact_email", kind: "email", public: true },
  { key: "whatsapp_number", kind: "phone", public: true },
  { key: "instagram_url", kind: "url", public: true },
  { key: "currency", kind: "currency", public: true },
  { key: "free_shipping_threshold", kind: "egp", public: true },
  { key: "admin_email", kind: "email", public: false },
  { key: "auto_approve_reviews", kind: "bool", public: false },
  { key: "loyalty_point_value_piasters", kind: "int", public: false, fallback: 10 },
  { key: "loyalty_earn_piasters_per_point", kind: "int", public: false, fallback: 1000 },
  { key: "referral_bonus_points", kind: "int", public: false, fallback: 50 },
  { key: "abandoned_cart_hours", kind: "int", public: false, fallback: 24 },
  { key: "unpaid_order_expiry_minutes", kind: "int", public: false, fallback: 30 },
  { key: "unpaid_gift_card_expiry_minutes", kind: "int", public: false, fallback: 60 },
];

const show = (kind: Kind, value: unknown): string | boolean => {
  if (kind === "bool") return value === true;
  if (value === null || value === undefined) return "";
  if (kind === "egp") return toEgp(value as number);
  return String(value);
};

function Form({ saved }: { saved: StoreSetting[] }) {
  const { t } = useI18n();
  const ts = t.admin.store;
  const save = useSaveSettings();
  const current = (key: string) => saved.find((s) => s.key === key)?.value;
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, show(f.kind, current(f.key) ?? f.fallback)])),
  );
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const out: { key: string; value: unknown; isPublic: boolean }[] = [];
    for (const f of FIELDS) {
      const v = values[f.key];
      let value: unknown;
      if (f.kind === "bool") value = v === true;
      else if (f.kind === "egp") {
        if (v === "") value = null;
        else if (!MONEY.test(String(v))) return setProblem(`${ts.fields[f.key as keyof typeof ts.fields]}: ${t.admin.product.priceInvalid}`);
        else value = toPiasters(String(v));
      } else if (f.kind === "int") {
        if (v === "") continue;
        value = Number(v);
      } else {
        if (String(v).trim() === "") continue; // leave unset text settings alone
        const text = String(v).trim();
        // Shared links carry tracking (?igsh=…, ?evlk=…): keep just the profile address.
        value = f.kind === "currency" ? text.toUpperCase() : f.kind === "url" ? text.replace(/[?#].*$/, "") : text;
      }
      // Skip what didn't change.
      if (JSON.stringify(value) === JSON.stringify(current(f.key) ?? (f.kind === "egp" ? null : f.fallback))) continue;
      out.push({ key: f.key, value, isPublic: f.public });
    }
    if (out.length) save.mutate(out);
  };

  const field = "mt-1.5 w-full rounded-xl border border-ink/20 bg-transparent px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none";
  const messages = save.error instanceof ApiError && Array.isArray(save.error.errors) ? (save.error.errors as string[]) : [];

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const label = ts.fields[f.key as keyof typeof ts.fields];
          const hint = ts.hints[f.key as keyof typeof ts.hints];
          if (f.kind === "bool") {
            return (
              <label key={f.key} className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={values[f.key] === true} onChange={(e) => setValues({ ...values, [f.key]: e.target.checked })} className="size-4 accent-[var(--color-ink)]" />
                {label}
              </label>
            );
          }
          return (
            <label key={f.key} className="text-sm font-semibold">
              <span className="flex items-center gap-2">
                {label}
                {f.public && <span className="rounded-full bg-blue/10 px-2 py-0.5 text-[0.65rem] font-normal text-blue dark:text-[#a3b3ff]">{ts.public}</span>}
              </span>
              <input
                value={String(values[f.key])}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                type={f.kind === "email" ? "email" : f.kind === "url" ? "url" : f.kind === "int" ? "number" : "text"}
                inputMode={f.kind === "egp" ? "decimal" : f.kind === "phone" ? "tel" : undefined}
                dir={f.kind === "text" ? undefined : "ltr"}
                className={`${field} ${f.kind === "text" ? "" : "rtl:text-right"}`}
              />
              {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
            </label>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={save.isPending} className="rounded-full bg-blue px-6 py-3 text-sm font-semibold text-haze hover:bg-blue-deep disabled:opacity-50">
          {save.isPending ? ts.saving : ts.saveSettings}
        </button>
        <span role="status" className="text-sm">
          {save.isSuccess && <span className="text-[#16773f] dark:text-[#7ee2a8]">{ts.saved}</span>}
          {(problem || save.isError) && <span className="text-[#d1342f]">{problem ?? (messages.length ? messages.join(" · ") : errorMessage(save.error, t))}</span>}
        </span>
      </div>
    </form>
  );
}

export function SettingsForm() {
  const { t } = useI18n();
  const { data, isError, error } = useStoreSettings();
  return (
    <Panel title={t.admin.store.settings}>
      <p className="mb-5 text-sm text-muted">{t.admin.store.settingsHint}</p>
      {isError && <p className="text-sm text-[#d1342f]">{errorMessage(error, t)}</p>}
      {data ? <Form saved={data} /> : <Skeleton className="h-64" />}
    </Panel>
  );
}
