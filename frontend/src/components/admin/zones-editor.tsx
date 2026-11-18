"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { catalogApi, useZoneChange, useZones } from "@/lib/admin/api";
import type { ShippingZone } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import { MONEY, toEgp, toPiasters } from "./money";
import { Panel, Skeleton } from "./ui";

interface Row {
  governorate: string;
  nameAr: string;
  fee: string;
  days: string;
  isActive: boolean;
}

const DAYS = /^[0-9]{1,2}(-[0-9]{1,2})?$/;
const fromZone = (z: ShippingZone): Row => ({ governorate: z.governorate, nameAr: z.nameAr ?? "", fee: toEgp(z.fee), days: z.estimatedDays, isActive: z.isActive });
const EMPTY: Row = { governorate: "", nameAr: "", fee: "", days: "", isActive: true };
const valid = (r: Row) => r.governorate.trim().length >= 2 && MONEY.test(r.fee) && DAYS.test(r.days.trim());
const toInput = (r: Row) => ({
  governorate: r.governorate.trim(),
  nameAr: r.nameAr.trim() || null,
  fee: toPiasters(r.fee),
  estimatedDays: r.days.trim(),
  isActive: r.isActive,
});

const cell = "w-full rounded-lg border border-ink/20 bg-transparent px-2.5 py-2 text-sm focus:border-ink focus:outline-none";
const GRID = "grid grid-cols-2 items-center gap-2 sm:grid-cols-[1.2fr_1.2fr_0.8fr_0.7fr_3.5rem_9rem]";

function Fields({ row, onChange }: { row: Row; onChange: (r: Row) => void }) {
  const { t } = useI18n();
  const ts = t.admin.store;
  return (
    <>
      <input aria-label={ts.governorate} value={row.governorate} onChange={(e) => onChange({ ...row, governorate: e.target.value })} lang="en" className={cell} />
      <input aria-label={ts.nameAr} value={row.nameAr} onChange={(e) => onChange({ ...row, nameAr: e.target.value })} lang="ar" dir="rtl" className={cell} />
      <input aria-label={ts.fee} value={row.fee} onChange={(e) => onChange({ ...row, fee: e.target.value })} inputMode="decimal" dir="ltr" className={cell} />
      <input aria-label={ts.days} placeholder={ts.daysHint} value={row.days} onChange={(e) => onChange({ ...row, days: e.target.value })} dir="ltr" className={cell} />
      <label className="flex items-center justify-center">
        <input type="checkbox" aria-label={ts.active} checked={row.isActive} onChange={(e) => onChange({ ...row, isActive: e.target.checked })} className="size-4 accent-[var(--color-ink)]" />
      </label>
    </>
  );
}

function ZoneRow({ zone }: { zone: ShippingZone }) {
  const { t } = useI18n();
  const ts = t.admin.store;
  const [row, setRow] = useState(() => fromZone(zone));
  const save = useZoneChange((r: Row) => catalogApi.updateZone(zone.id, toInput(r)));
  const remove = useZoneChange(() => catalogApi.removeZone(zone.id));
  const dirty = JSON.stringify(row) !== JSON.stringify(fromZone(zone));
  return (
    <li className="py-2.5">
      <div className={GRID}>
        <Fields row={row} onChange={setRow} />
        <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
          <button type="button" disabled={!dirty || !valid(row) || save.isPending} onClick={() => save.mutate(row)} className="rounded-full bg-blue px-4 py-2 text-xs font-semibold text-haze disabled:opacity-25">
            {ts.save}
          </button>
          <button type="button" disabled={remove.isPending} onClick={() => window.confirm(ts.removeConfirm) && remove.mutate(undefined)} className="rounded-full px-3 py-2 text-xs text-[#b02a26] hover:bg-[#d1342f]/8 dark:text-[#ff8f8a]">
            {ts.remove}
          </button>
        </div>
      </div>
      {(save.isError || remove.isError) && <p className="mt-1 text-xs text-[#d1342f]">{errorMessage(save.error ?? remove.error, t)}</p>}
    </li>
  );
}

export function ZonesEditor() {
  const { t } = useI18n();
  const ts = t.admin.store;
  const { data, isError, error } = useZones();
  const [draft, setDraft] = useState<Row>(EMPTY);
  const add = useZoneChange((r: Row) => catalogApi.addZone(toInput(r)));

  return (
    <Panel title={ts.zones}>
      <p className="mb-4 text-sm text-muted">{ts.zonesHint}</p>
      <div className={`${GRID} hidden px-0.5 text-xs text-muted sm:grid`}>
        <span>{ts.governorate}</span>
        <span>{ts.nameAr}</span>
        <span>{ts.fee}</span>
        <span>{ts.days}</span>
        <span>{ts.active}</span>
        <span />
      </div>
      {isError && <p className="text-sm text-[#d1342f]">{errorMessage(error, t)}</p>}
      {!data ? (
        <Skeleton className="h-64" />
      ) : (
        <ul className="max-h-[32rem] divide-y divide-ink/10 overflow-y-auto overscroll-contain pe-1" data-lenis-prevent>
          {data.map((z) => (
            <ZoneRow key={`${z.id}-${z.fee}-${z.estimatedDays}-${z.isActive}-${z.governorate}-${z.nameAr}`} zone={z} />
          ))}
        </ul>
      )}
      <form
        className="mt-3 border-t border-ink/10 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid(draft)) add.mutate(draft, { onSuccess: () => setDraft(EMPTY) });
        }}
      >
        <div className={GRID}>
          <Fields row={draft} onChange={setDraft} />
          <button type="submit" disabled={!valid(draft) || add.isPending} className="col-span-2 rounded-full border border-ink/30 px-4 py-2 text-xs font-semibold hover:border-ink disabled:opacity-30 sm:col-span-1">
            + {ts.addZone}
          </button>
        </div>
        {add.isError && <p className="mt-1 text-xs text-[#d1342f]">{errorMessage(add.error, t)}</p>}
      </form>
    </Panel>
  );
}
