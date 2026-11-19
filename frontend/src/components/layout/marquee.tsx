/**
 * A strip of text sliding sideways forever. Two identical halves: the track
 * moves by -50% and loops seamlessly. "blue" is the brand-blue band used
 * between home page sections; it sits a little lower and runs the other way.
 */
export function Marquee({ items, tone = "plain" }: { items: string[]; tone?: "plain" | "blue" }) {
  const half = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {[...items, ...items].map((text, i) => (
        <span key={i} className="flex items-center gap-6 px-6 whitespace-nowrap">
          <span lang={/[؀-ۿ]/.test(text) ? "ar" : "en"} className="eyebrow !tracking-[0.1em]">
            {text}
          </span>
          <span className="h-3 w-px bg-current opacity-40" />
        </span>
      ))}
    </div>
  );
  const shell =
    tone === "blue"
      ? "mt-16 overflow-hidden bg-blue py-4 text-haze sm:mt-24 dark:shadow-[0_0_60px_-10px_rgba(27,68,255,0.8)]"
      : "overflow-hidden border-b border-current/10 py-2";
  return (
    <div className={shell} dir="ltr">
      <div className={`marquee-track flex w-max ${tone === "blue" ? "[animation-direction:reverse]" : ""}`}>
        {half(false)}
        {half(true)}
      </div>
    </div>
  );
}
