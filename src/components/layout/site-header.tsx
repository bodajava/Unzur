"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef, useState } from "react";
import { useCartSummary } from "@/lib/api/hooks";
import type { CategoryNode } from "@/lib/api/types";
import { lockScroll } from "@/lib/motion/scroll-state";
import { site } from "@/lib/site";
import { MobileMenu } from "./mobile-menu";
import { SearchPanel } from "./search-panel";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const MARQUEE = ["UNZUR", site.taglineAr, "Look, or stop looking", "Furniture & lighting"];

function Marquee() {
  // Two identical halves: the track slides by -50% and loops seamlessly.
  const half = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {[...MARQUEE, ...MARQUEE].map((text, i) => (
        <span key={i} className="flex items-center gap-6 px-6 whitespace-nowrap">
          <span lang={/[؀-ۿ]/.test(text) ? "ar" : undefined} className="eyebrow !tracking-[0.1em]">
            {text}
          </span>
          <span className="h-3 w-px bg-blue/40" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-b border-blue/10 py-2">
      <div className="marquee-track flex w-max">
        {half(false)}
        {half(true)}
      </div>
    </div>
  );
}

function CartLink() {
  const { data } = useCartSummary();
  const count = data?.itemCount ?? 0;
  return (
    <Link href="/cart" className="nav-link tabular-nums" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
      Cart: {count}
    </Link>
  );
}

export function SiteHeader({ categories }: { categories: CategoryNode[] }) {
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
        <div className="overflow-hidden rounded-[14px] bg-haze/90 shadow-[0_10px_40px_-20px_rgba(27,68,255,0.45)] backdrop-blur-xl">
          <Marquee />
          <nav aria-label="Main" className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4 sm:h-16 sm:px-6">
            <div className="flex items-center gap-7">
              <button
                type="button"
                className="nav-link lg:hidden"
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                onClick={() => toggleMenu(true)}
              >
                Menu
              </button>
              <Link href="/#pieces" className="nav-link hidden lg:inline">
                Best sellers
              </Link>
              {topCategories.map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`} className="nav-link hidden lg:inline">
                  {c.name}
                </Link>
              ))}
            </div>

            <Link href="/" aria-label={`${site.name} home`} className="wordmark text-[2.35rem] sm:text-[2.75rem]">
              {site.name}
            </Link>

            <div className="flex items-center justify-end gap-5 sm:gap-7">
              <Link href="/account" className="nav-link hidden lg:inline">
                Account
              </Link>
              <button type="button" className="nav-link hidden sm:inline" onClick={openSearch}>
                Search
              </button>
              <button type="button" className="nav-link sm:hidden" onClick={openSearch} aria-label="Search">
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
