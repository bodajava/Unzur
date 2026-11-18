"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { useI18n } from "@/i18n/client";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** The brand idea. Words come into focus one by one as the visitor scrolls. */
export function Concept() {
  const { lang, t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const bodyLang = t.concept.bodyLang;
  const tagline = lang === "ar" ? "انظر أو كُفّ عن النظر" : "Look, or stop looking.";

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-concept-word]",
          { opacity: 0.12, filter: "blur(6px)" },
          {
            opacity: 1,
            filter: "blur(0px)",
            ease: "none",
            stagger: 0.12,
            scrollTrigger: { trigger: "[data-concept-text]", start: "top 80%", end: "bottom 45%", scrub: 1 },
          },
        );
        gsap.from("[data-concept-title]", {
          yPercent: 60,
          opacity: 0,
          duration: 1.4,
          ease: "expo.out",
          scrollTrigger: { trigger: ref.current, start: "top 75%", once: true },
        });
      });
    },
    { scope: ref, dependencies: [lang] },
  );

  return (
    <section ref={ref} aria-labelledby="concept-title" className="bg-page px-6 py-24 sm:px-10 sm:py-28 lg:px-14 lg:py-40">
      <div className="mx-auto grid max-w-[90rem] gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <h2 id="concept-title" data-concept-title className="display text-[clamp(2.4rem,5.2vw,5rem)]">
            {t.concept.title}
          </h2>
          <p className="mt-6 max-w-sm text-[0.95rem] leading-relaxed text-muted">{t.concept.intro}</p>
        </div>
        <div className="lg:col-span-8">
          <p
            lang={bodyLang}
            data-concept-text
            className={`text-[clamp(1.3rem,2.55vw,2.35rem)] font-medium ${bodyLang === "ar" ? "leading-[1.75]" : "leading-[1.35] tracking-[-0.01em]"}`}
          >
            {t.concept.body.split(" ").map((word, i) => (
              <span key={i} data-concept-word className="inline-block">
                {word}&nbsp;
              </span>
            ))}
          </p>
          <p className="mt-10 text-[clamp(1.6rem,3.2vw,3rem)] font-semibold">{tagline}</p>
        </div>
      </div>
    </section>
  );
}
