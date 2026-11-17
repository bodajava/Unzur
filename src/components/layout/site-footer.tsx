import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { site } from "@/lib/site";
import { NewsletterForm } from "./newsletter-form";

const COLUMNS = [
  {
    title: "الشركة",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/care", label: "Product care" },
      { href: "/faq", label: "FAQs" },
    ],
  },
  {
    title: "السياسات",
    links: [
      { href: "/customer-care", label: "Customer care" },
      { href: "/returns", label: "Returns & exchanges" },
      { href: "/warranty", label: "Repair & warranty" },
    ],
  },
  {
    title: "خدمة العملاء",
    links: [
      { href: "/stories", label: "Stories" },
      { href: "/careers", label: "Careers" },
      { href: "/terms", label: "Terms & conditions" },
      { href: "/privacy", label: "Privacy policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="overflow-hidden bg-haze px-6 pt-24 text-blue sm:px-10 lg:px-14">
      <Reveal className="mx-auto grid max-w-[90rem] gap-12 border-t border-blue/15 pt-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div data-reveal className="max-w-sm">
          <h2 lang="ar" className="text-sm font-semibold">
            النشرة البريدية
          </h2>
          <p className="mt-2 text-sm text-ash">New pieces and studio news, a few times a season.</p>
          <div className="mt-5">
            <NewsletterForm />
          </div>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} data-reveal aria-label={col.title}>
            <h2 lang="ar" className="text-sm font-semibold">
              {col.title}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="nav-link">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Reveal>

      <div className="mx-auto mt-20 flex max-w-[90rem] flex-wrap items-center justify-between gap-3 text-xs text-ash">
        <span>© {site.name}</span>
        <span lang="ar">{site.taglineAr}</span>
      </div>
      <p aria-hidden className="wordmark mt-4 select-none text-center text-[31vw] leading-[0.74] text-blue">
        {site.name}
      </p>
    </footer>
  );
}
