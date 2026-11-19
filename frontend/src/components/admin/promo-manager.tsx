"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useSaveSettings, useStoreSettings } from "@/lib/admin/api";
import { errorMessage } from "@/lib/api/errors";
import {
  DEFAULT_WHEEL,
  newCampaignId,
  type MarqueeSetting,
  type WheelConfig,
  type WheelPrizeType,
} from "@/lib/promo";
import { toEgp, toPiasters } from "./money";

/** Piasters from an EGP field; 0 when empty or not a number. */
const piasters = (egp: string) => {
  const p = toPiasters(egp);
  return Number.isFinite(p) ? p : 0;
};
import { Panel, Skeleton } from "./ui";

const field =
  "mt-1.5 w-full rounded-xl border border-ink/20 bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none aria-[invalid=true]:border-[#d1342f]";
const small =
  "rounded-full border border-ink/20 px-3.5 py-1.5 text-xs font-semibold hover:border-ink";
const primary =
  "rounded-full bg-blue px-6 py-2.5 text-sm font-semibold text-haze hover:bg-blue-deep disabled:opacity-60";

const DEFAULT_MARQUEE: MarqueeSetting = {
  enabled: true,
  items: [
    { en: "UNZUR", ar: "أنظر" },
    { en: "Look, or stop looking", ar: "انظر أو كُفّ عن النظر" },
    { en: "Furniture & lighting", ar: "أثاث وإضاءة" },
  ],
};

function setting<T>(
  list: { key: string; value: unknown }[] | undefined,
  key: string,
  fallback: T,
): T {
  const v = list?.find((s) => s.key === key)?.value;
  return (v as T | undefined) ?? fallback;
}

// ───────────── Scrolling text ─────────────

function MarqueeFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: MarqueeSetting;
  onChange: (v: MarqueeSetting) => void;
}) {
  const { t } = useI18n();
  const tp = t.admin.promo;
  const setItem = (
    i: number,
    patch: Partial<MarqueeSetting["items"][number]>,
  ) =>
    onChange({
      ...value,
      items: value.items.map((it, j) => (j === i ? { ...it, ...patch } : it)),
    });
  return (
    <fieldset className="rounded-2xl border border-ink/12 p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        {tp.show}
      </label>
      <ul className="mt-3 space-y-2">
        {value.items.map((it, i) => (
          <li
            key={i}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <label className="text-xs text-muted">
              {tp.english}
              <input
                dir="ltr"
                maxLength={80}
                value={it.en}
                onChange={(e) => setItem(i, { en: e.target.value })}
                aria-invalid={!it.en.trim()}
                className={field}
              />
            </label>
            <label className="text-xs text-muted">
              {tp.arabic}
              <input
                dir="rtl"
                maxLength={80}
                value={it.ar}
                onChange={(e) => setItem(i, { ar: e.target.value })}
                aria-invalid={!it.ar.trim()}
                className={field}
              />
            </label>
            <button
              type="button"
              disabled={value.items.length <= 1}
              onClick={() =>
                onChange({
                  ...value,
                  items: value.items.filter((_, j) => j !== i),
                })
              }
              className={`${small} disabled:opacity-30`}
            >
              {tp.remove}
            </button>
          </li>
        ))}
      </ul>
      {value.items.length < 12 && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...value, items: [...value.items, { en: "", ar: "" }] })
          }
          className={`${small} mt-3`}
        >
          + {tp.addLine}
        </button>
      )}
    </fieldset>
  );
}

function MarqueeEditor() {
  const { t } = useI18n();
  const tp = t.admin.promo;
  const settings = useStoreSettings();
  return (
    <Panel title={tp.marqueeTitle}>
      <p className="mb-4 text-sm text-muted">{tp.marqueeHint}</p>
      {!settings.data ? (
        <Skeleton className="h-40" />
      ) : (
        <MarqueeForm
          initialTop={setting(settings.data, "marquee_top", DEFAULT_MARQUEE)}
          initialBottom={setting(
            settings.data,
            "marquee_bottom",
            DEFAULT_MARQUEE,
          )}
        />
      )}
    </Panel>
  );
}

function MarqueeForm({
  initialTop,
  initialBottom,
}: {
  initialTop: MarqueeSetting;
  initialBottom: MarqueeSetting;
}) {
  const { t } = useI18n();
  const tp = t.admin.promo;
  const save = useSaveSettings();
  const [top, setTop] = useState(initialTop);
  const [bottom, setBottom] = useState(initialBottom);
  const [done, setDone] = useState(false);
  const valid = (m: MarqueeSetting) =>
    m.items.length > 0 && m.items.every((i) => i.en.trim() && i.ar.trim());

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid(top) || !valid(bottom)) return;
        const clean = (m: MarqueeSetting) => ({
          ...m,
          items: m.items.map((i) => ({ en: i.en.trim(), ar: i.ar.trim() })),
        });
        save.mutate(
          [
            { key: "marquee_top", value: clean(top), isPublic: true },
            { key: "marquee_bottom", value: clean(bottom), isPublic: true },
          ],
          { onSuccess: () => setDone(true) },
        );
      }}
    >
      <MarqueeFields
        title={tp.top}
        value={top}
        onChange={(v) => (setTop(v), setDone(false))}
      />
      <MarqueeFields
        title={tp.bottom}
        value={bottom}
        onChange={(v) => (setBottom(v), setDone(false))}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={save.isPending} className={primary}>
          {tp.save}
        </button>
        <span role="status" className="text-sm text-muted">
          {done ? tp.saved : ""}
        </span>
        <span role="alert" className="text-sm text-[#d1342f]">
          {!valid(top) || !valid(bottom)
            ? tp.fixErrors
            : save.isError
              ? errorMessage(save.error, t)
              : ""}
        </span>
      </div>
    </form>
  );
}

// ───────────── Prize wheel ─────────────

/** "2026-11-20T18:00" (local input) <-> ISO, in the browser's time zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function WheelEditor() {
  const { t } = useI18n();
  const settings = useStoreSettings();
  if (!settings.data) {
    return (
      <Panel title={t.admin.promo.wheelTitle}>
        <Skeleton className="h-60" />
      </Panel>
    );
  }
  return (
    <WheelForm initial={setting(settings.data, "spin_wheel", DEFAULT_WHEEL)} />
  );
}

function WheelForm({ initial }: { initial: WheelConfig }) {
  const { t } = useI18n();
  const tp = t.admin.promo;
  const save = useSaveSettings();
  const [w, setW] = useState(initial);
  const [minOrder, setMinOrder] = useState(
    initial.minOrder ? toEgp(initial.minOrder) : "",
  );
  const [done, setDone] = useState(false);

  const change = (patch: Partial<WheelConfig>) => {
    setW({ ...w, ...patch });
    setDone(false);
  };
  const setSeg = (i: number, patch: Partial<WheelConfig["segments"][number]>) =>
    change({
      segments: w.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });
  const totalWeight = w.segments.reduce((sum, s) => sum + (s.weight || 0), 0);

  const segValueOk = (s: WheelConfig["segments"][number]) =>
    s.type === "NONE" ||
    (s.type === "PERCENTAGE" ? s.value >= 1 && s.value <= 100 : s.value >= 100);
  const segOk = (s: WheelConfig["segments"][number]) =>
    s.label.trim() && s.labelAr.trim() && segValueOk(s) && s.weight >= 0;
  const winnersOk = w.winners.every(
    (x) =>
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email.trim()) &&
      x.segment < w.segments.length,
  );
  const valid =
    w.segments.length >= 2 &&
    w.segments.every(segOk) &&
    totalWeight > 0 &&
    winnersOk;

  return (
    <Panel title={tp.wheelTitle}>
      <p className="mb-4 text-sm text-muted">{tp.wheelHint}</p>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const value: WheelConfig = {
            ...w,
            minOrder: piasters(minOrder),
            segments: w.segments.map((s) => ({
              ...s,
              label: s.label.trim(),
              labelAr: s.labelAr.trim(),
              value: s.type === "NONE" ? 0 : s.value,
            })),
            winners: w.winners.map((x) => ({
              email: x.email.trim().toLowerCase(),
              segment: x.segment,
            })),
          };
          save.mutate([{ key: "spin_wheel", value, isPublic: false }], {
            onSuccess: () => setDone(true),
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={w.enabled}
              onChange={(e) => change({ enabled: e.target.checked })}
            />
            {tp.on}
          </label>
          <label className="text-sm font-semibold">
            {tp.starts}
            <input
              type="datetime-local"
              value={toLocalInput(w.startsAt)}
              onChange={(e) =>
                change({ startsAt: fromLocalInput(e.target.value) })
              }
              className={field}
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              {tp.noLimit}
            </span>
          </label>
          <label className="text-sm font-semibold">
            {tp.ends}
            <input
              type="datetime-local"
              value={toLocalInput(w.endsAt)}
              onChange={(e) =>
                change({ endsAt: fromLocalInput(e.target.value) })
              }
              className={field}
            />
          </label>
          <label className="text-sm font-semibold">
            {tp.delay}
            <input
              type="number"
              min={0}
              max={600}
              dir="ltr"
              value={w.delaySeconds}
              onChange={(e) =>
                change({
                  delaySeconds: Math.max(
                    0,
                    Math.min(600, Number(e.target.value) || 0),
                  ),
                })
              }
              className={`${field} rtl:text-right`}
            />
          </label>
          <label className="text-sm font-semibold">
            {tp.couponDays}
            <input
              type="number"
              min={1}
              max={365}
              dir="ltr"
              value={w.couponDays}
              onChange={(e) =>
                change({
                  couponDays: Math.max(
                    1,
                    Math.min(365, Number(e.target.value) || 1),
                  ),
                })
              }
              className={`${field} rtl:text-right`}
            />
          </label>
          <label className="text-sm font-semibold">
            {tp.minOrder}
            <input
              inputMode="decimal"
              dir="ltr"
              value={minOrder}
              onChange={(e) => (setMinOrder(e.target.value), setDone(false))}
              className={`${field} rtl:text-right`}
            />
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">{tp.segments}</legend>
          <ul className="mt-3 space-y-3">
            {w.segments.map((s, i) => (
              <li
                key={i}
                className="grid gap-2 rounded-2xl border border-ink/12 p-3 sm:grid-cols-[1fr_1fr_8rem_6rem_6rem_auto] sm:items-end"
              >
                <label className="text-xs text-muted">
                  {tp.label}
                  <input
                    dir="ltr"
                    maxLength={30}
                    value={s.label}
                    onChange={(e) => setSeg(i, { label: e.target.value })}
                    aria-invalid={!s.label.trim()}
                    className={field}
                  />
                </label>
                <label className="text-xs text-muted">
                  {tp.labelAr}
                  <input
                    dir="rtl"
                    maxLength={30}
                    value={s.labelAr}
                    onChange={(e) => setSeg(i, { labelAr: e.target.value })}
                    aria-invalid={!s.labelAr.trim()}
                    className={field}
                  />
                </label>
                <label className="text-xs text-muted">
                  {tp.prize}
                  <select
                    value={s.type}
                    onChange={(e) =>
                      setSeg(i, {
                        type: e.target.value as WheelPrizeType,
                        value: 0,
                      })
                    }
                    className={field}
                  >
                    <option value="PERCENTAGE">{tp.percent}</option>
                    <option value="FIXED_AMOUNT">{tp.fixed}</option>
                    <option value="NONE">{tp.none}</option>
                  </select>
                </label>
                <label className="text-xs text-muted">
                  {tp.value}
                  <input
                    inputMode="decimal"
                    dir="ltr"
                    disabled={s.type === "NONE"}
                    value={
                      s.type === "NONE"
                        ? ""
                        : s.type === "PERCENTAGE"
                          ? String(s.value || "")
                          : toEgp(s.value)
                    }
                    onChange={(e) =>
                      setSeg(i, {
                        value:
                          s.type === "PERCENTAGE"
                            ? Math.round(Number(e.target.value) || 0)
                            : piasters(e.target.value),
                      })
                    }
                    aria-invalid={!segValueOk(s)}
                    className={`${field} disabled:opacity-40 rtl:text-right`}
                  />
                </label>
                <label className="text-xs text-muted">
                  {tp.weight} ·{" "}
                  {totalWeight ? Math.round((s.weight / totalWeight) * 100) : 0}
                  %
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    dir="ltr"
                    value={s.weight}
                    onChange={(e) =>
                      setSeg(i, {
                        weight: Math.max(
                          0,
                          Math.min(
                            1000,
                            Math.round(Number(e.target.value) || 0),
                          ),
                        ),
                      })
                    }
                    className={`${field} rtl:text-right`}
                  />
                </label>
                <button
                  type="button"
                  disabled={w.segments.length <= 2}
                  onClick={() =>
                    change({
                      segments: w.segments.filter((_, j) => j !== i),
                      winners: w.winners
                        .filter((x) => x.segment !== i)
                        .map((x) => ({
                          ...x,
                          segment: x.segment > i ? x.segment - 1 : x.segment,
                        })),
                    })
                  }
                  className={`${small} disabled:opacity-30`}
                >
                  {tp.remove}
                </button>
              </li>
            ))}
          </ul>
          {w.segments.length < 12 && (
            <button
              type="button"
              onClick={() =>
                change({
                  segments: [
                    ...w.segments,
                    {
                      label: "",
                      labelAr: "",
                      type: "PERCENTAGE",
                      value: 5,
                      weight: 10,
                    },
                  ],
                })
              }
              className={`${small} mt-3`}
            >
              + {tp.addSlice}
            </button>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">{tp.winners}</legend>
          <p className="mt-1 text-xs text-muted">{tp.winnersHint}</p>
          <ul className="mt-3 space-y-2">
            {w.winners.map((x, i) => (
              <li
                key={i}
                className="grid gap-2 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
              >
                <label className="text-xs text-muted">
                  {tp.email}
                  <input
                    type="email"
                    dir="ltr"
                    value={x.email}
                    onChange={(e) =>
                      change({
                        winners: w.winners.map((y, j) =>
                          j === i ? { ...y, email: e.target.value } : y,
                        ),
                      })
                    }
                    aria-invalid={
                      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email.trim())
                    }
                    className={`${field} rtl:text-right`}
                  />
                </label>
                <label className="text-xs text-muted">
                  {tp.lands}
                  <select
                    value={x.segment}
                    onChange={(e) =>
                      change({
                        winners: w.winners.map((y, j) =>
                          j === i
                            ? { ...y, segment: Number(e.target.value) }
                            : y,
                        ),
                      })
                    }
                    className={field}
                  >
                    {w.segments.map((s, j) => (
                      <option key={j} value={j}>
                        {j + 1}. {s.labelAr || s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    change({ winners: w.winners.filter((_, j) => j !== i) })
                  }
                  className={small}
                >
                  {tp.remove}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              change({ winners: [...w.winners, { email: "", segment: 0 }] })
            }
            className={`${small} mt-3`}
          >
            + {tp.addWinner}
          </button>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-5">
          <button type="submit" disabled={save.isPending} className={primary}>
            {tp.save}
          </button>
          <button
            type="button"
            onClick={() => change({ campaignId: newCampaignId() })}
            title={tp.newRoundHint}
            className={small}
          >
            ↻ {tp.newRound}
          </button>
          <span role="status" className="text-sm text-muted">
            {done ? tp.saved : ""}
          </span>
          <span role="alert" className="text-sm text-[#d1342f]">
            {!valid
              ? tp.fixErrors
              : save.isError
                ? errorMessage(save.error, t)
                : ""}
          </span>
        </div>
        <p className="text-xs text-muted">{tp.newRoundHint}</p>
      </form>
    </Panel>
  );
}

/** Dashboard → Marketing: the scrolling text strips and the prize wheel. */
export function PromoManager() {
  return (
    <>
      <MarqueeEditor />
      <WheelEditor />
    </>
  );
}
