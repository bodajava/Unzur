"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef } from "react";
import { site } from "@/lib/site";
import { Starfield } from "./starfield";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const TICKS = 33;

/** An eye (UNZUR / أنظر = "look"). The pupil follows the pointer on desktop. */
function Eye({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden>
      <path
        d="M2 20C10 8 20 2 32 2s22 6 30 18c-8 12-18 18-30 18S10 32 2 20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <circle data-pupil cx="32" cy="20" r="9" fill="currentColor" />
    </svg>
  );
}

export function Hero({ words }: { words: string[] }) {
  const root = useRef<HTMLElement>(null);
  const progress = useRef(0);
  // Loop list for the right-hand word switcher (first word repeated at the end).
  const loop = words.length ? [...words, words[0]] : ["Furniture", "Lights", "Furniture"];

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          desktop: "(min-width: 1024px)",
          finePointer: "(pointer: fine)",
        },
        (ctx) => {
          const { motion, finePointer } = ctx.conditions as Record<string, boolean>;
          if (!motion) return;

          // ── Arrival: letters drift in from deep space ──
          const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
          intro
            .from(q("[data-letter]"), {
              opacity: 0,
              scale: 0.4,
              z: -400,
              filter: "blur(18px)",
              duration: 2,
              stagger: { each: 0.09, from: "center" },
            })
            .from(q("[data-rise]"), { opacity: 0, y: 40, duration: 1.4, stagger: 0.08 }, 0.5)
            .from(q("[data-tick]"), { scaleY: 0, duration: 0.8, stagger: { each: 0.012, from: "start" } }, 0.8);

          // ── Zero gravity: the logo never stops floating ──
          gsap.to(q("[data-float]"), {
            y: -16,
            rotation: 1.4,
            duration: 3.4,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });

          // ── Words on the right take turns next to the eye ──
          const rows = q("[data-word]");
          const step = () => (q("[data-word-track]")[0] as HTMLElement).offsetHeight / loop.length;
          const cycle = gsap.timeline({ repeat: -1 });
          for (let i = 1; i < loop.length; i++) {
            cycle
              .to(q("[data-word-track]"), { y: () => -step() * i, duration: 0.9, ease: "power3.inOut" }, `+=2.1`)
              .to(rows, { opacity: (j: number) => (j === i ? 1 : j === i + 1 ? 0.3 : 0), duration: 0.9 }, "<");
          }
          cycle.set(q("[data-word-track]"), { y: 0 });
          gsap.set(rows, { opacity: (j: number) => (j === 0 ? 1 : j === 1 ? 0.3 : 0) });

          // ── Pointer: the logo tilts, the pupil looks at you ──
          if (finePointer) {
            const tiltX = gsap.quickTo(q("[data-tilt]"), "rotationY", { duration: 1.2, ease: "power3.out" });
            const tiltY = gsap.quickTo(q("[data-tilt]"), "rotationX", { duration: 1.2, ease: "power3.out" });
            const pupilX = gsap.quickTo(q("[data-pupil]"), "x", { duration: 0.5, ease: "power3.out" });
            const pupilY = gsap.quickTo(q("[data-pupil]"), "y", { duration: 0.5, ease: "power3.out" });
            const onMove = (e: PointerEvent) => {
              const nx = e.clientX / window.innerWidth - 0.5;
              const ny = e.clientY / window.innerHeight - 0.5;
              tiltX(nx * 16);
              tiltY(-ny * 12);
              pupilX(nx * 22);
              pupilY(ny * 14);
            };
            window.addEventListener("pointermove", onMove);
            return () => window.removeEventListener("pointermove", onMove);
          }
        },
      );

      // ── Scroll: fly through the logo into the page ──
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "+=120%",
            pin: true,
            scrub: 1.1,
            onUpdate: (self) => {
              progress.current = self.progress;
            },
          },
        });
        tl.to(q("[data-depart]"), { opacity: 0, y: -80, filter: "blur(10px)", duration: 0.35, stagger: 0.03 }, 0)
          .to(q("[data-tick]"), { scaleY: 2.2, backgroundColor: "#e8e8e5", duration: 0.4, stagger: 0.012 }, 0)
          .to(q("[data-zoom]"), { scale: 26, duration: 1, ease: "power3.in" }, 0.05)
          .to(q("[data-veil]"), { opacity: 1, duration: 0.18 }, 0.87);
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      aria-labelledby="hero-title"
      className="relative h-svh min-h-[620px] overflow-hidden bg-blue text-haze"
    >
      <Starfield progress={progress} className="absolute inset-0 h-full w-full" />

      {/* Centre: the floating wordmark (decorative; the header carries the brand link). */}
      <div className="pointer-events-none absolute inset-x-0 top-[45%] flex -translate-y-1/2 justify-center [perspective:1000px] xl:top-1/2">
        <div data-zoom className="origin-center will-change-transform">
          <div data-tilt className="[transform-style:preserve-3d]">
            <div
              data-float
              aria-hidden
              className="wordmark flex text-[min(25vw,21svh)] text-haze [text-shadow:0_30px_80px_rgba(8,22,120,0.35)] xl:text-[min(12vw,30svh)]"
            >
              {site.name.split("").map((letter, i) => (
                <span key={i} data-letter className="inline-block">
                  {letter}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Left: headline + call to action */}
      <div className="absolute inset-x-0 bottom-[7.75rem] px-6 sm:px-10 xl:bottom-auto xl:top-1/2 xl:max-w-[26rem] xl:-translate-y-1/2 xl:px-14">
        <div data-depart>
          <h1 id="hero-title">
            <span data-rise className="display block text-[clamp(2.2rem,4.4vw,4.1rem)]">
              Look
              <br />
              closer.
            </span>
            <span data-rise className="eyebrow mt-4 block text-pale">
              Sculptural furniture &amp; lighting
            </span>
          </h1>
          <p data-rise className="mt-5 max-w-[22rem] text-[0.98rem] leading-relaxed text-haze/85 [@media(max-height:760px)]:hidden">
            Chairs, tables and lights shaped by architecture and imagination. Every piece is made to be looked at.
          </p>
          <Link
            data-rise
            href="/#pieces"
            className="mt-7 inline-flex items-center gap-3 rounded-full border-2 border-haze px-6 py-2.5 text-[0.95rem] font-semibold transition-colors duration-300 hover:bg-haze hover:text-blue"
          >
            Shop the pieces
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      {/* Right: what there is to look at */}
      <div
        data-depart
        className="absolute right-5 top-[7.5rem] text-[clamp(1.25rem,2.5vw,2.4rem)] sm:right-10 sm:top-[8.75rem] xl:right-14 xl:top-[10.5rem]"
      >
        <div className="flex items-start gap-[0.35em]">
          <div className="h-[2.4em] overflow-hidden">
            <ul data-word-track aria-label="Collections">
              {loop.map((w, i) => (
                <li
                  key={`${w}-${i}`}
                  data-word
                  aria-hidden={i === loop.length - 1 || undefined}
                  className="display h-[1.2em] text-right leading-[1.2em] whitespace-nowrap"
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>
          <Eye className="mt-[0.05em] w-[1.9em] shrink-0 text-haze" />
        </div>
      </div>

      {/* Bottom: the ruler fills up as you fly in */}
      <div className="absolute inset-x-6 bottom-7 sm:inset-x-10 lg:inset-x-14" data-depart>
        <div className="flex justify-between text-[0.7rem] tracking-[0.12em] uppercase text-pale sm:text-xs">
          <span>Look</span>
          <span lang="ar" className="tracking-normal">
            {site.taglineAr}
          </span>
          <span>Look closer</span>
        </div>
        <div className="mt-2 flex h-4 items-end justify-between border-b-2 border-haze">
          {Array.from({ length: TICKS }, (_, i) => (
            <span
              key={i}
              data-tick
              className={`w-[2px] origin-bottom bg-pale ${i % 4 === 0 ? "h-3.5" : "h-2"} ${i % 2 ? "max-sm:hidden" : ""}`}
            />
          ))}
        </div>
        <p className="mt-2.5 text-center text-xs text-haze/70">Scroll to fly in</p>
      </div>

      {/* Fades to the next section's colour at the end of the fly-through */}
      <div data-veil aria-hidden className="pointer-events-none absolute inset-0 bg-haze opacity-0" />
    </section>
  );
}
