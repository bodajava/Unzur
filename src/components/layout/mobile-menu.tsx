"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { CategoryNode } from "@/lib/api/types";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useI18n } from "@/i18n/client";
import { localized } from "@/i18n/format";
import { LanguageSwitch } from "./language-switch";

export function MobileMenu({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryNode[];
}) {
  const { lang, t, href } = useI18n();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const links = [
    { href: href("/#pieces"), label: t.nav.bestSellers },
    ...categories.map((c) => ({ href: href(`/category/${c.slug}`), label: localized(lang, c.name, c.nameAr) })),
    { href: href("/account"), label: t.nav.account },
  ];

  return (
    <div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label={t.nav.menu}
      className="fixed inset-0 z-[60] flex flex-col bg-blue px-6 pb-10 pt-6 text-haze dark:bg-night dark:text-on-hero"
    >
      <div className="flex items-center justify-between">
        <Logo title="UNZUR" className="block h-8 w-auto dark:text-blue" />
        <button type="button" onClick={onClose} className="nav-link" autoFocus>
          {t.common.close}
        </button>
      </div>
      <nav aria-label={t.nav.mobile} className="mt-auto">
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={onClose}
                lang={/[\u0600-\u06ff]/.test(l.label) ? "ar" : "en"}
                className="display block text-[clamp(2.25rem,11vw,3.5rem)]"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex items-center gap-6 text-pale">
          <LanguageSwitch onNavigate={onClose} />
          <ThemeToggle />
        </div>
        <p className="mt-6 text-pale/80">{t.common.tagline}</p>
      </nav>
    </div>
  );
}
