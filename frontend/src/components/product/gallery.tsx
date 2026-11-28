"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { EyeMark } from "@/components/brand/logo";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { ProductImage } from "@/lib/api/types";
import { useProductSelection } from "./selection";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

/**
 * Phones: photos side by side, swipe through (scroll-snap).
 * Desktop: one large photo with thumbnails under it.
 * No photos yet: the piece's initials on the panel colour, with the eye.
 */
export function Gallery({ name, images }: { name: string; images: ProductImage[] }) {
  const { imageId } = useProductSelection();
  if (!images.length) return <NoPhotos name={name} />;
  // A colour with its own photo opens the gallery on it (remounted per choice).
  const start = Math.max(0, images.findIndex((img) => img.id === imageId));
  return <Photos key={imageId ?? "main"} name={name} images={images} start={start} />;
}

function NoPhotos({ name }: { name: string }) {
  return (
      <div className="relative mx-auto grid aspect-[4/5] w-full max-w-[min(100%,calc(58svh*0.8))] place-items-center overflow-hidden rounded-2xl bg-panel lg:max-w-[min(100%,calc(74svh*0.8))] dark:ring-1 dark:ring-white/8">
        <span aria-hidden lang="en" className="display text-[clamp(5rem,14vw,12rem)] text-soft">
          {initials(name)}
        </span>
        <EyeMark idle className="absolute bottom-6 start-6 w-12 text-soft" />
      </div>
  );
}

function Photos({ name, images, start }: { name: string; images: ProductImage[]; start: number }) {
  const { t } = useI18n();
  const [active, setActive] = useState(start);
  const strip = useRef<HTMLUListElement>(null);

  // Phones: slide the strip to the colour's photo without moving the page.
  useEffect(() => {
    const ul = strip.current;
    const li = ul?.children[start] as HTMLElement | undefined;
    if (!ul || !li || start === 0) return;
    const pad = parseFloat(getComputedStyle(ul).scrollPaddingLeft) || 0;
    ul.scrollBy({ left: li.getBoundingClientRect().left - ul.getBoundingClientRect().left - pad, behavior: "smooth" });
  }, [start]);

  const current = images[Math.min(active, images.length - 1)];
  return (
    <div aria-label={fmt(t.productPage.gallery, { name })} role="region">
      {/* Phones and tablets: swipeable strip */}
      <ul ref={strip} className="-mx-6 flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 [scrollbar-width:none] sm:-mx-10 sm:scroll-px-10 sm:px-10 lg:hidden">
        {images.map((img, i) => (
          <li key={img.id} data-fly-source className="relative aspect-[4/5] w-[min(80%,calc(58svh*0.8))] shrink-0 snap-start overflow-hidden rounded-2xl bg-panel">
            <Image
              src={img.url}
              alt={img.altText ?? fmt(t.productPage.photo, { n: i + 1, total: images.length })}
              fill
              priority={i === 0}
              sizes="86vw"
              className="object-cover"
            />
          </li>
        ))}
      </ul>

      {/* Desktop: large photo + thumbnails */}
      <div className="mx-auto hidden w-full max-w-[min(100%,calc(74svh*0.8))] lg:block">
        <div data-fly-source className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-panel">
          <Image
            key={current.id}
            src={current.url}
            alt={current.altText ?? name}
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="animate-[fade-in_0.6s_var(--ease-float)] object-cover"
          />
        </div>
        {images.length > 1 && (
          <ul className="mt-4 grid grid-cols-5 gap-3">
            {images.map((img, i) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={fmt(t.productPage.photo, { n: i + 1, total: images.length })}
                  aria-pressed={i === active}
                  className={`relative block aspect-square w-full overflow-hidden rounded-lg bg-panel ring-offset-2 ring-offset-canvas transition ${
                    i === active ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <Image src={img.url} alt="" fill sizes="10vw" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
