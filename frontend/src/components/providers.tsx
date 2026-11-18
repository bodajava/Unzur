"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect, useState, type ReactNode } from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartDrawerProvider } from "@/components/cart/cart-drawer-context";
import { scrollState } from "@/lib/motion/scroll-state";

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth, weightless scrolling (Lenis) driven by GSAP's ticker so every
 * ScrollTrigger animation stays in sync. Off when the user prefers reduced motion.
 */
function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.9, anchors: { offset: -96 } });
    scrollState.lenis = lenis;
    lenis.on("scroll", (l: Lenis) => {
      scrollState.velocity = l.velocity;
      ScrollTrigger.update();
    });
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      scrollState.lenis = null;
      lenis.destroy();
    };
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <SmoothScroll />
      <CartDrawerProvider>
        {children}
        <CartDrawer />
      </CartDrawerProvider>
    </QueryClientProvider>
  );
}
