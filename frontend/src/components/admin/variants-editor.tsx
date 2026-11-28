"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useAddVariant, useDeleteVariant, useUpdateVariant } from "@/lib/admin/api";
import type { AdminImage, AdminVariant } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import { colorOf, imageIdOf } from "@/lib/colors";
import { MONEY, toEgp, toPiasters } from "./money";
import { Panel } from "./ui";

interface Row {
  name: string;
  nameAr: string;
  sku: string;
  price: string;
  sale: string;
  stock: string;
  isActive: boolean;
  /** "#rrggbb", or "" for none. */
  color: string;
  /** The version's own product photo, or "" for the main photo. */
  imageId: string;
}

const fromVariant = (v: AdminVariant): Row => ({
  name: v.name,
  nameAr: v.nameAr ?? "",
  sku: v.sku,
  price: toEgp(v.price),
  sale: toEgp(v.salePrice),
  stock: String(v.stock),
  isActive: v.isActive,
  color: colorOf(v.attributes),
  imageId: imageIdOf(v.attributes),
});
const EMPTY: Row = { name: "", nameAr: "", sku: "", price: "", sale: "", stock: "0", isActive: true, color: "", imageId: "" };

/** The version's other attributes kept as they are, with colour and photo set or removed. */
function withSwatch(
  attributes: Record<string, unknown> | null | undefined,
  row: Pick<Row, "color" | "imageId">,
): Record<string, unknown> | null {
  const next: Record<string, unknown> = { ...(attributes ?? {}) };
  delete next.color;
  delete next.imageId;
  if (row.color) next.color = row.color;
  if (row.imageId) next.imageId = row.imageId;
  return Object.keys(next).length ? next : null;
}

/** Thumbnail button that opens the product's photos; picking one makes it this version's photo. */
function PhotoPick({ images, value, onChange }: { images: AdminImage[]; value: string; onChange: (id: string) => void }) {
  const { t } = useI18n();
  const tp = t.admin.product;
  const [open, setOpen] = useState(false);
  const current = images.find((i) => i.id === value);
  if (!images.length) {
    return <span className="text-center text-[0.65rem] leading-tight text-muted" title={tp.needPhotos}>—</span>;
  }
  return (
    <div className="relative flex items-center justify-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={current ? `${tp.variantPhoto}: ${current.altText ?? ""}` : tp.pickPhoto}
        title={current ? tp.variantPhoto : tp.noPhoto}
        className={`relative size-10 overflow-hidden rounded-lg border-2 ${current ? "border-ink/30" : "border-dashed border-ink/40"}`}
      >
        {current ? (
          <Image src={current.url} alt="" fill sizes="40px" className="object-cover" />
        ) : (
          <span aria-hidden="true" className="text-xs text-muted">+</span>
        )}
      </button>
      {open && (
        <div className="absolute top-12 z-20 w-56 rounded-xl border border-ink/15 bg-canvas p-3 shadow-xl">
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                aria-pressed={img.id === value}
                aria-label={img.altText ?? tp.variantPhoto}
                onClick={() => {
                  onChange(img.id);
                  setOpen(false);
                }}
                className={`relative aspect-square overflow-hidden rounded-lg ${img.id === value ? "ring-2 ring-ink ring-offset-2 ring-offset-canvas" : "opacity-80 hover:opacity-100"}`}
              >
                <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="nav-link mt-2 text-xs text-muted"
            >
              {tp.noPhoto}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Quick picks; any other colour comes from the picker. */
const PRESETS = ["#111111", "#f4f1ea", "#d1342f", "#1b44ff", "#1f9d55", "#f5b301", "#8b5a2b", "#9aa0a6"];

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

function Fields({ row, onChange, images }: { row: Row; onChange: (r: Row) => void; images: AdminImage[] }) {
  const { t } = useI18n();
  const tp = t.admin.product;
  const set = (k: keyof Row) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...row, [k]: k === "isActive" ? e.target.checked : e.target.value });
  const [open, setOpen] = useState(false);
  const bad = (ok: boolean) => (ok ? undefined : true);
  return (
    <>
      {/* English name + Arabic name, stacked in one column */}
      <div className="grid gap-1">
        <input aria-label={tp.variantName} placeholder="EN" value={row.name} onChange={set("name")} lang="en" dir="ltr" className={cell} />
        <input aria-label={tp.variantNameAr} placeholder="عربي" value={row.nameAr} onChange={set("nameAr")} lang="ar" dir="rtl" className={cell} />
      </div>
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
      {/* Colour: a circle that opens quick picks + a full picker */}
      <div className="relative flex items-center justify-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={row.color ? `${tp.variantColor}: ${row.color}` : tp.pickColor}
          title={row.color || tp.noColor}
          className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${row.color ? "border-ink/20" : "border-dashed border-ink/40"}`}
          style={row.color ? { backgroundColor: row.color } : undefined}
        >
          {!row.color && <span aria-hidden="true" className="text-xs text-muted">+</span>}
        </button>
        {open && (
          <div className="absolute top-10 z-20 w-48 rounded-xl border border-ink/15 bg-canvas p-3 shadow-xl">
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={row.color === c}
                  onClick={() => {
                    onChange({ ...row, color: c });
                    setOpen(false);
                  }}
                  className={`size-8 rounded-full border border-ink/15 ${row.color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-canvas" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs">
              <input
                type="color"
                value={row.color || "#1b44ff"}
                onChange={(e) => onChange({ ...row, color: e.target.value.toLowerCase() })}
                className="h-8 w-10 cursor-pointer rounded border border-ink/20 bg-transparent"
              />
              {tp.pickColor}
            </label>
            {row.color && (
              <button
                type="button"
                onClick={() => {
                  onChange({ ...row, color: "" });
                  setOpen(false);
                }}
                className="nav-link mt-2 text-xs text-muted"
              >
                {tp.clearColor}
              </button>
            )}
          </div>
        )}
      </div>
      <PhotoPick images={images} value={row.imageId} onChange={(imageId) => onChange({ ...row, imageId })} />
      <label className="flex items-center justify-center">
        <input type="checkbox" checked={row.isActive} onChange={set("isActive")} aria-label={tp.variantActive} className="size-4 accent-[var(--color-ink)]" />
      </label>
    </>
  );
}

function ExistingRow({ productId, variant, images }: { productId: string; variant: AdminVariant; images: AdminImage[] }) {
  const { t } = useI18n();
  const tp = t.admin.product;
  const [row, setRow] = useState<Row>(() => fromVariant(variant));
  const update = useUpdateVariant(productId);
  const remove = useDeleteVariant(productId);
  const dirty = JSON.stringify(row) !== JSON.stringify(fromVariant(variant));
  return (
    <li className="py-3">
      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.6fr_3.5rem_3.5rem_3.5rem_9rem]">
        <Fields row={row} onChange={setRow} images={images} />
        <div className="col-span-2 flex justify-end gap-2 sm:col-span-1">
          <button
            type="button"
            disabled={!dirty || !valid(row) || update.isPending}
            onClick={() =>
              update.mutate({
                id: variant.id,
                v: {
                  name: row.name.trim(),
                  nameAr: row.nameAr.trim() || null,
                  sku: row.sku.trim(),
                  price: toPiasters(row.price),
                  salePrice: row.sale ? toPiasters(row.sale) : null,
                  stock: Number(row.stock),
                  isActive: row.isActive,
                  attributes: withSwatch(variant.attributes, row),
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

export function VariantsEditor({ productId, variants, images }: { productId: string; variants: AdminVariant[]; images: AdminImage[] }) {
  const { t } = useI18n();
  const tp = t.admin.product;
  const [draft, setDraft] = useState<Row>(EMPTY);
  const add = useAddVariant(productId);

  return (
    <Panel title={tp.variants}>
      <p className="mb-1 text-sm text-muted">{tp.variantsHint}</p>
      <p className="mb-1 text-sm text-muted">{tp.colorHint}</p>
      <p className="mb-4 text-sm text-muted">{images.length ? tp.photoHint : tp.needPhotos}</p>
      <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.6fr_3.5rem_3.5rem_3.5rem_9rem] gap-2 px-0.5 text-xs text-muted sm:grid">
        <span>{tp.variantName}</span>
        <span>{tp.variantSku}</span>
        <span>{tp.variantPrice}</span>
        <span>{tp.variantSale}</span>
        <span>{tp.variantStock}</span>
        <span className="text-center">{tp.variantColor}</span>
        <span className="text-center">{tp.variantPhoto}</span>
        <span className="text-center">{tp.variantActive}</span>
        <span />
      </div>
      {variants.length === 0 && <p className="py-3 text-sm text-muted">{tp.noVariants}</p>}
      <ul className="divide-y divide-ink/10">
        {variants.map((v) => (
          <ExistingRow key={`${v.id}-${v.price}-${v.stock}-${v.isActive}-${v.name}-${v.nameAr}-${v.sku}-${v.salePrice}-${colorOf(v.attributes)}-${imageIdOf(v.attributes)}`} productId={productId} variant={v} images={images} />
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
              nameAr: draft.nameAr.trim() || null,
              sku: draft.sku.trim(),
              price: toPiasters(draft.price),
              salePrice: draft.sale ? toPiasters(draft.sale) : undefined,
              stock: Number(draft.stock),
              isActive: draft.isActive,
              attributes: withSwatch(null, draft) ?? undefined,
            },
            { onSuccess: () => setDraft(EMPTY) },
          );
        }}
      >
        <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.6fr_3.5rem_3.5rem_3.5rem_9rem]">
          <Fields row={draft} onChange={setDraft} images={images} />
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
