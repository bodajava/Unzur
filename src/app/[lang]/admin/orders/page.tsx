import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersList } from "@/components/admin/orders-list";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.orders.title };
}

export default function AdminOrdersPage() {
  return (
    <Suspense>
      <OrdersList />
    </Suspense>
  );
}
