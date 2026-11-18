"use client";

import { useSearchParams } from "next/navigation";
import { use, useState } from "react";
import { useI18n } from "@/i18n/client";
import { useAdminProduct } from "@/lib/admin/api";
import { errorMessage } from "@/lib/api/errors";
import { ProductForm } from "./product-form";
import { Skeleton } from "./ui";

export function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const created = useSearchParams()?.get("created") === "1";
  const { data, isError, error } = useAdminProduct(id);
  const [notice, setNotice] = useState<string | null>(null);
  if (isError) return <p className="text-[#d1342f]">{errorMessage(error, t)}</p>;
  if (!data) return <Skeleton className="h-[40rem]" />;
  return (
    <>
      {created && <p className="mb-6 rounded-2xl bg-[#1f9d55]/12 px-5 py-4 text-sm text-[#16773f] dark:text-[#7ee2a8]">{t.admin.product.created}</p>}
      {/* Remount the form when the product changes on the server (after a save). */}
      <ProductForm key={data.updatedAt} product={data} notice={notice} onSaved={setNotice} />
    </>
  );
}
