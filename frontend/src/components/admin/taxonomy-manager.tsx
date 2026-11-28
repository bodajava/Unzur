"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, localized, plural } from "@/i18n/format";
import { catalogApi, useTaxonomy, useTaxonomyChange, type Taxonomy } from "@/lib/admin/api";
import { type AdminBrand, type AdminCategory } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import { Panel, Skeleton } from "./ui";
import { prepareImage } from "@/lib/admin/prepare-image";

type Item = AdminCategory | AdminBrand;
const imageOf = (item: Item) => ("imageUrl" in item ? item.imageUrl : item.logoUrl);

interface Draft {
  name: string;
  nameAr: string;
  descriptionAr: string;
  slug: string;
  description: string;
  parentId: string;
  isActive: boolean;
  file: File | null;
}

const input =
  "mt-1.5 w-full rounded-xl border border-ink/20 bg-transparent px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none aria-[invalid=true]:border-[#d1342f]";

function Editor({
  kind,
  item,
  parents,
  onDone,
}: {
  kind: Taxonomy;
  item?: Item;
  parents: AdminCategory[];
  onDone: () => void;
}) {
  const { lang, t } = useI18n();
  const tc = t.admin.catalog;
  const uid = useId();
  const [d, setD] = useState<Draft>({
    name: item?.name ?? "",
    nameAr: (item && "nameAr" in item ? item.nameAr : null) ?? "",
    descriptionAr: (item && "descriptionAr" in item ? item.descriptionAr : null) ?? "",
    slug: item?.slug ?? "",
    description: item?.description ?? "",
    parentId: (item && "parentId" in item ? item.parentId : null) ?? "",
    isActive: item?.isActive ?? true,
    file: null,
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useTaxonomyChange(kind, (form: FormData) => (item ? catalogApi.update(kind, item.id, form) : catalogApi.create(kind, form)));
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (d.name.trim().length < 2) return setProblem(tc.required);
    const form = new FormData();
    form.append("name", d.name.trim());
    if (d.slug.trim() && d.slug.trim() !== item?.slug) form.append("slug", d.slug.trim());
    if (d.description.trim()) form.append("description", d.description.trim());
    else if (item) form.append("description", "null");
    if (kind === "categories") {
      // Arabic copy (categories only); empty clears it on edit.
      if (d.nameAr.trim() || item) form.append("nameAr", d.nameAr.trim());
      if (d.descriptionAr.trim() || item) form.append("descriptionAr", d.descriptionAr.trim());
      if (d.parentId) form.append("parentId", d.parentId);
      else if (item) form.append("parentId", "null");
    }
    form.append("isActive", String(d.isActive));
    if (d.file) form.append(kind === "categories" ? "image" : "logo", d.file);
    save.mutate(form, { onSuccess: onDone });
  };

  const current = item ? imageOf(item) : null;
  return (
    <form onSubmit={submit} className="rounded-2xl border border-ink/15 p-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          {tc.name}
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} lang="en" dir="ltr" aria-invalid={!!problem} className={input} />
        </label>
        <label className="text-sm font-semibold">
          {tc.slug}
          <input value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value })} dir="ltr" placeholder={tc.slugHint} className={`${input} rtl:text-right`} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          {tc.description}
          <textarea rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} lang="en" dir="ltr" className={`${input} resize-y`} />
        </label>
        {kind === "categories" && (
          <>
            <label className="text-sm font-semibold">
              {tc.nameAr}
              <input value={d.nameAr} onChange={(e) => setD({ ...d, nameAr: e.target.value })} lang="ar" dir="rtl" className={input} />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              {tc.descriptionAr}
              <textarea rows={2} value={d.descriptionAr} onChange={(e) => setD({ ...d, descriptionAr: e.target.value })} lang="ar" dir="rtl" className={`${input} resize-y`} />
            </label>
          </>
        )}
        {kind === "categories" && (
          <label className="text-sm font-semibold">
            {tc.parent}
            <select value={d.parentId} onChange={(e) => setD({ ...d, parentId: e.target.value })} className={input}>
              <option value="" className="bg-canvas">{tc.noParent}</option>
              {parents
                .filter((p) => p.id !== item?.id)
                .map((p) => (
                  <option key={p.id} value={p.id} className="bg-canvas">{localized(lang, p.name, "nameAr" in p ? p.nameAr : null)}</option>
                ))}
            </select>
          </label>
        )}
        <div className="text-sm font-semibold">
          {kind === "categories" ? tc.image : tc.logo}
          <div className="mt-1.5 flex items-center gap-3">
            {(preview || current) && (
              <span className="relative block size-12 overflow-hidden rounded-lg bg-panel">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview (blob: URL)
                  <img src={preview} alt="" className="size-full object-cover" />
                ) : (
                  <Image src={current!} alt="" fill sizes="48px" className="object-cover" />
                )}
              </span>
            )}
            <label className="cursor-pointer rounded-full border border-ink/25 px-4 py-2 text-xs font-semibold hover:border-ink">
              {tc.chooseImage}
              <input
                id={`${uid}-file`}
                type="file"
                accept="image/*,.heic,.heif"
                className="sr-only"
                onChange={(e) => {
                  const raw = e.target.files?.[0];
                  e.target.value = "";
                  if (!raw) return;
                  setProblem(null);
                  // Big phone photos and HEIC are shrunk and converted first.
                  prepareImage(raw)
                    .then((file) => {
                      setD((p) => ({ ...p, file }));
                      setPreview(URL.createObjectURL(file));
                    })
                    .catch(() => setProblem(fmt(t.admin.product.unreadable, { name: raw.name })));
                }}
              />
            </label>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={d.isActive} onChange={(e) => setD({ ...d, isActive: e.target.checked })} className="size-4 accent-[var(--color-ink)]" />
          {tc.visible}
        </label>
      </div>
      {(problem || save.isError) && <p className="mt-3 text-xs text-[#d1342f]">{problem ?? errorMessage(save.error, t)}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm hover:bg-ink/8">{tc.cancel}</button>
        <button type="submit" disabled={save.isPending} className="rounded-full bg-blue px-5 py-2 text-sm font-semibold text-haze hover:bg-blue-deep disabled:opacity-50">
          {save.isPending ? tc.saving : tc.save}
        </button>
      </div>
    </form>
  );
}

/** Categories or brands: list (children under their parent), add, edit, hide, delete. */
export function TaxonomyManager({ kind }: { kind: Taxonomy }) {
  const { lang, t } = useI18n();
  const tc = t.admin.catalog;
  const { data, isError, error } = useTaxonomy<Item>(kind);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const remove = useTaxonomyChange(kind, (id: string) => catalogApi.remove(kind, id));

  const items = data ?? [];
  const cats = items as AdminCategory[];
  const ordered =
    kind === "categories"
      ? cats.filter((c) => !c.parentId).flatMap((p) => [p, ...cats.filter((c) => c.parentId === p.id)])
      : items;
  const parents = kind === "categories" ? cats.filter((c) => !c.parentId) : [];

  return (
    <Panel
      title={kind === "categories" ? tc.categories : tc.brands}
      action={
        editing !== "new" && (
          <button type="button" onClick={() => setEditing("new")} className="rounded-full border border-ink/25 px-4 py-1.5 text-sm hover:border-ink">
            + {tc.add}
          </button>
        )
      }
    >
      <p className="mb-4 text-sm text-muted">{kind === "categories" ? tc.categoriesHint : tc.brandsHint}</p>
      {editing === "new" && (
        <div className="mb-4">
          <Editor kind={kind} parents={parents} onDone={() => setEditing(null)} />
        </div>
      )}
      {isError && <p className="text-sm text-[#d1342f]">{errorMessage(error, t)}</p>}
      {!data ? (
        <Skeleton className="h-32" />
      ) : ordered.length === 0 ? (
        <p className="text-sm text-muted">{tc.empty}</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {ordered.map((item) => {
            const child = "parentId" in item && !!item.parentId;
            const img = imageOf(item);
            return (
              <li key={item.id} className={`py-3 ${child ? "ps-6" : ""}`}>
                {editing === item.id ? (
                  <Editor kind={kind} item={item} parents={parents} onDone={() => setEditing(null)} />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-canvas/70">
                      {img ? <Image src={img} alt="" fill sizes="40px" className="object-cover" /> : <span lang="en" className="display text-[0.6rem] text-soft">{item.name.slice(0, 2)}</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {child && <span className="text-muted">↳ </span>}
                        {localized(lang, item.name, "nameAr" in item ? item.nameAr : null)}
                        {!item.isActive && <span className="ms-2 rounded-full bg-ink/8 px-2 py-0.5 text-xs font-normal text-muted">{tc.hidden}</span>}
                      </p>
                      <p className="text-xs text-muted">
                        <span dir="ltr">/{item.slug}</span> · {plural(lang, tc.products, item.productCount)}
                      </p>
                    </div>
                    <button type="button" onClick={() => setEditing(item.id)} className="rounded-full px-3 py-1.5 text-sm hover:bg-ink/8">{tc.edit}</button>
                    <button
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => window.confirm(fmt(tc.removeConfirm, { name: item.name })) && remove.mutate(item.id)}
                      className="rounded-full px-3 py-1.5 text-sm text-[#b02a26] hover:bg-[#d1342f]/8 dark:text-[#ff8f8a]"
                    >
                      {tc.remove}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {remove.isError && <p className="mt-2 text-xs text-[#d1342f]">{errorMessage(remove.error, t)}</p>}
    </Panel>
  );
}
