"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/client";
import { lockScroll } from "@/lib/motion/scroll-state";

export interface SizeChartData {
  title: string;
  options: { label: string; url: string }[];
}

/** iOS-like spring: quick start, tiny overshoot, soft landing. */
const OPEN_EASE = "cubic-bezier(0.2, 1.15, 0.32, 1)";
const CLOSE_EASE = "cubic-bezier(0.4, 0, 0.7, 0.2)";
const OPEN_MS = 620;
const CLOSE_MS = 340;

const preloaded = new Set<string>();
/** Fetch the photos ahead (on hover / focus of "Add to cart") so the sheet opens with them in place. */
export function preloadChoices(chart: SizeChartData | null | undefined) {
  if (!chart) return;
  for (const { url } of chart.options) {
    if (preloaded.has(url)) continue;
    preloaded.add(url);
    const img = new window.Image();
    img.decoding = "async";
    img.src = url;
  }
}

/**
 * "Which one?" before adding to the cart, for products with a size chart
 * (e.g. the Arabic or the English calendar). `ask(button)` makes the sheet
 * grow out of that button into the middle of the screen; tapping a photo
 * calls onPick with its name and the photo element (for the flight to the
 * cart) and the sheet fades away. Closing without a choice sends it back
 * into the button.
 */
export function useChoiceSheet(
  chart: SizeChartData | null | undefined,
  onPick: (label: string, url: string, photo: HTMLImageElement) => void,
): { ask: (origin: Element | null) => void; sheet: ReactNode } {
  const { t } = useI18n();
  const ts = t.productPage.sizeChart;
  const originRef = useRef<Element | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  /** false = folded into the button, true = in the middle. */
  const [shown, setShown] = useState(false);
  /** How it leaves: back into the button, or a quick fade when a photo was picked (it flies to the cart). */
  const [leaving, setLeaving] = useState<"back" | "fade">("back");
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [reduced, setReduced] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<{ start: number; y: number } | null>(null);

  /** Where the button is, as an offset from the screen's centre (the card starts there). */
  const measure = () => {
    const r = originRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: window.innerHeight / 3 };
    return { x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2 };
  };

  const ask = (from: Element | null) => {
    if (!chart?.options.length) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    preloadChoices(chart);
    originRef.current = from;
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setOrigin(measure());
    setLeaving("back");
    setDrag(null);
    setShown(false);
    setMounted(true);
    // Two frames: the card mounts folded into the button, then springs to the centre.
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  };

  const close = useCallback(
    (how: "back" | "fade" = "back") => {
      setDrag(null);
      setLeaving(how);
      if (how === "back") setOrigin(measure());
      setShown(false);
      timer.current = window.setTimeout(
        () => {
          setMounted(false);
          timer.current = null;
          if (how === "back") (originRef.current as HTMLElement | null)?.focus?.({ preventScroll: true });
        },
        reduced ? 160 : how === "fade" ? 240 : CLOSE_MS,
      );
    },
    [reduced],
  );

  // While open: Escape closes, Tab stays inside, the page behind doesn't scroll.
  useEffect(() => {
    if (!mounted) return;
    lockScroll(true);
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && cardRef.current) {
        const items = [...cardRef.current.querySelectorAll<HTMLElement>("button")];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      lockScroll(false);
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, close]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!chart?.options.length) return { ask, sheet: null };
  const options = chart.options;

  const dragY = drag ? Math.max(0, drag.y - drag.start) : 0;
  const cardStyle: CSSProperties = reduced
    ? { opacity: shown ? 1 : 0, transition: "opacity 160ms ease" }
    : shown
      ? {
          transform: `translate3d(0, ${dragY}px, 0) scale(${1 - Math.min(dragY, 300) / 1500})`,
          opacity: 1,
          borderRadius: "1.75rem",
          transition: drag
            ? "none"
            : `transform ${OPEN_MS}ms ${OPEN_EASE}, opacity 180ms ease-out, border-radius ${OPEN_MS}ms ${OPEN_EASE}`,
        }
      : leaving === "fade"
        ? { transform: "scale(0.96)", opacity: 0, borderRadius: "1.75rem", transition: "transform 240ms ease-in, opacity 240ms ease-in" }
        : {
            transform: `translate3d(${origin.x}px, ${origin.y}px, 0) scale(0.08)`,
            opacity: 0,
            borderRadius: "999px",
            transition: `transform ${CLOSE_MS}ms ${CLOSE_EASE}, opacity ${CLOSE_MS}ms ease-in ${CLOSE_MS / 3}ms, border-radius ${CLOSE_MS}ms ease-in`,
          };

  // In a portal: a card's animated (transformed) ancestors must not trap the fixed overlay.
  const sheet = mounted ? createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="choice-sheet-title" className="fixed inset-0 z-[75]">
      <div
        aria-hidden
        onClick={() => close()}
        className="absolute inset-0 bg-black/45 backdrop-blur-md transition-opacity duration-500"
        style={{ opacity: shown ? Math.max(0.2, 1 - dragY / 400) : 0 }}
      />
      <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
        <div
          ref={cardRef}
          style={cardStyle}
          onPointerDown={(e) => {
            // Swipe down to close (touch only; buttons keep their taps).
            if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button")) return;
            setDrag({ start: e.clientY, y: e.clientY });
          }}
          onPointerMove={(e) => drag && setDrag({ ...drag, y: e.clientY })}
          onPointerUp={() => {
            if (!drag) return;
            if (dragY > 110) close();
            else setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
          className="pointer-events-auto relative w-[min(46rem,calc(100vw-2rem))] touch-none overflow-hidden bg-canvas p-3 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)] will-change-transform sm:p-4"
        >
          <div className="flex items-start gap-3 px-1 pt-1 pb-3">
            <div className="min-w-0">
              <h2 id="choice-sheet-title" dir="auto" className="text-lg font-semibold leading-tight">
                {chart.title}
              </h2>
              <p className="mt-0.5 text-sm text-muted">{ts.pick}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => close()}
              aria-label={ts.close}
              className="ms-auto grid size-9 shrink-0 place-items-center rounded-full bg-ink/8 text-ink transition-colors hover:bg-ink/15"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="size-4">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className={`grid gap-3 ${options.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {options.map((o, i) => (
              <button
                key={o.url}
                type="button"
                onClick={(e) => {
                  const photo = e.currentTarget.querySelector("img");
                  if (!photo) return;
                  onPick(o.label, o.url, photo);
                  close("fade");
                }}
                style={reduced ? undefined : { transitionDelay: shown ? `${120 + i * 70}ms` : "0ms" }}
                className={`group flex flex-col overflow-hidden rounded-[1.25rem] bg-panel text-start ring-1 ring-ink/10 transition-[transform,opacity,box-shadow] duration-500 ease-[cubic-bezier(0.2,1.15,0.32,1)] hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(27,68,255,0.6)] hover:ring-2 hover:ring-blue focus-visible:ring-2 focus-visible:ring-blue focus-visible:outline-none active:scale-[0.97] ${
                  shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                }`}
              >
                <span className="relative grid min-h-40 flex-1 place-items-center p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- full chart, sized by its own shape (preloaded on hover) */}
                  <img
                    src={o.url}
                    alt={o.label}
                    draggable={false}
                    decoding="async"
                    onLoad={() => setLoaded((l) => ({ ...l, [o.url]: true }))}
                    className={`mx-auto block h-auto max-h-[min(56svh,30rem)] w-auto max-w-full rounded-xl object-contain transition-opacity duration-300 select-none ${
                      loaded[o.url] ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {!loaded[o.url] && (
                    <span aria-hidden className="absolute size-7 animate-spin rounded-full border-2 border-ink/15 border-t-ink/60" />
                  )}
                </span>
                <span className="flex items-center justify-between gap-2 border-t border-ink/10 px-4 py-3 text-sm font-semibold">
                  <span dir="auto">{o.label}</span>
                  <span aria-hidden className="grid size-7 place-items-center rounded-full bg-blue text-haze transition-transform duration-300 group-hover:scale-110">
                    +
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return { ask, sheet };
}
