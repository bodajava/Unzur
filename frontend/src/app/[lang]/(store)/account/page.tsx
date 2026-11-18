import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.account.title, robots: { index: false, follow: false } };
}

export default function AccountPage() {
  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <div className="mx-auto max-w-6xl">
        <AccountView />
      </div>
    </section>
  );
}
