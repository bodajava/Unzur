import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getDictionary, getLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.checkout.title, robots: { index: false, follow: false } };
}

export default async function CheckoutPage() {
  const t = await getDictionary(await getLang());
  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <div className="mx-auto max-w-6xl">
        <h1 className="display mb-12 text-[clamp(2.8rem,8vw,6rem)]">{t.checkout.title}</h1>
        <CheckoutForm />
      </div>
    </section>
  );
}
