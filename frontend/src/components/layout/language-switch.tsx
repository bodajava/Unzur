"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_COOKIE, switchLocalePath } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

/** Same page in the other language; remembers the choice for "/". */
export function LanguageSwitch({ className = "nav-link", onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  const other = lang === "ar" ? "en" : "ar";
  return (
    <Link
      href={switchLocalePath(pathname ?? "/", other)}
      hrefLang={other}
      lang={other}
      aria-label={t.nav.languageLabel}
      className={className}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; SameSite=Lax`;
        onNavigate?.();
      }}
    >
      {t.nav.language}
    </Link>
  );
}
