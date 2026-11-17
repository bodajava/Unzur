"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { dirOf, localePath, type Locale } from "./config";
import type { Dictionary } from "./dictionaries/en";

interface I18n {
  lang: Locale;
  dir: "ltr" | "rtl";
  t: Dictionary;
  /** App path -> localized path ("/cart" -> "/ar/cart"). */
  href: (path?: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  const value = useMemo<I18n>(
    () => ({ lang, dir: dirOf(lang), t: dict, href: (path) => localePath(lang, path) }),
    [lang, dict],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Language, direction and copy for client components. */
export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
