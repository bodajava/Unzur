/**
 * "Add to cart" flight: a copy of the product photo lifts off like a small
 * spaceship (a slight squash, then a climb along an arc, nose turned to where
 * it's heading, a blue engine trail behind it), shrinks into the header's
 * cart and the cart gives a little bounce. `landed` resolves when it lands,
 * so the caller can open the cart then; `cancel()` (the add failed) fades
 * the ship out where it is. Instant with reduced motion.
 */

const DURATION = 950;
const TRAIL = 9;
const BLUE = "#1b44ff";

type Point = { x: number; y: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Quadratic Bézier point and its direction (for the tilt). */
function at(p0: Point, c: Point, p1: Point, t: number) {
  const u = 1 - t;
  const x = u * u * p0.x + 2 * u * t * c.x + t * t * p1.x;
  const y = u * u * p0.y + 2 * u * t * c.y + t * t * p1.y;
  const dx = 2 * u * (c.x - p0.x) + 2 * t * (p1.x - c.x);
  const dy = 2 * u * (c.y - p0.y) + 2 * t * (p1.y - c.y);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** Lift-off, fast cruise, gentle landing. */
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export interface Flight {
  landed: Promise<void>;
  cancel: () => void;
}

const grounded: Flight = { landed: Promise.resolve(), cancel: () => {} };

const isOnScreen = (r: DOMRect) =>
  r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;

/** The first element matching the selector that is actually on screen. */
export function visibleElement(selector: string): Element | null {
  for (const el of document.querySelectorAll(selector)) {
    if (isOnScreen(el.getBoundingClientRect())) return el;
  }
  return null;
}

/** The header's cart (the one on screen). */
function cartTarget(): Element | null {
  return visibleElement("[data-cart-target]");
}

export function flyToCart(from: Element | null, imageUrl: string | null | undefined): Flight {
  const target = cartTarget();
  if (
    !from ||
    !target ||
    !imageUrl ||
    typeof Element.prototype.animate !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return grounded;
  }
  const src = from.getBoundingClientRect();
  if (!isOnScreen(src)) return grounded;
  const dst = target.getBoundingClientRect();

  // The ship: the photo in a rounded card, at most 9rem, centred on the source.
  const size = Math.min(144, Math.max(64, Math.min(src.width, src.height) * 0.6));
  const start = { x: src.left + src.width / 2, y: src.top + src.height / 2 };
  const end = { x: dst.left + dst.width / 2, y: dst.top + dst.height / 2 };
  // Arc: climb above the line between them (more for long flights), bending away from the side.
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const control = {
    x: lerp(start.x, end.x, 0.35) - Math.sign(end.x - start.x || 1) * Math.min(120, distance * 0.15),
    y: Math.min(start.y, end.y) - Math.min(260, distance * 0.35),
  };

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden";

  const ship = document.createElement("div");
  ship.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:${size * 0.22}px;overflow:hidden;background:#fff;box-shadow:0 0 0 2px ${BLUE},0 18px 50px -10px rgba(27,68,255,0.75),0 0 40px -6px rgba(27,68,255,0.65);will-change:transform,opacity`;
  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = "";
  img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
  ship.appendChild(img);

  // Engine trail: glowing dots that follow a little behind and burn out.
  const dots = Array.from({ length: TRAIL }, (_, i) => {
    const d = document.createElement("span");
    const r = Math.max(4, 14 - i * 1.2);
    d.style.cssText = `position:absolute;left:0;top:0;width:${r}px;height:${r}px;margin:${-r / 2}px 0 0 ${-r / 2}px;border-radius:999px;background:radial-gradient(circle,#fff 0%,${BLUE} 55%,rgba(27,68,255,0) 100%);will-change:transform,opacity`;
    return d;
  });
  layer.append(...dots, ship);
  document.body.appendChild(layer);

  const steps = 32;
  const shipFrames: Keyframe[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const p = at(start, control, end, ease(t));
    // Lift-off squash in the first frames, then shrink towards the cart.
    const squash = t < 0.12 ? 1 - Math.sin((t / 0.12) * Math.PI) * 0.12 : 1;
    const scale = lerp(1, 0.14, Math.max(0, (t - 0.1) / 0.9) ** 1.4) * squash;
    // Nose follows the path, settling level as it lands.
    const tilt = t < 0.1 ? 0 : Math.max(-28, Math.min(28, (p.angle + 90) * 0.25)) * (1 - t);
    shipFrames.push({
      offset: t,
      transform: `translate(${p.x}px, ${p.y}px) rotate(${tilt}deg) scale(${scale})`,
      opacity: t > 0.92 ? lerp(1, 0, (t - 0.92) / 0.08) : 1,
    });
  }
  const flight = ship.animate(shipFrames, { duration: DURATION, easing: "linear", fill: "forwards" });

  const all: Animation[] = [flight];
  dots.forEach((dot, i) => {
    const lag = 0.035 * (i + 1);
    const frames: Keyframe[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const p = at(start, control, end, ease(Math.max(0, t - lag)));
      const alive = t > 0.08 + lag && t < 0.97;
      frames.push({ offset: t, transform: `translate(${p.x}px, ${p.y}px) scale(${1 - i / (TRAIL + 2)})`, opacity: alive ? 0.85 - i * 0.07 : 0 });
    }
    all.push(dot.animate(frames, { duration: DURATION, easing: "linear", fill: "forwards" }));
  });

  let cancelled = false;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    all.forEach((a) => a.pause());
    layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" }).finished.then(
      () => layer.remove(),
      () => layer.remove(),
    );
  };

  const landed = flight.finished
    .catch(() => undefined)
    .then(() => {
      if (cancelled) return;
      layer.remove();
      // Landing: the cart takes the hit and bounces.
      target.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.28)", offset: 0.35 },
          { transform: "scale(0.94)", offset: 0.7 },
          { transform: "scale(1)" },
        ],
        { duration: 420, easing: "ease-out" },
      );
    });
  return { landed, cancel };
}
