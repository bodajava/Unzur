"use client";

import { useSearchParams } from "next/navigation";
import { OrderLookup, useOrderParams } from "./order-lookup";

/** /checkout/result?orderNumber=…&placed=1 (after COD) or &success=… (back from Paymob). */
export function ResultView() {
  const params = useOrderParams(useSearchParams());
  return <OrderLookup {...params} />;
}
