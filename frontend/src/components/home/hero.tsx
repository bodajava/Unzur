"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef } from "react";
import { useI18n } from "@/i18n/client";
import { EyeMark, Logo, LOGO_BOX, PUPIL } from "@/components/brand/logo";
import { Starfield } from "./starfield";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const TICKS = 33;
/** Pupil centre as a fraction of the logo box: the fly-through dives into it. */
const ORIGIN = `${(PUPIL.x / LOGO_BOX.width) * 100}% ${(PUPIL.y / LOGO_BOX.height) * 100}%`;

export function Hero({ words }: { words: string[] }) {
  const { t, href } = useI18n();
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
          finePointer: "(pointer: fine)",
        },
        (ctx) => {
          const { motion, finePointer } = ctx.conditions as Record<string, boolean>;
          if (!motion) return;

          // ── Arrival: the mark drifts in from deep space ──
          const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
          intro
            .from(q("[data-logo]"), { filter: "blur(16px)", duration: 2.2 }, 0)
            .from(
              q("[data-logo] [data-letter]"),
              {
                opacity: 0,
                y: 90,
                scale: 0.5,
                transformOrigin: "50% 50%",
                duration: 2,
                stagger: { each: 0.09, from: "center" },
              },
              0,
            )
            .from(q("[data-glow]"), { opacity: 0, scale: 0.6, duration: 2.4 }, 0.2)
            .from(q("[data-rise]"), { opacity: 0, y: 40, duration: 1.4, stagger: 0.08 }, 0.5)
            .from(q("[data-tick]"), { scaleY: 0, duration: 0.8, stagger: { each: 0.012, from: "start" } }, 0.8);

          // ── Zero gravity: the logo never stops floating ──
          gsap.to(q("[data-float]"), {
            y: -16,
            rotation: 1.2,
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

          // ── The eyes: they blink, and they look around (or at you) ──
          const pupils = q("[data-pupil]");
          const lids = q("[data-lid]");
          gsap.set(lids, { transformOrigin: "50% 50%" });
          const blink = gsap.timeline({ repeat: -1, repeatDelay: 3.6, delay: 2.4 });
          blink
            .to(lids, { scaleY: 0.04, duration: 0.11, ease: "power2.in" })
            .to(lids, { scaleY: 1, duration: 0.2, ease: "power2.out" })
            .to(lids, { scaleY: 0.04, duration: 0.1, ease: "power2.in" }, "+=2.8")
            .to(lids, { scaleY: 1, duration: 0.18, ease: "power2.out" })
            .to(lids, { scaleY: 0.04, duration: 0.1, ease: "power2.in" }, "+=0.12")
            .to(lids, { scaleY: 1, duration: 0.2, ease: "power2.out" });

          // Touch screens: the eye wanders like it does in the logo film.
          const wander = gsap.timeline({ repeat: -1, delay: 1.6, paused: finePointer });
          wander
            .to(pupils, { x: -12, duration: 0.7, ease: "power3.inOut" }, "+=1.4")
            .to(pupils, { x: 12, duration: 0.9, ease: "power3.inOut" }, "+=1.2")
            .to(pupils, { x: 0, duration: 0.7, ease: "power3.inOut" }, "+=1.2");

          let flying = false;
          const tiltX = gsap.quickTo(q("[data-tilt]"), "rotationY", { duration: 1.2, ease: "power3.out" });
          const tiltY = gsap.quickTo(q("[data-tilt]"), "rotationX", { duration: 1.2, ease: "power3.out" });
          const pupilX = gsap.quickTo(pupils, "x", { duration: 0.5, ease: "power3.out" });
          const pupilY = gsap.quickTo(pupils, "y", { duration: 0.5, ease: "power3.out" });

          // ── Scroll: look closer — fly into the pupil and out into the page ──
          const tilt = q("[data-tilt]")[0] as HTMLElement;
          const at = () => {
            const r = tilt.getBoundingClientRect();
            const s = (root.current as HTMLElement).getBoundingClientRect();
            return {
              dx: s.left + s.width / 2 - (r.left + (r.width * PUPIL.x) / LOGO_BOX.width),
              dy: s.top + s.height / 2 - (r.top + (r.height * PUPIL.y) / LOGO_BOX.height),
              // pupil must outgrow the screen's diagonal
              scale: (Math.hypot(s.width, s.height) / ((r.width * 24) / LOGO_BOX.width)) * 1.15,
            };
          };
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "+=110%",
              pin: true,
              scrub: 0.8,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                progress.current = self.progress;
                const now = self.progress > 0.005;
                if (now === flying) return;
                flying = now;
                if (flying) {
                  // Hold still and look straight ahead before the dive.
                  wander.pause();
                  blink.pause();
                  gsap.to(lids, { scaleY: 1, duration: 0.2 });
                  pupilX(0);
                  pupilY(0);
                  tiltX(0);
                  tiltY(0);
                } else {
                  blink.resume();
                  if (!finePointer) wander.resume();
                }
              },
            },
          });
          tl.to(q("[data-depart]"), { opacity: 0, y: -80, filter: "blur(10px)", duration: 0.35, stagger: 0.03 }, 0)
            .to(q("[data-glow]"), { opacity: 0, duration: 0.3 }, 0)
            .to(q("[data-tick]"), { scaleY: 2.2, opacity: 1, duration: 0.4, stagger: 0.012 }, 0)
            .to(q("[data-zoom]"), { x: () => at().dx, y: () => at().dy, duration: 0.45, ease: "power2.inOut" }, 0.02)
            .to(q("[data-zoom]"), { scale: () => at().scale, duration: 0.8, ease: "expo.in" }, 0.05)
            .to(q("[data-veil]"), { opacity: 1, duration: 0.12 }, 0.76)
            // Once the veil is opaque, drop the giant pupil so no sub-pixel edge shows through.
            .set(q("[data-zoom]"), { autoAlpha: 0 }, 0.88)
            // a short beat inside the pupil before the pieces slide up
            .to({}, { duration: 0.04 });

          // ── Pointer: the logo tilts, the eyes follow you ──
          if (finePointer) {
            const onMove = (e: PointerEvent) => {
              if (flying) return;
              const nx = e.clientX / window.innerWidth - 0.5;
              const ny = e.clientY / window.innerHeight - 0.5;
              tiltX(nx * 14);
              tiltY(-ny * 10);
              pupilX(nx * 24);
              pupilY(ny * 12);
            };
            window.addEventListener("pointermove", onMove);
            return () => window.removeEventListener("pointermove", onMove);
          }
        },
      );
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      aria-labelledby="hero-title"
      data-header-tone="blue"
      className="relative h-svh min-h-[620px] overflow-hidden bg-hero text-on-hero"
    >
      <Starfield progress={progress} className="absolute inset-0 h-full w-full" />

      {/* Centre: the floating mark (decorative; the header carries the brand link). */}
      <div className="pointer-events-none absolute inset-x-0 top-[39%] flex -translate-y-1/2 justify-center [perspective:1200px] sm:top-[42%] xl:top-1/2">
        <div
          data-glow
          aria-hidden
          className="absolute top-1/2 left-1/2 h-[60%] w-[min(110vw,1100px)] -translate-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(232,232,229,0.22),rgba(167,182,255,0.12)_55%,transparent)] blur-2xl dark:bg-[radial-gradient(closest-side,rgba(27,68,255,0.5),rgba(27,68,255,0.16)_55%,transparent)]"
        />
        <div data-float className="relative">
          <div data-tilt className="w-[min(84vw,52svh)] [transform-style:preserve-3d] sm:w-[min(82vw,60svh)] xl:w-[min(40vw,84svh)]">
            <div data-zoom style={{ transformOrigin: ORIGIN }}>
              <div data-logo>
                <Logo className="block h-auto w-full text-mark" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Left: headline + call to action */}
      <div className="absolute inset-x-0 bottom-[7.75rem] px-6 sm:px-10 xl:bottom-auto xl:top-1/2 xl:max-w-[26rem] xl:-translate-y-1/2 xl:px-14">
        <div data-depart>
          <h1 id="hero-title">
            <span data-rise className="display block text-[clamp(2.2rem,4.4vw,4.1rem)]">
              {t.hero.titleLine1}
              <br />
              {t.hero.titleLine2}
            </span>
            <span data-rise className="eyebrow mt-4 block text-hero-accent">
              {t.hero.eyebrow}
            </span>
          </h1>
          <p data-rise className="mt-5 max-w-[22rem] text-[0.98rem] leading-relaxed text-on-hero/85 [@media(max-height:760px)]:hidden">
            {t.hero.body}
          </p>
          <Link
            data-rise
            href={href("/#pieces")}
            className="mt-7 inline-flex items-center gap-3 rounded-full border-2 border-on-hero px-6 py-2.5 text-[0.95rem] font-semibold transition-colors duration-300 hover:bg-on-hero hover:text-blue dark:hover:text-night"
          >
            {t.hero.cta}
            <span aria-hidden>{t.common.arrow}</span>
          </Link>
        </div>
      </div>

      {/* Right: what there is to look at */}
      <div
        data-depart
        className="absolute end-5 top-[7.5rem] text-[clamp(1.25rem,2.5vw,2.4rem)] sm:end-10 sm:top-[8.75rem] xl:end-14 xl:top-[10.5rem]"
      >
        <div className="flex items-start gap-[0.35em]">
          <div className="h-[2.4em] overflow-hidden">
            <ul data-word-track aria-label={t.hero.collections}>
              {loop.map((w, i) => (
                <li
                  key={`${w}-${i}`}
                  data-word
                  lang={/[\u0600-\u06ff]/.test(w) ? "ar" : "en"}
                  aria-hidden={i === loop.length - 1 || undefined}
                  className="display h-[1.2em] text-end leading-[1.2em] whitespace-nowrap"
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>
          <EyeMark className="mt-[0.02em] w-[1.5em] shrink-0 text-on-hero dark:text-blue" />
        </div>
      </div>

      {/* Bottom: the ruler fills up as you fly in */}
      <div className="absolute inset-x-6 bottom-7 sm:inset-x-10 lg:inset-x-14" data-depart>
        <div className="flex justify-between text-[0.7rem] tracking-[0.12em] uppercase text-hero-accent sm:text-xs">
          <span>{t.hero.rulerStart}</span>
          <span className="tracking-normal">{t.common.tagline}</span>
          <span>{t.hero.rulerEnd}</span>
        </div>
        <div className="mt-2 flex h-4 items-end justify-between border-b-2 border-on-hero">
          {Array.from({ length: TICKS }, (_, i) => (
            <span
              key={i}
              data-tick
              className={`w-[2px] origin-bottom bg-hero-accent opacity-80 ${i % 4 === 0 ? "h-3.5" : "h-2"} ${i % 2 ? "max-sm:hidden" : ""}`}
            />
          ))}
        </div>
        <p className="mt-2.5 text-center text-xs text-on-hero/70">{t.hero.scrollHint}</p>
      </div>

      {/* Fades to the next section's colour at the end of the fly-through */}
      <div data-veil aria-hidden className="pointer-events-none absolute inset-0 bg-canvas opacity-0" />
    </section>
  );
}
