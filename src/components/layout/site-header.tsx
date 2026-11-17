"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef, useState } from "react";
import { useCartSummary } from "@/lib/api/hooks";
import type { CategoryNode } from "@/lib/api/types";
import { lockScroll } from "@/lib/motion/scroll-state";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useI18n } from "@/i18n/client";
import { fmt, plural } from "@/i18n/format";
import { LanguageSwitch } from "./language-switch";
import { MobileMenu } from "./mobile-menu";
import { SearchPanel } from "./search-panel";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function Marquee() {
  const { t } = useI18n();
  const items = t.nav.marquee;
  // Two identical halves: the track slides by -50% and loops seamlessly.
  const half = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {[...items, ...items].map((text, i) => (
        <span key={i} className="flex items-center gap-6 px-6 whitespace-nowrap">
          <span lang={/[؀-ۿ]/.test(text) ? "ar" : "en"} className="eyebrow !tracking-[0.1em]">
            {text}
          </span>
          <span className="h-3 w-px bg-ink/40" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-b border-ink/10 py-2" dir="ltr">
      <div className="marquee-track flex w-max">
        {half(false)}
        {half(true)}
      </div>
    </div>
  );
}

function CartLink() {
  const { lang, t, href } = useI18n();
  const { data } = useCartSummary();
  const count = data?.itemCount ?? 0;
  return (
    <Link href={href("/cart")} className="nav-link whitespace-nowrap tabular-nums" aria-label={plural(lang, t.nav.cartLabel, count)}>
      {fmt(t.nav.cart, { count })}
    </Link>
  );
}

export function SiteHeader({ categories }: { categories: CategoryNode[] }) {
  const { t, href } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const topCategories = categories.slice(0, 2);

  // Slides away while scrolling down, comes back on the way up.
  useGSAP(
    () => {
      const show = gsap.quickTo(ref.current, "yPercent", { duration: 0.6, ease: "power3.out" });
      ScrollTrigger.create({
        start: 160,
        end: "max",
        onUpdate: (self) => show(self.direction === 1 ? -130 : 0),
        onLeaveBack: () => show(0),
      });
    },
    { scope: ref },
  );

  const openSearch = () => {
    setSearchOpen(true);
    lockScroll(true);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    lockScroll(false);
  };
  const toggleMenu = (open: boolean) => {
    setMenuOpen(open);
    lockScroll(open);
  };

  return (
    <>
      <header ref={ref} className="fixed inset-x-0 top-0 z-50 px-2.5 pt-2.5 sm:px-4 sm:pt-4">
        <div className="overflow-hidden rounded-[14px] bg-glass shadow-[0_10px_40px_-20px_rgba(27,68,255,0.45)] backdrop-blur-xl dark:shadow-[0_10px_50px_-18px_rgba(27,68,255,0.6)] dark:ring-1 dark:ring-white/8">
          <Marquee />
          <nav aria-label={t.nav.main} className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4 sm:h-16 sm:px-6">
            <div className="flex items-center gap-7">
              <button
                type="button"
                className="nav-link lg:hidden"
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                onClick={() => toggleMenu(true)}
              >
                {t.nav.menu}
              </button>
              <Link href={href("/#pieces")} className="nav-link hidden lg:inline">
                {t.nav.bestSellers}
              </Link>
              {topCategories.map((c) => (
                <Link key={c.id} href={href(`/category/${c.slug}`)} lang="en" className="nav-link hidden lg:inline">
                  {c.name}
                </Link>
              ))}
            </div>

            <Link href={href("/")} aria-label={t.nav.homeLabel} className="block py-1">
              <Logo idle className="block h-7 w-auto sm:h-8" />
            </Link>

            <div className="flex items-center justify-end gap-5 sm:gap-6 xl:gap-7">
              <LanguageSwitch className="nav-link hidden lg:inline" />
              <ThemeToggle className="nav-link hidden lg:inline-flex" />
              <Link href={href("/account")} className="nav-link hidden lg:inline">
                {t.nav.account}
              </Link>
              <button type="button" className="nav-link hidden sm:inline" onClick={openSearch}>
                {t.nav.search}
              </button>
              <button type="button" className="nav-link sm:hidden" onClick={openSearch} aria-label={t.nav.search}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m13 13 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <CartLink />
            </div>
          </nav>
        </div>
      </header>
      <SearchPanel open={searchOpen} onClose={closeSearch} />
      <MobileMenu open={menuOpen} onClose={() => toggleMenu(false)} categories={categories} />
    </>
  );
}
