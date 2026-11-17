"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { User } from "@/lib/api/types";

/** The store's glass bar, with the dashboard's sections. */
export function AdminHeader({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { t, href } = useI18n();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const links = [
    { href: href("/admin"), label: t.admin.nav.overview, exact: true },
    { href: href("/admin/orders"), label: t.admin.nav.orders },
    { href: href("/admin/products"), label: t.admin.nav.products },
  ];
  const active = (l: { href: string; exact?: boolean }) => (l.exact ? pathname === l.href : pathname.startsWith(l.href));
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email;

  const navLink = (l: (typeof links)[number], mobile = false) => (
    <Link
      key={l.href}
      href={l.href}
      onClick={() => setOpen(false)}
      aria-current={active(l) ? "page" : undefined}
      className={
        mobile
          ? `block rounded-xl px-3 py-2.5 text-lg ${active(l) ? "bg-current/10 font-semibold" : ""}`
          : `rounded-full px-3.5 py-1.5 text-sm transition-colors ${active(l) ? "bg-current/12 font-semibold" : "hover:bg-current/8"}`
      }
    >
      {l.label}
    </Link>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-2.5 pt-2.5 sm:px-4 sm:pt-4">
      <LiquidGlass radius={14} tone="light">
        <nav aria-label={t.admin.nav.main} className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Link href={href("/admin")} className="flex shrink-0 items-center gap-3">
            <Logo title="UNZUR" className="block h-6 w-auto sm:h-7" />
            <span className="eyebrow hidden opacity-70 sm:inline">{t.admin.title}</span>
          </Link>

          <div className="ms-4 hidden items-center gap-1 lg:flex">{links.map((l) => navLink(l))}</div>

          <div className="ms-auto flex items-center gap-4 sm:gap-5">
            <LanguageSwitch className="nav-link hidden text-sm md:inline" />
            <ThemeToggle className="nav-link hidden text-sm md:inline-flex" />
            <Link href={href("/")} className="nav-link hidden text-sm xl:inline">
              {t.admin.nav.viewStore}
            </Link>
            <div className="hidden text-end leading-tight md:block">
              <p className="max-w-[12rem] truncate text-sm font-semibold" title={fmt(t.admin.nav.signedInAs, { name })}>
                {name}
              </p>
              <p className="text-[0.7rem] opacity-60">{t.admin.roles[user.role]}</p>
            </div>
            <button type="button" onClick={onSignOut} className="nav-link hidden text-sm md:inline">
              {t.admin.nav.signOut}
            </button>
            <button
              type="button"
              className="nav-link text-sm lg:hidden"
              aria-expanded={open}
              aria-controls="admin-menu"
              onClick={() => setOpen((v) => !v)}
            >
              {t.admin.nav.menu}
            </button>
          </div>
        </nav>

        {open && (
          <div id="admin-menu" className="border-t border-current/10 px-3 pt-2 pb-4 lg:hidden">
            {links.map((l) => navLink(l, true))}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-current/10 px-3 pt-4 text-sm">
              <span className="font-semibold">
                {name} <span className="font-normal opacity-60">· {t.admin.roles[user.role]}</span>
              </span>
              <LanguageSwitch />
              <ThemeToggle />
              <Link href={href("/")} className="nav-link">
                {t.admin.nav.viewStore}
              </Link>
              <button type="button" onClick={onSignOut} className="nav-link">
                {t.admin.nav.signOut}
              </button>
            </div>
          </div>
        )}
      </LiquidGlass>
    </header>
  );
}
