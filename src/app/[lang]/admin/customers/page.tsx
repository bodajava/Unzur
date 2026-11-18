import type { Metadata } from "next";
import { CustomersList } from "@/components/admin/customers-list";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.customers.title };
}

export default function CustomersPage() {
  return <CustomersList />;
}
