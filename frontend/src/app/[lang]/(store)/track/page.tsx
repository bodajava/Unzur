import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackView } from "@/components/checkout/track-view";
import { alternatesFor } from "@/i18n/config";
import { getDictionary, getLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return { title: t.order.trackTitle, description: t.order.trackIntro, alternates: alternatesFor(lang, "/track") };
}

export default function TrackPage() {
  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-panel" />}>
          <TrackView />
        </Suspense>
      </div>
    </section>
  );
}
