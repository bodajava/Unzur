import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageTitle } from "@/components/admin/ui";
import { ZonesEditor } from "@/components/admin/zones-editor";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.store.title };
}

export default async function StorePage() {
  const t = await getDictionary();
  return (
    <div>
      <PageTitle>{t.admin.store.title}</PageTitle>
      <div className="space-y-6">
        <ZonesEditor />
        <SettingsForm />
      </div>
    </div>
  );
}
