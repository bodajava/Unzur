import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { ProductCard as Product } from "@/lib/api/types";

/** Initials stand in for a missing photo, set in the display face. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const price = product.salePrice ?? product.basePrice;
  return (
    <article className="group">
      <Link href={`/products/${product.slug}`} className="block focus-visible:outline-offset-4">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[10px] bg-mist">
          {product.primaryImage ? (
            <Image
              src={product.primaryImage.url}
              alt={product.primaryImage.altText ?? product.name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 26vw, 78vw"
              className="object-cover transition-transform duration-[1.2s] ease-float group-hover:scale-[1.04]"
            />
          ) : (
            <div
              aria-hidden
              className="display absolute inset-0 grid place-items-center text-[clamp(4rem,9vw,8rem)] text-pale transition-transform duration-[1.2s] ease-float group-hover:scale-[1.06]"
            >
              {initials(product.name)}
            </div>
          )}
          <span className="eyebrow absolute left-3 top-3 rounded-full bg-haze/85 px-2.5 py-1 text-[0.65rem] backdrop-blur">
            {product.category.name}
          </span>
        </div>
        <h3 className="display mt-4 text-[clamp(1.15rem,1.6vw,1.5rem)]">{product.name}</h3>
        <p className="mt-1.5 flex items-baseline gap-2 text-sm tabular-nums">
          <span>{formatPrice(price)}</span>
          {product.salePrice !== null && (
            <span className="text-ash line-through">
              <span className="sr-only">was </span>
              {formatPrice(product.basePrice)}
            </span>
          )}
        </p>
      </Link>
    </article>
  );
}
