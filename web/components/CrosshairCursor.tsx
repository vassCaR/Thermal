"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-page crosshair cursor: two thin white rules (one horizontal, one vertical)
 * that cross on the pointer. Smoothed with a lerp inside a single rAF loop and
 * positioned via translate3d (GPU, no layout thrashing). Progressive enhancement:
 * disabled on touch / coarse pointers and when the user prefers reduced motion
 * (native cursor remains). Hidden when the pointer leaves the window.
 */
export function CrosshairCursor() {
  const [enabled, setEnabled] = useState(false);
  const vRef = useRef<HTMLDivElement>(null);
  const hRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compute = () => setEnabled(fine.matches && !reduce.matches);
    compute();
    fine.addEventListener("change", compute);
    reduce.addEventListener("change", compute);
    return () => {
      fine.removeEventListener("change", compute);
      reduce.removeEventListener("change", compute);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pos = { ...target };
    let raf = 0;
    let visible = false;

    document.documentElement.style.cursor = "none";

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        visible = true;
        if (wrapRef.current) wrapRef.current.style.opacity = "1";
      }
    };
    const onLeave = () => {
      visible = false;
      if (wrapRef.current) wrapRef.current.style.opacity = "0";
    };
    const onEnter = () => {
      visible = true;
      if (wrapRef.current) wrapRef.current.style.opacity = "1";
    };

    const tick = () => {
      pos.x += (target.x - pos.x) * 0.2;
      pos.y += (target.y - pos.y) * 0.2;
      if (vRef.current) vRef.current.style.transform = `translate3d(${pos.x}px, 0, 0)`;
      if (hRef.current) hRef.current.style.transform = `translate3d(0, ${pos.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
      document.documentElement.style.cursor = "";
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999] opacity-0 transition-opacity duration-200"
    >
      <div
        ref={vRef}
        className="absolute left-0 top-0 h-screen w-px -translate-x-1/2 bg-[#ffd9a8]/70"
        style={{ willChange: "transform", boxShadow: "0 0 6px rgba(255,110,0,0.55)" }}
      />
      <div
        ref={hRef}
        className="absolute left-0 top-0 h-px w-screen -translate-y-1/2 bg-[#ffd9a8]/70"
        style={{ willChange: "transform", boxShadow: "0 0 6px rgba(255,110,0,0.55)" }}
      />
    </div>
  );
}
