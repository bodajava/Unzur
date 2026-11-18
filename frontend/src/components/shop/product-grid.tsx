import { ProductCard } from "@/components/home/product-card";
import type { ProductCard as Product } from "@/lib/api/types";

/** Responsive grid: 2 columns on phones, 3 on tablets, 4 on wide screens. */
export function ProductGrid({ products, priorityCount = 4 }: { products: Product[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:gap-y-14 xl:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw" />
        </li>
      ))}
    </ul>
  );
}

/** Same layout as the grid while results stream in. */
export function GridSkeleton({ label, count = 8 }: { label: string; count?: number }) {
  return (
    <div role="status" aria-label={label}>
      <div className="mb-10 h-[4.6rem] border-y border-ink/15" />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} aria-hidden>
            <div className="aspect-[4/5] animate-pulse rounded-[10px] bg-panel" />
            <div className="mt-4 h-5 w-2/3 animate-pulse rounded bg-panel" />
            <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-panel" />
          </li>
        ))}
      </ul>
    </div>
  );
}
