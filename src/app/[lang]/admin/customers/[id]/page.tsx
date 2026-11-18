import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerDetailPage } from "@/components/admin/customer-detail";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.customers.title };
}

export default function CustomerPage(props: PageProps<"/[lang]/admin/customers/[id]">) {
  return (
    <Suspense>
      <CustomerDetailPage params={props.params} />
    </Suspense>
  );
}
