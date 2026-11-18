"use client";

import { useSearchParams } from "next/navigation";
import { OrderLookup } from "./order-lookup";

/** /track?orderNumber=… (links in order emails and "My orders") opens that order. */
export function TrackView() {
  const search = useSearchParams();
  const orderNumber = search.get("orderNumber") ?? search.get("order") ?? undefined;
  return <OrderLookup key={orderNumber} orderNumber={orderNumber} />;
}
