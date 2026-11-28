"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "@/i18n/client";

export interface SizeChartData {
  title: string;
  options: { label: string; url: string }[];
}

/** iOS-like spring: quick start, tiny overshoot, soft landing. */
const OPEN_EASE = "cubic-bezier(0.2, 1.15, 0.32, 1)";
const CLOSE_EASE = "cubic-bezier(0.4, 0, 0.7, 0.2)";
const OPEN_MS = 620;
const CLOSE_MS = 360;

function RulerIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M3 16.5 16.5 3l4.5 4.5L7.5 21z" />
      <path d="m7 13 1.8 1.8M10 10l1.8 1.8M13 7l1.8 1.8M8.5 11.5l3 3M11.5 8.5l3 3" />
    </svg>
  );
}

const preloaded = new Set<string>();
/** Fetch the photos ahead (on hover / opening the menu) so they open at once, already sized. */
function preload(urls: string[]) {
  for (const url of urls) {
    if (preloaded.has(url)) continue;
    preloaded.add(url);
    const img = new window.Image();
    img.decoding = "async";
    img.src = url;
  }
}

/**
 * Corner button on the product page. Tap it, pick a choice (when there are
 * two), and the choice's photo grows out of the button into the middle of the
 * screen; closing sends it back into the button. Swipe down to close on phones.
 */
export function SizeChart({ chart }: { chart: SizeChartData }) {
  const { t } = useI18n();
  const ts = t.productPage.sizeChart;
  const options = chart.options;
  const single = options.length === 1;

  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  /** Which photo is open (null = viewer not mounted). */
  const [active, setActive] = useState<number | null>(null);
  /** false = folded into the button, true = in the middle. */
  const [shown, setShown] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<{ start: number; y: number } | null>(null);
  const [reduced, setReduced] = useState(false);
  const closing = useRef<number | null>(null);

  const warm = () => preload(options.map((o) => o.url));

  /** Where the button is, as an offset from the screen's centre (the card starts there). */
  const measure = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: window.innerHeight / 2 };
    return { x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2 };
  };

  const open = (index: number) => {
    if (closing.current) window.clearTimeout(closing.current);
    closing.current = null;
    warm();
    // Reduced motion: a plain fade instead of the flight from the button.
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setOrigin(measure());
    setMenu(false);
    setActive(index);
    setShown(false);
    // Two frames: the card mounts folded into the button, then springs to the centre.
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  };

  const close = useCallback(() => {
    setDrag(null);
    setOrigin(measure());
    setShown(false);
    closing.current = window.setTimeout(() => {
      setActive(null);
      closing.current = null;
      buttonRef.current?.focus({ preventScroll: true });
    }, reduced ? 160 : CLOSE_MS);
  }, [reduced]);

  // While the photo is open: Escape closes, the page behind doesn't scroll, focus starts on Close.
  const isOpen = active !== null;
  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
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
      root.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close]);

  // The menu closes on Escape or a tap anywhere else.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest("[data-size-chart]")) setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [menu]);

  useEffect(() => () => {
    if (closing.current) window.clearTimeout(closing.current);
  }, []);

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
      : {
          transform: `translate3d(${origin.x}px, ${origin.y}px, 0) scale(0.08)`,
          opacity: 0,
          borderRadius: "999px",
          transition: `transform ${CLOSE_MS}ms ${CLOSE_EASE}, opacity ${CLOSE_MS}ms ease-in ${CLOSE_MS / 3}ms, border-radius ${CLOSE_MS}ms ease-in`,
        };

  const current = active === null ? null : options[active];

  return (
    <>
      <div data-size-chart className="fixed end-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-2">
        {/* Choices rise out of the button, one after the other. */}
        {!single && (
          <ul id="size-chart-menu" aria-label={chart.title} className={`flex flex-col items-end gap-2 ${menu ? "" : "pointer-events-none"}`}>
            {options.map((o, i) => {
              const delay = (menu ? options.length - 1 - i : i) * 45;
              return (
                <li
                  key={o.url}
                  style={{ transitionDelay: `${delay}ms` }}
                  className={`origin-bottom-right transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,1.15,0.32,1)] motion-reduce:transition-opacity ${
                    menu ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-75 opacity-0"
                  }`}
                >
                  <button
                    type="button"
                    tabIndex={menu ? 0 : -1}
                    dir="auto"
                    onClick={() => open(i)}
                    className="rounded-full bg-canvas px-5 py-2.5 text-sm font-semibold text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] ring-1 ring-ink/10 backdrop-blur-xl transition-transform hover:scale-105 active:scale-95"
                  >
                    {o.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button
          ref={buttonRef}
          type="button"
          aria-haspopup={single ? "dialog" : "true"}
          aria-expanded={single ? active !== null : menu}
          aria-controls={single ? undefined : "size-chart-menu"}
          onPointerEnter={warm}
          onFocus={warm}
          onTouchStart={warm}
          onClick={() => (single ? open(0) : setMenu((m) => !m))}
          className="flex items-center gap-2 rounded-full bg-ink py-3 ps-4 pe-5 text-sm font-semibold text-canvas shadow-[0_14px_40px_-10px_rgba(0,0,0,0.55)] transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          <span className={`grid size-5 place-items-center transition-transform duration-300 ${menu ? "rotate-[135deg]" : ""}`}>
            {menu ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="size-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
            ) : (
              <RulerIcon className="size-5" />
            )}
          </span>
          <span dir="auto">{chart.title}</span>
        </button>
      </div>

      {current && (
        <div role="dialog" aria-modal="true" aria-label={`${chart.title}: ${current.label}`} className="fixed inset-0 z-[75]">
          <div
            aria-hidden
            onClick={close}
            className="absolute inset-0 bg-black/45 backdrop-blur-md transition-opacity duration-500"
            style={{ opacity: shown ? Math.max(0.2, 1 - dragY / 400) : 0 }}
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
            <div
              ref={cardRef}
              style={cardStyle}
              onPointerDown={(e) => {
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
              className="pointer-events-auto relative w-max max-w-[min(34rem,calc(100vw-2rem))] touch-none overflow-hidden bg-canvas p-2 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)] will-change-transform"
            >
              <div className="flex items-center gap-2 p-1.5">
                {!single && (
                  <div role="tablist" aria-label={chart.title} className="relative flex rounded-full bg-ink/8 p-1">
                    {/* The sliding highlight behind the chosen tab. */}
                    <span
                      aria-hidden
                      className="absolute inset-y-1 rounded-full bg-canvas shadow-sm transition-[inset-inline-start] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                      style={{ width: `calc((100% - 0.5rem) / ${options.length})`, insetInlineStart: `calc(0.25rem + ${active} * (100% - 0.5rem) / ${options.length})` }}
                    />
                    {options.map((o, i) => (
                      <button
                        key={o.url}
                        type="button"
                        role="tab"
                        dir="auto"
                        aria-selected={i === active}
                        onClick={() => setActive(i)}
                        className={`relative min-w-20 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${i === active ? "text-ink" : "text-muted hover:text-ink"}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label={ts.close}
                  className="ms-auto grid size-9 place-items-center rounded-full bg-ink/8 text-ink transition-colors hover:bg-ink/15"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="size-4">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              {/* Both photos stay mounted (switching tabs doesn't reload); only the one shown sizes the card. */}
              <div className="relative grid">
                {options.map((o, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- full-size chart, sized by its own shape (already preloaded)
                  <img
                    key={o.url}
                    src={o.url}
                    alt={i === active ? `${chart.title}: ${o.label}` : ""}
                    aria-hidden={i !== active}
                    draggable={false}
                    decoding="async"
                    onLoad={() => setLoaded((l) => ({ ...l, [o.url]: true }))}
                    className={`col-start-1 row-start-1 mx-auto block h-auto max-h-[calc(100svh-8rem)] w-auto max-w-full rounded-[1.25rem] object-contain transition-[opacity,transform] duration-300 select-none ${
                      i === active ? (loaded[o.url] ? "opacity-100" : "opacity-0") : "pointer-events-none absolute inset-0 m-auto max-h-full scale-[0.98] opacity-0"
                    }`}
                  />
                ))}
                {!loaded[current.url] && (
                  <div aria-hidden className="col-start-1 row-start-1 grid size-[min(20rem,calc(100vw-3rem))] place-items-center">
                    <span className="size-7 animate-spin rounded-full border-2 border-ink/15 border-t-ink/60" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
