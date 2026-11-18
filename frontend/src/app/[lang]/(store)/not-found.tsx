import Link from "next/link";
import { EyeMark } from "@/components/brand/logo";
import { localePath } from "@/i18n/config";
import { getDictionary, getLang } from "@/i18n/server";

export default async function NotFound() {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return (
    <section className="grid min-h-svh place-items-center bg-page px-6 pt-32 pb-20 text-center">
      <div className="max-w-xl">
        <EyeMark idle className="mx-auto w-24 text-ink" />
        <h1 className="display mt-10 text-[clamp(2.2rem,6vw,4.5rem)]">{t.notFound.title}</h1>
        <p className="mx-auto mt-5 max-w-md text-muted">{t.notFound.body}</p>
        <Link href={localePath(lang)} className="nav-link mt-10 inline-block">
          {t.notFound.back}
        </Link>
      </div>
    </section>
  );
}
