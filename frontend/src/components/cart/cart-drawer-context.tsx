"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { lockScroll } from "@/lib/motion/scroll-state";

interface CartDrawerState {
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const Ctx = createContext<CartDrawerState>({ open: false, openCart: () => {}, closeCart: () => {} });

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openCart = useCallback(() => {
    setOpen(true);
    lockScroll(true);
  }, []);
  const closeCart = useCallback(() => {
    setOpen(false);
    lockScroll(false);
  }, []);
  const value = useMemo(() => ({ open, openCart, closeCart }), [open, openCart, closeCart]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCartDrawer = () => useContext(Ctx);
