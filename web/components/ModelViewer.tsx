"use client";

import { createElement, useEffect, useRef, useState } from "react";

/**
 * GLB viewer via Google's <model-viewer> web component. We deliberately avoid
 * @react-three/fiber here: R3F / three's WebGLRenderer does not present on this
 * machine's ANGLE/D3D11 driver (the whole Dither saga), whereas model-viewer's
 * pipeline composites correctly (verified). Camera orbit is scroll-linked
 * (model-viewer tweens orbit changes), with a thermal/IR color treatment.
 */

// Thermal tint pushing the render toward the orange iron palette.
const THERMAL_FILTER =
  "contrast(1.15) saturate(0.65) sepia(0.45) hue-rotate(-18deg) brightness(1.06)";

let mvScript: Promise<void> | null = null;
function ensureScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!mvScript) {
    mvScript = new Promise<void>((resolve) => {
      if (customElements.get("model-viewer")) return resolve();
      const s = document.createElement("script");
      s.type = "module";
      s.src = "https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  }
  return mvScript;
}

export default function ModelViewer({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let mounted = true;
    ensureScript().then(() => mounted && setReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  // Scroll-linked camera orbit (smoothly tweened by model-viewer itself).
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready || reducedRef.current) return;
    let inView = false;
    const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: 0 });
    io.observe(el);
    const onScroll = () => {
      if (!inView) return;
      const r = el.getBoundingClientRect();
      const prog = 1 - Math.min(Math.max((r.top + r.height / 2) / window.innerHeight, 0), 1);
      const theta = 25 + prog * 150; // deg, sweeps around as the section scrolls
      const phi = 70 + prog * 25;
      el.setAttribute("camera-orbit", `${theta}deg ${phi}deg auto`);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [ready]);

  if (!ready) {
    return (
      <div className={className} aria-busy="true" aria-label="Loading 3D model">
        <div className="flex h-full w-full items-center justify-center font-mono text-xs uppercase tracking-widest text-muted">
          loading optic…
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ filter: THERMAL_FILTER }}>
      {createElement("model-viewer", {
        ref,
        src,
        alt: "Holosun DRS-TH thermal optic — interactive 3D model",
        "camera-controls": true,
        "auto-rotate": reducedRef.current ? undefined : true,
        "rotation-per-second": "18deg",
        "interaction-prompt": "none",
        "disable-zoom": true,
        exposure: "0.95",
        "shadow-intensity": "0.4",
        "camera-orbit": "25deg 75deg auto",
        style: { width: "100%", height: "100%", backgroundColor: "transparent" },
      })}
    </div>
  );
}
