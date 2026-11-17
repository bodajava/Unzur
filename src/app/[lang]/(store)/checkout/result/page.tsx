import type { Metadata } from "next";
import { Suspense } from "react";
import { ResultView } from "@/components/checkout/result-view";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.order.trackTitle, robots: { index: false, follow: false } };
}

export default function CheckoutResultPage() {
  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-panel" />}>
          <ResultView />
        </Suspense>
      </div>
    </section>
  );
}
