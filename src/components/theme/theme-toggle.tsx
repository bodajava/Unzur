"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";
import { THEME_KEY, type Theme } from "./theme";

const listeners = new Set<() => void>();

function read(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function saved(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "light" ? t : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Follow the system setting until the visitor picks a theme.
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (!saved()) apply(media.matches ? "dark" : "light");
  };
  media.addEventListener("change", onSystem);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystem);
  };
}

/** Current theme + a setter that remembers the choice. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);

  // React's dev remount can reset <html> attributes; put the theme back before paint.
  useLayoutEffect(() => {
    const want = saved() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (read() !== want) apply(want);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode: still switches for this visit */
    }
    apply(next);
  }, []);

  return { theme, setTheme };
}

/** "Night" / "Day" switch. Night turns the whole site into open space. */
/** className must include the display (e.g. "inline-flex" or "hidden lg:inline-flex"). */
export function ThemeToggle({ className = "nav-link inline-flex" }: { className?: string }) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className={`${className} items-center gap-1.5`}
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? t.theme.toDay : t.theme.toNight}
      aria-pressed={dark}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className="shrink-0">
        {dark ? (
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="8" cy="8" r="3.2" />
            <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3" />
          </g>
        ) : (
          <path d="M13.5 9.8A6 6 0 0 1 6.2 2.5a6 6 0 1 0 7.3 7.3Z" fill="currentColor" />
        )}
      </svg>
      <span suppressHydrationWarning>{dark ? t.theme.day : t.theme.night}</span>
    </button>
  );
}
