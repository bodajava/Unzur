"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { OrderLookup, useOrderParams } from "./order-lookup";

/**
 * /checkout/result?orderNumber=…&placed=1 (after COD) or &success=… (back from Paymob).
 * A gift card purchase comes back with ?giftCardPayment=… instead of an order number.
 */
export function ResultView() {
  const search = useSearchParams();
  const params = useOrderParams(search);
  if (search.get("giftCardPayment")) {
    return <GiftCardResult success={search.get("success") === "true"} pending={search.get("pending") === "true"} />;
  }
  return <OrderLookup {...params} />;
}

function GiftCardResult({ success, pending }: { success: boolean; pending: boolean }) {
  const { t, href } = useI18n();
  const tg = t.account.giftCards;
  const body = success ? tg.paidBody : pending ? tg.pendingBody : tg.failedBody;
  return (
    <div className="mx-auto max-w-xl rounded-2xl bg-panel px-6 py-14 text-center dark:ring-1 dark:ring-white/8">
      {success && <h1 className="display text-[clamp(2rem,5vw,3rem)]">{tg.paidTitle}</h1>}
      <p className={`${success ? "mt-4" : ""} text-muted`} role="status">
        {body}
      </p>
      <Link
        href={`${href("/account")}#giftCards`}
        className="mt-8 inline-block rounded-full bg-blue px-6 py-3 text-sm font-semibold text-haze hover:bg-blue-deep"
      >
        {tg.toAccount}
      </Link>
    </div>
  );
}
