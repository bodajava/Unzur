import type { Metadata } from "next";
import { CouponsManager } from "@/components/admin/coupons-manager";
import { GiftCardsManager } from "@/components/admin/gift-cards-manager";
import { PageTitle } from "@/components/admin/ui";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.marketing.title };
}

export default async function MarketingPage() {
  const t = await getDictionary();
  return (
    <div>
      <PageTitle>{t.admin.marketing.title}</PageTitle>
      <div className="space-y-6">
        <CouponsManager />
        <GiftCardsManager />
      </div>
    </div>
  );
}
