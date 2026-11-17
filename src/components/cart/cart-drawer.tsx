"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/i18n/client";
import { useCartDrawer } from "./cart-drawer-context";
import { CartView } from "./cart-view";

/** Slides in from the end side (right in English, left in Arabic). */
export function CartDrawer() {
  const { t } = useI18n();
  const { open, closeCart } = useCartDrawer();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCart();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, closeCart]);

  return (
    <div
      className={`fixed inset-0 z-[70] transition-[visibility] duration-500 ${open ? "visible" : "invisible"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t.common.close}
        onClick={closeCart}
        className={`absolute inset-0 bg-night/40 backdrop-blur-[2px] transition-opacity duration-500 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t.cart.title}
        tabIndex={-1}
        className={`absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-canvas px-5 pt-5 pb-6 shadow-[0_0_80px_-20px_rgba(10,20,90,0.5)] transition-transform duration-500 ease-float focus:outline-none sm:px-7 sm:pt-7 ${
          open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
        } dark:border-s dark:border-white/10`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-3xl">{t.cart.title}</h2>
          <button type="button" onClick={closeCart} className="nav-link">
            {t.common.close}
          </button>
        </div>
        <div className="min-h-0 flex-1">{open && <CartView compact onNavigate={closeCart} />}</div>
      </div>
    </div>
  );
}
