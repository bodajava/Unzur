"use client";

import { useCartDrawer } from "@/components/cart/cart-drawer-context";
import { useAddToCart } from "@/lib/api/hooks";
import type { AddToCartInput } from "@/lib/api/types";
import { flyToCart } from "@/lib/motion/fly-to-cart";

/**
 * Add to cart with the flight: the photo (`from`, or the image inside it)
 * takes off for the header's cart while the request runs; the cart opens once
 * both the item is in and the photo has landed. If the add fails the photo
 * fades out mid-air and the error shows as before.
 */
export function useFlyingAdd() {
  const add = useAddToCart();
  const { openCart } = useCartDrawer();

  const run = (input: AddToCartInput, from: Element | null, imageUrl?: string | null, done?: () => void) => {
    const img = from instanceof HTMLImageElement ? from : from?.querySelector("img");
    const flight = flyToCart(from, imageUrl ?? img?.currentSrc ?? img?.src ?? null);
    add.mutate(input, {
      onSuccess: async () => {
        await flight.landed;
        done?.();
        openCart();
      },
      onError: () => flight.cancel(),
    });
  };

  return { add, run };
}
