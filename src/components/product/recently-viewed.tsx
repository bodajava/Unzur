"use client";

import { ProductCard } from "@/components/home/product-card";
import { useI18n } from "@/i18n/client";
import { useRecentlyViewed } from "@/lib/api/hooks";

export function RecentlyViewed({ excludeId }: { excludeId: string }) {
  const { t } = useI18n();
  const { data } = useRecentlyViewed();
  const items = (data ?? []).filter((p) => p.id !== excludeId).slice(0, 4);
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent-title" className="mt-24 lg:mt-32">
      <h2 id="recent-title" className="display text-[clamp(1.8rem,4vw,3rem)]">
        {t.productPage.recentlyViewed}
      </h2>
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4">
        {items.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} sizes="(min-width: 768px) 22vw, 46vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}
