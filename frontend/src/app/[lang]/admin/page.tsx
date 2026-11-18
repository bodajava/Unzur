import type { Metadata } from "next";
import { OverviewView } from "@/components/admin/overview";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  // Same segment as the dashboard layout, so its title template does not apply here.
  return { title: { absolute: `${t.admin.overview.title} · ${t.admin.title}` } };
}

export default function AdminHome() {
  return <OverviewView />;
}
