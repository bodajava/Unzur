"use client";

import { useLayoutEffect } from "react";

/**
 * The storefront is always light. The head script already handles a fresh
 * load; this covers coming back from the dashboard without a reload.
 */
export function ForceLight() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);
  return null;
}
