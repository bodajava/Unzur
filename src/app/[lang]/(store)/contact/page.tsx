import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";
import { alternatesFor } from "@/i18n/config";
import { getDictionary, getLang } from "@/i18n/server";
import { getPublicSettings } from "@/lib/api/server";
import { contactInfo } from "@/lib/contact-info";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return { title: t.contact.title, description: t.contact.intro, alternates: alternatesFor(lang, "/contact") };
}

export default async function ContactPage() {
  const lang = await getLang();
  const [t, settings] = await Promise.all([getDictionary(lang), getPublicSettings()]);
  const tc = t.contact;
  const c = contactInfo(settings);
  const card = "block rounded-2xl border border-ink/12 px-5 py-4 transition-colors hover:border-ink/40";

  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h1 className="display text-[clamp(2.6rem,7vw,5.5rem)]">{tc.title}</h1>
          <p className="mt-4 max-w-sm text-muted">{tc.intro}</p>

          {(c.email || c.phone || c.instagram) && (
            <div className="mt-10">
              <h2 className="eyebrow text-muted">{tc.or}</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {c.email && (
                  <li>
                    <a href={`mailto:${c.email}`} className={card}>
                      <span className="block text-xs text-muted">{tc.emailUs}</span>
                      <span dir="ltr" className="mt-0.5 block font-semibold break-all rtl:text-right">
                        {c.email}
                      </span>
                    </a>
                  </li>
                )}
                {c.phone && c.tel && (
                  <li className="grid gap-3 sm:grid-cols-2">
                    <a href={c.tel} className={card}>
                      <span className="block text-xs text-muted">{tc.callUs}</span>
                      <span dir="ltr" className="mt-0.5 block font-semibold tabular-nums rtl:text-right">
                        {c.phone}
                      </span>
                    </a>
                    {c.whatsapp && (
                      <a href={c.whatsapp} target="_blank" rel="noopener noreferrer" className={`${card} grid place-items-center font-semibold`}>
                        {tc.whatsapp}
                      </a>
                    )}
                  </li>
                )}
                {c.instagram && (
                  <li>
                    <a href={c.instagram} target="_blank" rel="noopener noreferrer" className={card}>
                      <span className="block text-xs text-muted">{tc.instagram}</span>
                      <span dir="ltr" className="mt-0.5 block font-semibold rtl:text-right">
                        {c.instagramHandle ?? c.instagram}
                      </span>
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-7">
          <ContactForm to={c.email} />
        </div>
      </div>
    </section>
  );
}
