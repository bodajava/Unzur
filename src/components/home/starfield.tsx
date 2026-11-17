"use client";

import { useEffect, useRef, type RefObject } from "react";
import { scrollState } from "@/lib/motion/scroll-state";

interface Star {
  x: number;
  y: number;
  z: number;
  pz: number;
}

/**
 * Stars flying toward the viewer from the centre of the hero. They drift at
 * rest, and stretch into streaks with scroll speed and with `progress`
 * (0..1, how far the visitor has flown into the logo). Static when the user
 * prefers reduced motion; paused when off screen or the tab is hidden.
 */
export function Starfield({ progress, className }: { progress: RefObject<number>; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let frame = 0;
    let visible = true;
    let last = performance.now();

    const spawn = (z = Math.random()): Star => ({
      x: (Math.random() * 2 - 1) * 1.2,
      y: (Math.random() * 2 - 1) * 1.2,
      z: Math.max(z, 0.05),
      pz: Math.max(z, 0.05),
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Fewer stars on small screens.
      const count = Math.round(Math.min(420, Math.max(140, (width * height) / 3800)));
      stars = Array.from({ length: count }, () => spawn());
    };

    const draw = (dt: number) => {
      const cx = width / 2;
      const cy = height / 2;
      const fov = Math.min(width, height) * 0.55;
      const p = progress.current ?? 0;
      const v = Math.min(Math.abs(scrollState.velocity), 80);
      // depth units per second
      const speed = reduced ? 0 : 0.035 + p * p * 2.4 + v * 0.018;

      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        s.pz = s.z;
        s.z -= speed * dt;
        if (s.z <= 0.05) {
          Object.assign(s, spawn(1));
          continue;
        }
        const sx = cx + (s.x / s.z) * fov;
        const sy = cy + (s.y / s.z) * fov;
        if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) {
          Object.assign(s, spawn(1));
          continue;
        }
        const px = cx + (s.x / s.pz) * fov;
        const py = cy + (s.y / s.pz) * fov;
        const near = 1 - s.z;
        const size = 0.9 + near * 2.4;
        ctx.globalAlpha = Math.min(1, 0.3 + near * 0.9);
        ctx.strokeStyle = near > 0.72 ? "#e8e8e5" : "#a7b6ff";
        ctx.fillStyle = ctx.strokeStyle;
        if (Math.hypot(sx - px, sy - py) > 1.5) {
          ctx.lineWidth = size;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (visible) draw(dt);
      frame = requestAnimationFrame(loop);
    };

    resize();
    if (reduced) {
      draw(0);
    } else {
      frame = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      last = performance.now();
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
    };
  }, [progress]);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
