import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { getDictionary, getLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.cart.title, robots: { index: false, follow: false } };
}

export default async function CartPage() {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <div className="mx-auto max-w-6xl">
        <h1 className="display mb-10 text-[clamp(2.8rem,8vw,6rem)]">{t.cart.title}</h1>
        <CartView />
      </div>
    </section>
  );
}
