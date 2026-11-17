"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef } from "react";
import { useI18n } from "@/i18n/client";
import { plural } from "@/i18n/format";
import type { ProductCard as Product } from "@/lib/api/types";
import { ProductCard } from "./product-card";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Depth per card: the row drifts at different heights, like objects in orbit. */
const DEPTHS = [0.2, -0.35, 0.5, -0.15, 0.35, -0.45, 0.1, -0.25];

export function Pieces({ products }: { products: Product[] }) {
  const { lang, dir, t, href } = useI18n();
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      // Desktop: vertical scroll moves the row sideways while it floats.
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const track = ref.current?.querySelector<HTMLElement>("[data-track]");
        if (!track) return;
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 56);
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: ref.current,
            start: "top top",
            end: () => `+=${distance() + window.innerHeight * 0.3}`,
            pin: true,
            scrub: 1.2,
            invalidateOnRefresh: true,
          },
        });
        // Right-to-left pages scroll the row the other way.
        const sign = dir === "rtl" ? 1 : -1;
        tl.to(track, { x: () => sign * distance(), duration: 1 }, 0);
        gsap.utils.toArray<HTMLElement>("[data-card]", ref.current).forEach((card, i) => {
          const d = DEPTHS[i % DEPTHS.length];
          tl.fromTo(card, { y: d * 90, rotation: d * 2.5 }, { y: -d * 90, rotation: -d * 2.5, duration: 1 }, 0);
        });
      });
      // Every size: cards arrive out of the distance.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-card]", {
          opacity: 0,
          y: 120,
          scale: 0.9,
          filter: "blur(10px)",
          duration: 1.4,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: ref.current, start: "top 70%", once: true },
        });
      });
    },
    { scope: ref, dependencies: [products.length, dir] },
  );

  return (
    <section ref={ref} id="pieces" aria-labelledby="pieces-title" className="overflow-hidden bg-page py-20 lg:flex lg:h-svh lg:flex-col lg:justify-center lg:py-0">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-6 sm:px-10 lg:px-14">
        <div>
          <p className="eyebrow text-muted">{plural(lang, t.pieces.count, products.length)}</p>
          <h2 id="pieces-title" className="display mt-3 text-[clamp(2.4rem,5.2vw,5rem)]">
            {t.pieces.title}
          </h2>
        </div>
        <Link href={href("/shop")} className="nav-link mb-2 shrink-0">
          {t.pieces.shopAll} {t.common.arrow}
        </Link>
      </div>

      {products.length ? (
        <ul
          data-track
          className="mt-12 flex snap-x snap-mandatory scroll-px-6 gap-5 overflow-x-auto overscroll-x-contain px-6 pb-6 [scrollbar-width:none] sm:scroll-px-10 sm:px-10 lg:mt-14 lg:snap-none lg:gap-8 lg:overflow-visible lg:px-14 lg:pb-0"
        >
          {products.map((p, i) => (
            <li key={p.id} data-card className="w-[78vw] shrink-0 snap-start sm:w-[44vw] lg:w-[24vw]">
              <ProductCard product={p} priority={i < 2} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-12 px-6 text-muted sm:px-10 lg:px-14">{t.pieces.empty}</p>
      )}
    </section>
  );
}
