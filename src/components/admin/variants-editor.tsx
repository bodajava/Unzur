"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useAddVariant, useDeleteVariant, useUpdateVariant } from "@/lib/admin/api";
import type { AdminVariant } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import { MONEY, toEgp, toPiasters } from "./money";
import { Panel } from "./ui";

interface Row {
  name: string;
  sku: string;
  price: string;
  sale: string;
  stock: string;
  isActive: boolean;
}

const fromVariant = (v: AdminVariant): Row => ({
  name: v.name,
  sku: v.sku,
  price: toEgp(v.price),
  sale: toEgp(v.salePrice),
  stock: String(v.stock),
  isActive: v.isActive,
});
const EMPTY: Row = { name: "", sku: "", price: "", sale: "", stock: "0", isActive: true };

const cell =
  "w-full rounded-lg border border-ink/20 bg-transparent px-2.5 py-2 text-sm focus:border-ink focus:outline-none aria-[invalid=true]:border-[#d1342f]";

function valid(r: Row) {
  return (
    r.name.trim().length > 0 &&
    r.sku.trim().length > 0 &&
    MONEY.test(r.price) &&
    (!r.sale || (MONEY.test(r.sale) && toPiasters(r.sale) < toPiasters(r.price))) &&
    /^\d{1,7}$/.test(r.stock)
  );
}

function Fields({ row, onChange }: { row: Row; onChange: (r: Row) => void }) {
  const { t } = useI18n();
  const tp = t.admin.product;
  const set = (k: keyof Row) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...row, [k]: k === "isActive" ? e.target.checked : e.target.value });
  const bad = (ok: boolean) => (ok ? undefined : true);
  return (
    <>
      <input aria-label={tp.variantName} value={row.name} onChange={set("name")} lang="en" className={cell} />
      <input aria-label={tp.variantSku} value={row.sku} onChange={set("sku")} dir="ltr" className={cell} />
      <input aria-label={tp.variantPrice} value={row.price} onChange={set("price")} inputMode="decimal" dir="ltr" aria-invalid={bad(!row.price || MONEY.test(row.price))} className={cell} />
      <input
        aria-label={tp.variantSale}
        value={row.sale}
        onChange={set("sale")}
        inputMode="decimal"
        dir="ltr"
        aria-invalid={bad(!row.sale || (MONEY.test(row.sale) && MONEY.test(row.price) && toPiasters(row.sale) < toPiasters(row.price)))}
        className={cell}
      />
      <input aria-label={tp.variantStock} value={row.stock} onChange={set("stock")} inputMode="numeric" dir="ltr" aria-invalid={bad(/^\d{0,7}$/.test(row.stock))} className={cell} />
      <label className="flex items-center justify-center">
        <input type="checkbox" checked={row.isActive} onChange={set("isActive")} aria-label={tp.variantActive} className="size-4 accent-[var(--color-ink)]" />
      </label>
    </>
  );
}

function ExistingRow({ productId, variant }: { productId: string; variant: AdminVariant }) {
  const { t } = useI18n();
  const tp = t.admin.product;
  const [row, setRow] = useState<Row>(() => fromVariant(variant));
  const update = useUpdateVariant(productId);
  const remove = useDeleteVariant(productId);
  const dirty = JSON.stringify(row) !== JSON.stringify(fromVariant(variant));
  return (
    <li className="py-3">
      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.6fr_3.5rem_9rem]">
        <Fields row={row} onChange={setRow} />
        <div className="col-span-2 flex justify-end gap-2 sm:col-span-1">
          <button
            type="button"
            disabled={!dirty || !valid(row) || update.isPending}
            onClick={() =>
              update.mutate({
                id: variant.id,
                v: {
                  name: row.name.trim(),
                  sku: row.sku.trim(),
                  price: toPiasters(row.price),
                  salePrice: row.sale ? toPiasters(row.sale) : null,
                  stock: Number(row.stock),
                  isActive: row.isActive,
                },
              })
            }
            className="rounded-full bg-blue px-4 py-2 text-xs font-semibold text-haze hover:bg-blue-deep disabled:opacity-30"
          >
            {tp.saveVariant}
          </button>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => window.confirm(tp.removeVariantConfirm) && remove.mutate(variant.id)}
            className="rounded-full px-3 py-2 text-xs text-[#b02a26] hover:bg-[#d1342f]/8 dark:text-[#ff8f8a]"
          >
            {tp.removeVariant}
          </button>
        </div>
      </div>
      {(update.isError || remove.isError) && <p className="mt-1 text-xs text-[#d1342f]">{errorMessage(update.error ?? remove.error, t)}</p>}
    </li>
  );
}

export function VariantsEditor({ productId, variants }: { productId: string; variants: AdminVariant[] }) {
  const { t } = useI18n();
  const tp = t.admin.product;
  const [draft, setDraft] = useState<Row>(EMPTY);
  const add = useAddVariant(productId);

  return (
    <Panel title={tp.variants}>
      <p className="mb-4 text-sm text-muted">{tp.variantsHint}</p>
      <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.6fr_auto_auto] gap-2 px-0.5 text-xs text-muted sm:grid">
        <span>{tp.variantName}</span>
        <span>{tp.variantSku}</span>
        <span>{tp.variantPrice}</span>
        <span>{tp.variantSale}</span>
        <span>{tp.variantStock}</span>
        <span>{tp.variantActive}</span>
        <span />
      </div>
      {variants.length === 0 && <p className="py-3 text-sm text-muted">{tp.noVariants}</p>}
      <ul className="divide-y divide-ink/10">
        {variants.map((v) => (
          <ExistingRow key={`${v.id}-${v.price}-${v.stock}-${v.isActive}-${v.name}-${v.sku}-${v.salePrice}`} productId={productId} variant={v} />
        ))}
      </ul>
      <form
        className="mt-3 border-t border-ink/10 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid(draft)) return;
          add.mutate(
            {
              name: draft.name.trim(),
              sku: draft.sku.trim(),
              price: toPiasters(draft.price),
              salePrice: draft.sale ? toPiasters(draft.sale) : undefined,
              stock: Number(draft.stock),
              isActive: draft.isActive,
            },
            { onSuccess: () => setDraft(EMPTY) },
          );
        }}
      >
        <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.6fr_3.5rem_9rem]">
          <Fields row={draft} onChange={setDraft} />
          <button
            type="submit"
            disabled={!valid(draft) || add.isPending}
            className="col-span-2 rounded-full border border-ink/30 px-4 py-2 text-xs font-semibold hover:border-ink disabled:opacity-30 sm:col-span-1"
          >
            + {tp.addVariant}
          </button>
        </div>
        {add.isError && <p className="mt-1 text-xs text-[#d1342f]">{errorMessage(add.error, t)}</p>}
      </form>
    </Panel>
  );
}
