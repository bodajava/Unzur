import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDetailPage } from "@/components/admin/order-detail-page";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.orders.title };
}

export default function AdminOrderPage(props: PageProps<"/[lang]/admin/orders/[id]">) {
  return (
    <Suspense>
      <OrderDetailPage params={props.params} />
    </Suspense>
  );
}
