"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { PublicWheel, SpinResult } from "@/lib/promo";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Segment colours, in turn: brand blue, pale haze, deep night. */
const FILLS = ["#1b44ff", "#e8e8e5", "#0b1240"];
const INKS = ["#e8e8e5", "#0b1240", "#e8e8e5"];

const storeKey = (campaign: string) => `unzur_wheel:${campaign}`;
function readState(campaign: string): string | null {
  try {
    return localStorage.getItem(storeKey(campaign));
  } catch {
    return null;
  }
}
function writeState(campaign: string, value: "dismissed" | "spun") {
  try {
    localStorage.setItem(storeKey(campaign), value);
  } catch {
    /* private mode: the wheel may show again, which is fine */
  }
}

/** Polar point on the wheel, 0deg = top, clockwise. */
function point(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
}

function WheelSvg({ labels, rotation, spinning }: { labels: string[]; rotation: number; spinning: boolean }) {
  const n = labels.length;
  const slice = 360 / n;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[19rem]">
      {/* pointer */}
      <div aria-hidden className="absolute -top-1 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[11px] border-t-[20px] border-x-transparent border-t-ink drop-shadow" />
      <svg
        viewBox="0 0 200 200"
        aria-hidden
        className="h-full w-full drop-shadow-[0_18px_40px_rgba(27,68,255,0.35)]"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 5.2s cubic-bezier(0.12, 0.8, 0.12, 1)" : "none",
        }}
      >
        {labels.map((label, i) => {
          const [x1, y1] = point(96, i * slice);
          const [x2, y2] = point(96, (i + 1) * slice);
          const mid = i * slice + slice / 2;
          const [tx, ty] = point(60, mid);
          // Cycle the colours; the last slice must not match the first one it touches.
          const tone = i === n - 1 && n > 1 && i % FILLS.length === 0 ? 1 : i % FILLS.length;
          return (
            <g key={i}>
              <path d={`M100 100 L${x1} ${y1} A96 96 0 ${slice > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} fill={FILLS[tone]} stroke="#e8e8e5" strokeWidth="0.8" />
              <text
                x={tx}
                y={ty}
                fill={INKS[tone]}
                fontSize={n > 8 ? 7 : 8.5}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid} ${tx} ${ty})`}
              >
                {label}
              </text>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="15" fill="#0b1240" stroke="#e8e8e5" strokeWidth="2" />
        <circle cx="100" cy="100" r="5" fill="#1b44ff" />
      </svg>
    </div>
  );
}

/**
 * The prize wheel: pops up once per round (after the delay set in the
 * dashboard), one spin per email; a small button brings it back if closed.
 */
export function PrizeWheel() {
  const { lang, t, href } = useI18n();
  const tw = t.wheel;
  const uid = useId();
  const wheel = useQuery({
    queryKey: ["wheel"],
    queryFn: () => api<PublicWheel>("/wheel", { anonymous: true }),
    staleTime: 5 * 60_000,
  });
  const data = wheel.data;
  const campaign = data?.active ? data.campaignId : undefined;

  // What this visitor did this round: chosen here, else remembered from before.
  // (Only read once the wheel has loaded on the client, so no hydration issue.)
  const [choice, setChoice] = useState<string | null>(null);
  const state = choice ?? (campaign ? readState(campaign) : null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [bad, setBad] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!campaign || readState(campaign)) return;
    const timer = setTimeout(() => setOpen(true), (data?.delaySeconds ?? 8) * 1000);
    return () => clearTimeout(timer);
  }, [campaign, data?.delaySeconds]);

  const close = () => {
    setOpen(false);
    if (!result && campaign) {
      writeState(campaign, "dismissed");
      setChoice("dismissed");
    }
  };
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  });

  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  const spin = useMutation({
    mutationFn: (address: string) => api<SpinResult>("/wheel/spin", { method: "POST", json: { email: address }, anonymous: true }),
    onSuccess: (res) => {
      const n = data?.segments?.length ?? 1;
      const slice = 360 / n;
      const center = res.segment * slice + slice / 2;
      // 6 full turns, then stop with the won slice under the pointer.
      setRotation((r) => r - (r % 360) + 360 * 6 + (360 - center));
      setResult(res);
      if (campaign) writeState(campaign, "spun");
      setChoice("spun");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => setRevealed(true), reduced ? 300 : 5400);
    },
  });

  if (!data?.active || !campaign || !data.segments?.length) return null;
  const labels = data.segments.map((s) => (lang === "ar" ? s.labelAr : s.label));
  const prize = result ? data.segments[result.segment] : null;

  return (
    <>
      {!open && state === "dismissed" && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 z-40 rounded-full bg-blue px-5 py-3 text-sm font-semibold text-haze shadow-[0_12px_40px_-8px_rgba(27,68,255,0.8)] transition-transform hover:scale-105 ltr:left-5 rtl:right-5"
        >
          🎁 {tw.open}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#05060f]/60 p-4 backdrop-blur-sm" onClick={close}>
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-title`}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92svh] w-full max-w-md overflow-y-auto rounded-3xl bg-page p-6 text-ink shadow-2xl focus:outline-none sm:p-8 dark:bg-[#0b0d1f] dark:ring-1 dark:ring-white/10"
          >
            <button type="button" onClick={close} aria-label={tw.close} className="absolute top-4 text-xl text-muted hover:text-ink ltr:right-5 rtl:left-5">
              ×
            </button>
            <h2 id={`${uid}-title`} className="display text-center text-[2.2rem]">
              {tw.title}
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-center text-sm text-muted">{tw.intro}</p>

            <div className="mt-6">
              <WheelSvg labels={labels} rotation={rotation} spinning={spin.isSuccess} />
            </div>

            {!result ? (
              <form
                noValidate
                className="mt-6 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const address = email.trim();
                  if (!EMAIL.test(address)) return setBad(true);
                  setBad(false);
                  spin.mutate(address);
                }}
              >
                <label htmlFor={`${uid}-email`} className="sr-only">
                  {tw.email}
                </label>
                <input
                  id={`${uid}-email`}
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  placeholder={tw.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={bad}
                  className="min-w-0 flex-1 rounded-full border border-ink/20 bg-transparent px-4 py-3 text-sm focus:border-ink focus:outline-none aria-[invalid=true]:border-[#d1342f] rtl:text-right"
                />
                <button
                  type="submit"
                  disabled={spin.isPending}
                  className="rounded-full bg-blue px-6 py-3 font-semibold text-haze transition-colors hover:bg-blue-deep disabled:opacity-60"
                >
                  {spin.isPending ? tw.spinning : tw.spin}
                </button>
              </form>
            ) : null}
            <p role="alert" className="mt-2 min-h-5 text-center text-sm text-[#d1342f]">
              {bad ? tw.badEmail : spin.isError ? errorMessage(spin.error, t) : ""}
            </p>

            {result && revealed && (
              <div role="status" className="mt-2 rounded-2xl bg-panel p-5 text-center dark:ring-1 dark:ring-white/8">
                {result.repeat && <p className="mb-2 text-xs text-muted">{tw.repeat}</p>}
                {result.code && prize ? (
                  <>
                    <p className="text-lg font-semibold">{fmt(tw.won, { prize: lang === "ar" ? prize.labelAr : prize.label })}</p>
                    <p className="mt-3 text-xs text-muted">{tw.code}</p>
                    <p dir="ltr" className="mt-1 font-mono text-2xl font-bold tracking-widest">
                      {result.code}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(result.code ?? "");
                          setCopied(true);
                        }}
                        className="rounded-full border border-ink/25 px-4 py-2 text-sm font-semibold hover:border-ink"
                      >
                        {copied ? tw.copied : tw.copy}
                      </button>
                      <Link href={href("/shop")} onClick={() => setOpen(false)} className="rounded-full bg-blue px-5 py-2 text-sm font-semibold text-haze hover:bg-blue-deep">
                        {tw.shop}
                      </Link>
                    </div>
                    {result.expiresAt && (
                      <p className="mt-3 text-xs text-muted">{fmt(tw.expires, { date: formatDate(result.expiresAt, lang) })}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold">{tw.lost}</p>
                    <p className="mt-1 text-sm text-muted">{tw.lostBody}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
