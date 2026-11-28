"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { useSaveSizeChart } from "@/lib/admin/api";
import { prepareImage } from "@/lib/admin/prepare-image";
import { MAX_SIZE_CHART_OPTIONS, type SizeChart } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import { Panel } from "./ui";

interface Choice {
  key: string;
  label: string;
  /** A photo already on the chart. */
  url: string | null;
  /** A new photo picked here (sent on save). */
  file: File | null;
  preview: string | null;
}

const input =
  "mt-2 w-full rounded-xl border bg-transparent px-4 py-3 text-base focus:outline-none border-ink/20 hover:border-ink/45 focus:border-ink";

let nextKey = 0;
const fromChart = (chart: SizeChart | null): Choice[] =>
  (chart?.options ?? []).map((o) => ({ key: `c${nextKey++}`, label: o.label, url: o.url, file: null, preview: null }));
const blank = (): Choice => ({ key: `c${nextKey++}`, label: "", url: null, file: null, preview: null });

/** iOS-style on/off switch. */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
      {label}
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-ink/20 transition-colors duration-300 peer-checked:bg-blue peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2" />
        <span className="absolute top-0.5 start-0.5 size-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}

/**
 * The product page's size chart: a corner button with up to two choices,
 * each opening its own photo (e.g. the Arabic and the English calendar).
 */
export function SizeChartEditor({ productId, chart }: { productId: string; chart: SizeChart | null }) {
  const { t } = useI18n();
  const ts = t.admin.sizeChart;
  const tp = t.admin.product;
  const uid = useId();
  const save = useSaveSizeChart(productId);
  const [enabled, setEnabled] = useState(chart?.enabled ?? false);
  const [title, setTitle] = useState(chart?.title ?? ts.defaultName);
  const [choices, setChoices] = useState<Choice[]>(() => {
    const rows = fromChart(chart);
    return rows.length ? rows : [blank()];
  });
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  // Release local previews (blob: URLs) when they are replaced or the editor closes.
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const touch = () => {
    setNotice(null);
    setProblem(null);
  };
  const edit = (key: string, patch: Partial<Choice>) => {
    touch();
    setChoices((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const pick = async (key: string, raw: File | undefined) => {
    if (!raw) return;
    touch();
    setPreparing(true);
    try {
      const file = await prepareImage(raw);
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      edit(key, { file, preview });
    } catch {
      setProblem(fmt(tp.unreadable, { name: raw.name }));
    } finally {
      setPreparing(false);
    }
  };

  const submit = () => {
    const filled = choices.filter((c) => c.label.trim() || c.url || c.file);
    if (filled.some((c) => !c.label.trim() || !(c.url || c.file))) return setProblem(ts.needPhoto);
    if (enabled && !filled.length) return setProblem(ts.needOne);

    const form = new FormData();
    form.append("enabled", String(enabled));
    form.append("title", title.trim() || ts.defaultName);
    let n = 0;
    const options = filled.map((c) => {
      if (c.file) {
        form.append("images", c.file);
        return { label: c.label.trim(), image: `new:${n++}` };
      }
      return { label: c.label.trim(), image: c.url! };
    });
    form.append("options", JSON.stringify(options));
    save.mutate(form, {
      onSuccess: (saved) => {
        // The new photos are now on the chart: keep their URLs, not the files (saving again won't re-upload).
        const rows = fromChart(saved.sizeChart);
        setChoices(rows.length ? rows : [blank()]);
        setNotice(ts.saved);
      },
    });
  };

  return (
    <Panel title={ts.title}>
      <p className="mb-5 max-w-2xl text-sm text-muted">{ts.intro}</p>
      <div className="max-w-2xl space-y-6">
        <Switch
          label={ts.enable}
          checked={enabled}
          onChange={(v) => {
            touch();
            setEnabled(v);
          }}
        />
        {!enabled && <p className="-mt-3 text-xs text-muted">{ts.off}</p>}

        <div>
          <label htmlFor={`${uid}-title`} className="text-sm font-semibold">
            {ts.buttonName}
          </label>
          <input
            id={`${uid}-title`}
            dir="auto"
            maxLength={40}
            value={title}
            onChange={(e) => {
              touch();
              setTitle(e.target.value);
            }}
            className={input}
          />
          <p className="mt-1.5 text-xs text-muted">{ts.buttonHint}</p>
        </div>

        <div>
          <p className="text-sm font-semibold">{ts.choices}</p>
          <p className="mt-0.5 text-xs text-muted">{ts.choicesHint}</p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {choices.map((c, i) => {
              const src = c.preview ?? c.url;
              return (
                <li key={c.key} className="overflow-hidden rounded-xl bg-canvas/70">
                  <label className="group relative grid aspect-[4/5] cursor-pointer place-items-center overflow-hidden border-b border-ink/10 text-center text-sm">
                    {src ? (
                      c.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local preview (blob: URL)
                        <img src={c.preview} alt="" className="absolute inset-0 size-full object-contain p-2" />
                      ) : (
                        <Image src={src} alt="" fill sizes="300px" className="object-contain p-2" />
                      )
                    ) : (
                      <span className="text-muted">
                        <span aria-hidden className="block text-3xl leading-none">+</span>
                        {ts.pickPhoto}
                      </span>
                    )}
                    {src && (
                      <span className="absolute inset-x-0 bottom-0 bg-ink/70 py-2 text-xs font-semibold text-canvas opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        {ts.changePhoto}
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
                      disabled={preparing}
                      className="sr-only"
                      aria-label={`${ts.pickPhoto} ${i + 1}`}
                      onChange={(e) => {
                        void pick(c.key, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="p-3">
                    <label htmlFor={`${uid}-${c.key}`} className="text-xs font-semibold">
                      {ts.choiceName}
                    </label>
                    <input
                      id={`${uid}-${c.key}`}
                      dir="auto"
                      maxLength={30}
                      placeholder={i === 0 ? ts.choicePlaceholder : "English"}
                      value={c.label}
                      onChange={(e) => edit(c.key, { label: e.target.value })}
                      className={`${input} mt-1 py-2 text-sm`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        touch();
                        setChoices((cs) => cs.filter((x) => x.key !== c.key));
                      }}
                      className="mt-2 rounded-full px-2 py-1 text-xs text-[#b02a26] hover:bg-[#d1342f]/8 dark:text-[#ff8f8a]"
                    >
                      {ts.remove}
                    </button>
                  </div>
                </li>
              );
            })}
            {choices.length < MAX_SIZE_CHART_OPTIONS && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    touch();
                    setChoices((cs) => [...cs, blank()]);
                  }}
                  className="grid aspect-[4/5] w-full place-items-center rounded-xl border-2 border-dashed border-ink/25 text-sm hover:border-ink/60"
                >
                  <span>
                    <span aria-hidden className="block text-3xl leading-none">+</span>
                    {ts.addChoice}
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>

        <div>
          <button
            type="button"
            onClick={submit}
            disabled={save.isPending || preparing}
            className="rounded-full bg-blue px-6 py-3 font-semibold text-haze hover:bg-blue-deep disabled:opacity-60"
          >
            {save.isPending ? ts.saving : ts.save}
          </button>
          <div role="status" className="mt-3 min-h-5 text-sm">
            {preparing && <p className="text-xs text-muted">{tp.preparingPhotos}</p>}
            {problem && <p className="font-semibold text-[#d1342f]">{problem}</p>}
            {notice && <p className="text-[#16773f] dark:text-[#7ee2a8]">{notice}</p>}
            {save.isError && <p className="text-[#d1342f]">{errorMessage(save.error, t)}</p>}
          </div>
        </div>
      </div>
    </Panel>
  );
}
