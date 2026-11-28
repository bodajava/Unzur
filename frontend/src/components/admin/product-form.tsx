"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, localized } from "@/i18n/format";
import { useCreateProduct, useDeleteProduct, useUpdateProduct } from "@/lib/admin/api";
import { MAX_IMAGES, type AdminProduct } from "@/lib/admin/types";
import { prepareImage } from "@/lib/admin/prepare-image";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useBrands, useCategories } from "@/lib/api/hooks";
import { MONEY, toEgp, toPiasters } from "./money";
import { Panel } from "./ui";
import { VariantsEditor } from "./variants-editor";

interface Fields {
  name: string;
  nameAr: string;
  shortDescriptionAr: string;
  descriptionAr: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  brandId: string;
  basePrice: string;
  salePrice: string;
  costPrice: string;
  stock: string;
  lowStockThreshold: string;
  isActive: boolean;
  isFeatured: boolean;
}

const fromProduct = (p?: AdminProduct): Fields => ({
  name: p?.name ?? "",
  nameAr: p?.nameAr ?? "",
  shortDescriptionAr: p?.shortDescriptionAr ?? "",
  descriptionAr: p?.descriptionAr ?? "",
  slug: p?.slug ?? "",
  sku: p?.sku ?? "",
  shortDescription: p?.shortDescription ?? "",
  description: p?.description ?? "",
  categoryId: p?.categoryId ?? "",
  brandId: p?.brandId ?? "",
  basePrice: toEgp(p?.basePrice),
  salePrice: toEgp(p?.salePrice),
  costPrice: toEgp(p?.costPrice),
  stock: String(p?.stock ?? 0),
  lowStockThreshold: String(p?.lowStockThreshold ?? 5),
  isActive: p?.isActive ?? true,
  isFeatured: p?.isFeatured ?? false,
});

type Errors = Partial<Record<"name" | "description" | "categoryId" | "basePrice" | "salePrice" | "costPrice", string>>;

const input =
  "mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-base focus:outline-none border-ink/20 hover:border-ink/45 focus:border-ink aria-[invalid=true]:border-[#d1342f]";

function Field({ id, label, hint, error, children, className = "" }: { id: string; label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs font-semibold text-[#d1342f]">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Existing photos in display order (cover first), new files after them. */
function usePhotos(product?: AdminProduct) {
  const initial = useMemo(
    () => [...(product?.images ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder),
    [product?.images],
  );
  const [order, setOrder] = useState<string[]>(() => initial.map((i) => i.id));
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<{ file: File; url: string }[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  // Keep the latest previews for the unmount cleanup (object URLs must be released).
  const addedRef = useRef(added);
  useEffect(() => {
    addedRef.current = added;
  }, [added]);
  useEffect(() => () => addedRef.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  const kept = order.filter((id) => !removed.has(id));
  return {
    images: order.map((id) => initial.find((i) => i.id === id)!).filter(Boolean),
    kept,
    removed,
    added,
    problem,
    setProblem,
    preparing,
    move: (id: string, by: -1 | 1) =>
      setOrder((o) => {
        const i = o.indexOf(id);
        const j = i + by;
        if (j < 0 || j >= o.length) return o;
        const next = [...o];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),
    cover: (id: string) => setOrder((o) => [id, ...o.filter((x) => x !== id)]),
    toggleRemove: (id: string) =>
      setRemoved((r) => {
        const next = new Set(r);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    /** Any photo the browser can open: big phone photos and HEIC are shrunk and converted first. */
    add: async (files: File[], t: { unreadable: string; tooMany: string }) => {
      setProblem(null);
      setPreparing(true);
      const room = MAX_IMAGES - kept.length - added.length;
      const ok: { file: File; url: string }[] = [];
      for (const raw of files) {
        if (ok.length >= room) {
          setProblem(fmt(t.tooMany, { max: MAX_IMAGES }));
          break;
        }
        try {
          const file = await prepareImage(raw);
          ok.push({ file, url: URL.createObjectURL(file) });
        } catch {
          setProblem(fmt(t.unreadable, { name: raw.name }));
        }
      }
      setAdded((a) => [...a, ...ok]);
      setPreparing(false);
    },
    drop: (index: number) =>
      setAdded((a) => {
        URL.revokeObjectURL(a[index].url);
        return a.filter((_, i) => i !== index);
      }),
    reset: () => {
      added.forEach((a) => URL.revokeObjectURL(a.url));
      setAdded([]);
      setRemoved(new Set());
    },
  };
}

export function ProductForm({
  product,
  notice: savedNotice,
  onSaved,
}: {
  product?: AdminProduct;
  /** Kept by the parent: the form remounts with fresh data after each save. */
  notice?: string | null;
  onSaved?: (message: string) => void;
}) {
  const { lang, t, href } = useI18n();
  const tp = t.admin.product;
  const router = useRouter();
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [f, setF] = useState<Fields>(() => fromProduct(product));
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(savedNotice ?? null);
  const photos = usePhotos(product);
  // Sold in versions: the product's stock is their total (the store keeps it in sync).
  const activeVersions = product?.variants.filter((v) => v.isActive) ?? [];
  const versionsStock = activeVersions.length ? activeVersions.reduce((sum, v) => sum + v.stock, 0) : null;
  const categories = useCategories();
  const brands = useBrands();
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? "");
  const del = useDeleteProduct(product?.id ?? "");
  const save = product ? update : create;
  const readOnly = !!product?.deletedAt;
  const flatCategories = (categories.data ?? []).flatMap((c) => [c, ...c.children.map((ch) => ({ ...ch, name: `— ${ch.name}` }))]);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setF((p) => ({ ...p, [k]: value }));
    setNotice(null);
    if (k in errors) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (f.name.trim().length < 2) e.name = tp.required;
    if (!f.description.trim()) e.description = tp.required;
    if (!f.categoryId) e.categoryId = tp.required;
    if (!MONEY.test(f.basePrice)) e.basePrice = tp.priceInvalid;
    if (f.salePrice && !MONEY.test(f.salePrice)) e.salePrice = tp.priceInvalid;
    else if (f.salePrice && MONEY.test(f.basePrice) && toPiasters(f.salePrice) >= toPiasters(f.basePrice)) e.salePrice = tp.saleInvalid;
    if (f.costPrice && !MONEY.test(f.costPrice)) e.costPrice = tp.priceInvalid;
    return e;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(id(Object.keys(found)[0]))?.focus();
      return;
    }
    const form = new FormData();
    const put = (k: string, v: string) => form.append(k, v);
    // Optional text fields: empty means "clear" on edit ("null"), "leave out" on create.
    const optional = (k: string, v: string) => {
      if (v.trim()) put(k, v.trim());
      else if (product) put(k, "null");
    };
    put("name", f.name.trim());
    if (f.slug.trim() && f.slug.trim() !== product?.slug) put("slug", f.slug.trim());
    optional("sku", f.sku);
    optional("shortDescription", f.shortDescription);
    put("description", f.description.trim());
    // Arabic copy: empty clears it on edit (the store then shows the English text).
    for (const k of ["nameAr", "shortDescriptionAr", "descriptionAr"] as const) {
      if (f[k].trim()) put(k, f[k].trim());
      else if (product) put(k, "");
    }
    put("categoryId", f.categoryId);
    optional("brandId", f.brandId);
    put("basePrice", String(toPiasters(f.basePrice)));
    if (f.salePrice) put("salePrice", String(toPiasters(f.salePrice)));
    else if (product) put("salePrice", "null");
    if (f.costPrice) put("costPrice", String(toPiasters(f.costPrice)));
    else if (product) put("costPrice", "null");
    if (versionsStock === null) put("stock", String(Math.max(0, Number.parseInt(f.stock, 10) || 0)));
    put("lowStockThreshold", String(Math.max(0, Number.parseInt(f.lowStockThreshold, 10) || 0)));
    put("isActive", String(f.isActive));
    put("isFeatured", String(f.isFeatured));
    if (product) {
      if (photos.removed.size) put("removeImageIds", [...photos.removed].join(","));
      if (photos.kept.length) {
        put("imageOrder", photos.kept.join(","));
        put("primaryImageId", photos.kept[0]);
      }
    }
    for (const a of photos.added) form.append("images", a.file);

    save.mutate(form, {
      onSuccess: (saved) => {
        photos.reset();
        if (!product) router.replace(`${href(`/admin/products/${saved.id}`)}?created=1`);
        else {
          setNotice(tp.saved);
          onSaved?.(tp.saved);
        }
      },
    });
  };

  const serverErrors = save.error instanceof ApiError && Array.isArray(save.error.errors) ? (save.error.errors as string[]) : [];
  const totalPhotos = photos.kept.length + photos.added.length;

  return (
    <div>
      <Link href={href("/admin/products")} className="nav-link text-sm text-muted">
        {t.common.arrow === "→" ? "←" : "→"} {tp.back}
      </Link>
      <div className="mt-4 mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 lang={product ? "en" : undefined} className="display text-[clamp(2rem,5vw,3.6rem)]">
          {product ? localized(lang, product.name, product.nameAr) : tp.newTitle}
        </h1>
        {product && !product.deletedAt && (
          <Link href={href(`/products/${product.slug}`)} target="_blank" className="nav-link text-sm">
            {tp.viewInStore} ↗
          </Link>
        )}
      </div>
      {readOnly && <p className="mb-6 rounded-2xl bg-ink/8 px-5 py-4 text-sm">{tp.deletedNote}</p>}

      <form onSubmit={submit} noValidate>
        <fieldset disabled={readOnly} className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="min-w-0 space-y-6">
            <Panel title={tp.basics}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id={id("name")} label={tp.name} error={errors.name} className="sm:col-span-2">
                  <input id={id("name")} lang="en" dir="ltr" value={f.name} onChange={set("name")} aria-invalid={!!errors.name} className={input} />
                </Field>
                <Field id={id("slug")} label={tp.slug} hint={fmt(tp.slugHint, { slug: f.slug || "…" })}>
                  <input id={id("slug")} dir="ltr" value={f.slug} onChange={set("slug")} pattern="[a-z0-9-]*" className={`${input} rtl:text-right`} />
                </Field>
                <Field id={id("sku")} label={tp.sku}>
                  <input id={id("sku")} dir="ltr" value={f.sku} onChange={set("sku")} className={`${input} rtl:text-right`} />
                </Field>
                <Field id={id("short")} label={tp.short} hint={tp.shortHint} className="sm:col-span-2">
                  <input id={id("short")} lang="en" dir="ltr" maxLength={500} value={f.shortDescription} onChange={set("shortDescription")} className={input} />
                </Field>
                <Field id={id("description")} label={tp.description} error={errors.description} className="sm:col-span-2">
                  <textarea
                    id={id("description")}
                    lang="en"
                    dir="ltr"
                    rows={6}
                    value={f.description}
                    onChange={set("description")}
                    aria-invalid={!!errors.description}
                    className={`${input} resize-y`}
                  />
                </Field>
                <div className="sm:col-span-2 rounded-xl border border-ink/12 p-4">
                  <p className="text-sm font-semibold">{tp.arabicTitle}</p>
                  <p className="mt-0.5 text-xs text-muted">{tp.arabicHint}</p>
                  <div className="mt-4 grid gap-5">
                    <Field id={id("nameAr")} label={tp.nameAr}>
                      <input id={id("nameAr")} lang="ar" dir="rtl" value={f.nameAr} onChange={set("nameAr")} className={input} />
                    </Field>
                    <Field id={id("shortAr")} label={tp.shortAr}>
                      <input id={id("shortAr")} lang="ar" dir="rtl" maxLength={500} value={f.shortDescriptionAr} onChange={set("shortDescriptionAr")} className={input} />
                    </Field>
                    <Field id={id("descriptionAr")} label={tp.descriptionAr}>
                      <textarea id={id("descriptionAr")} lang="ar" dir="rtl" rows={5} value={f.descriptionAr} onChange={set("descriptionAr")} className={`${input} resize-y`} />
                    </Field>
                  </div>
                </div>
                <Field id={id("categoryId")} label={tp.category} error={errors.categoryId}>
                  <select id={id("categoryId")} value={f.categoryId} onChange={set("categoryId")} aria-invalid={!!errors.categoryId} className={input}>
                    <option value="" disabled className="bg-canvas">{tp.chooseCategory}</option>
                    {flatCategories.map((c) => (
                      <option key={c.id} value={c.id} className="bg-canvas">{localized(lang, c.name, c.nameAr)}</option>
                    ))}
                  </select>
                </Field>
                <Field id={id("brand")} label={tp.brand}>
                  <select id={id("brand")} value={f.brandId} onChange={set("brandId")} className={input}>
                    <option value="" className="bg-canvas">{tp.noBrand}</option>
                    {(brands.data ?? []).map((b) => (
                      <option key={b.id} value={b.id} className="bg-canvas">{b.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Panel>

            <Panel title={tp.images}>
              <p className="mb-4 text-sm text-muted">{fmt(tp.imagesHint, { max: MAX_IMAGES })}</p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.images.map((img) => {
                  const gone = photos.removed.has(img.id);
                  const isCover = !gone && photos.kept[0] === img.id;
                  return (
                    <li key={img.id} className={`overflow-hidden rounded-xl bg-canvas/70 ${gone ? "opacity-40" : ""}`}>
                      <div className="relative aspect-[4/5]">
                        <Image src={img.url} alt={img.altText ?? ""} fill sizes="200px" className="object-cover" />
                        {isCover && <span className="eyebrow absolute start-2 top-2 rounded-full bg-blue px-2 py-0.5 text-[0.6rem] text-haze">{tp.cover}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 p-2 text-xs">
                        {!gone && !isCover && (
                          <button type="button" onClick={() => photos.cover(img.id)} className="rounded-full px-2 py-1 hover:bg-ink/8">{tp.makeCover}</button>
                        )}
                        {!gone && (
                          <>
                            <button type="button" aria-label={tp.moveUp} onClick={() => photos.move(img.id, -1)} className="rounded-full px-2 py-1 hover:bg-ink/8">{lang === "ar" ? "→" : "←"}</button>
                            <button type="button" aria-label={tp.moveDown} onClick={() => photos.move(img.id, 1)} className="rounded-full px-2 py-1 hover:bg-ink/8">{lang === "ar" ? "←" : "→"}</button>
                          </>
                        )}
                        <button type="button" onClick={() => photos.toggleRemove(img.id)} className="ms-auto rounded-full px-2 py-1 text-[#b02a26] hover:bg-[#d1342f]/8 dark:text-[#ff8f8a]">
                          {gone ? tp.undoRemove : tp.removeImage}
                        </button>
                      </div>
                    </li>
                  );
                })}
                {photos.added.map((a, i) => (
                  <li key={a.url} className="overflow-hidden rounded-xl bg-canvas/70">
                    <div className="relative aspect-[4/5]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob: URL) */}
                      <img src={a.url} alt="" className="absolute inset-0 size-full object-cover" />
                      <span className="eyebrow absolute start-2 top-2 rounded-full bg-canvas/90 px-2 py-0.5 text-[0.6rem]">{tp.newBadge}</span>
                    </div>
                    <div className="flex p-2 text-xs">
                      <button type="button" onClick={() => photos.drop(i)} className="ms-auto rounded-full px-2 py-1 text-[#b02a26] hover:bg-[#d1342f]/8 dark:text-[#ff8f8a]">{tp.removeImage}</button>
                    </div>
                  </li>
                ))}
                {totalPhotos < MAX_IMAGES && (
                  <li>
                    <label className="grid aspect-[4/5] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-ink/25 text-center text-sm hover:border-ink/60 focus-within:border-ink">
                      <span>
                        <span aria-hidden className="block text-3xl leading-none">+</span>
                        {tp.addImages}
                      </span>
                      <input
                        type="file"
                        accept="image/*,.heic,.heif"
                        multiple
                        disabled={photos.preparing}
                        className="sr-only"
                        onChange={(e) => {
                          void photos.add([...(e.target.files ?? [])], tp);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </li>
                )}
              </ul>
              {photos.preparing && <p role="status" className="mt-3 text-xs text-muted">{tp.preparingPhotos}</p>}
              {photos.problem && <p className="mt-3 text-xs font-semibold text-[#d1342f]">{photos.problem}</p>}
            </Panel>
          </div>

          <div className="space-y-6 xl:sticky xl:top-28 xl:self-start">
            <Panel title={tp.pricing}>
              <div className="space-y-4">
                <Field id={id("basePrice")} label={tp.price} error={errors.basePrice}>
                  <input id={id("basePrice")} inputMode="decimal" dir="ltr" value={f.basePrice} onChange={set("basePrice")} aria-invalid={!!errors.basePrice} className={`${input} rtl:text-right`} />
                </Field>
                <Field id={id("salePrice")} label={tp.salePrice} hint={tp.salePriceHint} error={errors.salePrice}>
                  <input id={id("salePrice")} inputMode="decimal" dir="ltr" value={f.salePrice} onChange={set("salePrice")} aria-invalid={!!errors.salePrice} className={`${input} rtl:text-right`} />
                </Field>
                <Field id={id("costPrice")} label={tp.costPrice} hint={tp.costHint} error={errors.costPrice}>
                  <input id={id("costPrice")} inputMode="decimal" dir="ltr" value={f.costPrice} onChange={set("costPrice")} aria-invalid={!!errors.costPrice} className={`${input} rtl:text-right`} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id={id("stock")} label={tp.stock}>
                    {/* Sold in versions: the stock is the sum of theirs, kept by the store. */}
                    <input
                      id={id("stock")}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      dir="ltr"
                      value={versionsStock ?? f.stock}
                      onChange={set("stock")}
                      disabled={versionsStock !== null}
                      className={`${input} disabled:opacity-60`}
                    />
                  </Field>
                  <Field id={id("low")} label={tp.lowStock}>
                    <input id={id("low")} type="number" min="0" inputMode="numeric" dir="ltr" value={f.lowStockThreshold} onChange={set("lowStockThreshold")} className={input} />
                  </Field>
                </div>
                <p className="text-xs text-muted">{versionsStock !== null ? tp.stockFromVersions : tp.stockHint}</p>
              </div>
            </Panel>

            <Panel title={tp.visibility}>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={f.isActive} onChange={set("isActive")} className="mt-0.5 size-4 accent-[var(--color-ink)]" />
                {tp.active}
              </label>
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={f.isFeatured} onChange={set("isFeatured")} className="mt-0.5 size-4 accent-[var(--color-ink)]" />
                {tp.featuredLabel}
              </label>
            </Panel>

            {!readOnly && (
              <div>
                <button type="submit" disabled={save.isPending || photos.preparing} className="w-full rounded-full bg-blue px-6 py-3.5 font-semibold text-haze hover:bg-blue-deep disabled:opacity-60">
                  {save.isPending ? tp.saving : product ? tp.save : tp.create}
                </button>
                <div role="status" className="mt-3 min-h-5 text-sm">
                  {notice && <p className="text-[#16773f] dark:text-[#7ee2a8]">{notice}</p>}
                  {save.isError &&
                    (serverErrors.length ? (
                      <ul lang="en" className="list-disc space-y-1 ps-5 text-[#d1342f]">
                        {serverErrors.map((m) => <li key={m}>{m}</li>)}
                      </ul>
                    ) : (
                      <p className="text-[#d1342f]">{errorMessage(save.error, t)}</p>
                    ))}
                </div>
                {product && (
                  <button
                    type="button"
                    disabled={del.isPending}
                    onClick={() => window.confirm(tp.deleteConfirm) && del.mutate(undefined, { onSuccess: () => router.replace(href("/admin/products")) })}
                    className="mt-4 w-full rounded-full border border-[#d1342f]/40 px-6 py-2.5 text-sm font-semibold text-[#b02a26] hover:bg-[#d1342f]/8 disabled:opacity-50 dark:text-[#ff8f8a]"
                  >
                    {del.isPending ? tp.deleting : tp.delete}
                  </button>
                )}
                {del.isError && <p className="mt-2 text-xs text-[#d1342f]">{errorMessage(del.error, t)}</p>}
              </div>
            )}
          </div>
        </fieldset>
      </form>

      {product && !readOnly && (
        <div className="mt-6">
          <VariantsEditor productId={product.id} variants={product.variants} images={product.images} />
        </div>
      )}
    </div>
  );
}
