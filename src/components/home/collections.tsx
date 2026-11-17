import Link from "next/link";
import type { CategoryNode } from "@/lib/api/types";
import { Reveal } from "@/components/ui/reveal";

/** Categories on dark gray. */
export function Collections({ categories }: { categories: CategoryNode[] }) {
  if (!categories.length) return null;
  return (
    <section aria-labelledby="collections-title" className="bg-graphite px-6 py-24 text-haze sm:px-10 lg:px-14 lg:py-36">
      <Reveal className="mx-auto max-w-[90rem]">
        <p data-reveal className="eyebrow text-ash">
          Shop by category
        </p>
        <h2 id="collections-title" className="sr-only">
          Collections
        </h2>
        <ul className="mt-10">
          {categories.map((c) => (
            <li key={c.id} data-reveal className="border-t border-haze/15 last:border-b">
              <Link
                href={`/category/${c.slug}`}
                className="group flex flex-col gap-4 py-8 sm:flex-row sm:items-end sm:justify-between lg:py-10"
              >
                <span className="display text-[clamp(2.6rem,9vw,8.5rem)] transition-[color,transform] duration-700 ease-float group-hover:translate-x-3 group-hover:text-pale">
                  {c.name}
                </span>
                <span className="flex max-w-xs items-end gap-4 text-sm leading-relaxed text-haze/60 sm:pb-3">
                  {c.description}
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-full border border-haze/30 text-lg transition-colors duration-500 group-hover:border-pale group-hover:bg-pale group-hover:text-graphite"
                  >
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
