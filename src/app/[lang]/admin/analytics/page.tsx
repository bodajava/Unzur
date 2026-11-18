import type { Metadata } from "next";
import { AnalyticsView } from "@/components/admin/analytics";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.analytics.title };
}

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
