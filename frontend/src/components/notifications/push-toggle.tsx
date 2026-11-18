"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { disablePush, enablePush, pushState, type PushAudience, type PushState } from "@/lib/push";

/**
 * Turns push notifications on or off for this browser. Customers hear about
 * their orders; staff hear about the store. Explains itself when the browser
 * can't, or the user blocked it.
 */
export function PushToggle({ audience, className = "" }: { audience: PushAudience; className?: string }) {
  const { lang, t } = useI18n();
  const tp = t.push;
  // Browser-only facts: read after mount so the server HTML matches.
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const now = pushState(audience);
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- permission and storage exist only in the browser */
    setState(now);
    // Tokens can rotate: refresh the saved one quietly when it's already on.
    if (now === "on") enablePush(audience, lang, false).catch(() => undefined);
  }, [audience, lang]);

  if (state === null) return null;
  if (state === "unconfigured" && audience === "customer") return null;

  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true);
    setFailed(false);
    try {
      setState(await fn());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const note =
    state === "on" ? tp.on : state === "blocked" ? tp.blocked : state === "unsupported" ? tp.unsupported : state === "unconfigured" ? tp.unconfigured : audience === "staff" ? tp.staffIntro : tp.customerIntro;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <p role="status" className="min-w-0 flex-1 text-sm text-muted">
        {failed ? <span className="text-[#d1342f]">{tp.failed}</span> : note}
      </p>
      {state === "off" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => enablePush(audience, lang))}
          className="shrink-0 rounded-full bg-blue px-5 py-2.5 text-sm font-semibold text-haze transition-colors hover:bg-blue-deep disabled:opacity-60"
        >
          {busy ? tp.turningOn : tp.turnOn}
        </button>
      )}
      {state === "on" && (
        <button type="button" disabled={busy} onClick={() => run(() => disablePush(audience))} className="nav-link shrink-0 text-sm disabled:opacity-50">
          {tp.turnOff}
        </button>
      )}
    </div>
  );
}
