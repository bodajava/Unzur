"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { site } from "@/lib/site";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const CONCEPT_AR =
  "قطع متجرّدة في الفن، حرّة في التعبير، تتجاوز المألوف لتعيد تعريف العلاقة بين الأثاث والمساحة. تستلهم أشكالها من العمارة والهندسة والخيال، وتجمع بين الجرأة والبساطة في تفاصيل تحمل طابعًا خاصًا. أنظر لا يصمّم الأثاث ليملأ الفراغ، بل ليمنحه شخصية؛ كل قطعة حضور مستقل، وكل زاوية فرصة لرؤية الأشياء بشكل مختلف.";

/** The brand idea. Words come into focus one by one as the visitor scrolls. */
export function Concept() {
  const ref = useRef<HTMLElement>(null);

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
    { scope: ref },
  );

  return (
    <section ref={ref} aria-labelledby="concept-title" className="bg-haze px-6 pb-28 pt-16 sm:px-10 lg:px-14 lg:pb-44 lg:pt-24">
      <div className="mx-auto grid max-w-[90rem] gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <h2 id="concept-title" data-concept-title className="display text-[clamp(2.4rem,5.2vw,5rem)]">
            The concept
          </h2>
          <p className="mt-6 max-w-sm text-[0.95rem] leading-relaxed text-ash">
            Pieces made with the freedom of art. UNZUR does not design furniture to fill a room; it designs it to give
            the room a character.
          </p>
        </div>
        <div className="lg:col-span-8">
          <p
            lang="ar"
            dir="rtl"
            data-concept-text
            className="text-[clamp(1.3rem,2.55vw,2.35rem)] font-medium leading-[1.75]"
          >
            {CONCEPT_AR.split(" ").map((word, i) => (
              <span key={i} data-concept-word className="inline-block">
                {word}&nbsp;
              </span>
            ))}
          </p>
          <p lang="ar" dir="rtl" className="mt-10 text-[clamp(1.6rem,3.2vw,3rem)] font-semibold">
            {site.taglineAr}
          </p>
        </div>
      </div>
    </section>
  );
}
