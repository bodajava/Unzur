import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { localePath } from "@/i18n/config";
import { getDictionary, getLang } from "@/i18n/server";
import type { CategoryNode } from "@/lib/api/types";

/** Categories on the dark band (dark gray by day, a deeper patch of space at night). */
export async function Collections({ categories }: { categories: CategoryNode[] }) {
  if (!categories.length) return null;
  const lang = await getLang();
  const t = await getDictionary(lang);
  return (
    <section
      aria-labelledby="collections-title"
      className="bg-deep px-6 py-24 text-on-deep sm:px-10 lg:px-14 lg:py-36 dark:border-y dark:border-white/8 dark:backdrop-blur-[2px]"
    >
      <Reveal className="mx-auto max-w-[90rem]">
        <p data-reveal className="eyebrow text-ash dark:text-muted">
          {t.collections.eyebrow}
        </p>
        <h2 id="collections-title" className="sr-only">
          {t.collections.title}
        </h2>
        <ul className="mt-10">
          {categories.map((c) => (
            <li key={c.id} data-reveal className="border-t border-on-deep/15 last:border-b">
              <Link
                href={localePath(lang, `/category/${c.slug}`)}
                className="group flex flex-col gap-4 py-8 sm:flex-row sm:items-end sm:justify-between lg:py-10"
              >
                <span
                  lang="en"
                  className="display text-[clamp(2.6rem,9vw,8.5rem)] transition-[color,transform] duration-700 ease-float group-hover:translate-x-3 group-hover:text-pale rtl:group-hover:-translate-x-3"
                >
                  {c.name}
                </span>
                <span className="flex max-w-xs items-end gap-4 text-sm leading-relaxed text-on-deep/60 sm:pb-3">
                  <span lang="en">{c.description}</span>
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-full border border-on-deep/30 text-lg transition-colors duration-500 group-hover:border-pale group-hover:bg-pale group-hover:text-graphite"
                  >
                    {t.common.arrow}
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
