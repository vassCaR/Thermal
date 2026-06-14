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

  // Scroll-linked camera through named views: side -> face/lens -> top.
  // model-viewer tweens each camera-orbit change, so frequent small updates read
  // as one smooth, eased sweep as the section scrolls past.
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready || reducedRef.current) return;
    // theta = azimuth, phi = polar (0deg = top-down, 90deg = equator/side)
    const KF = [
      { p: 0.0, theta: 90, phi: 90 }, // side / profile
      { p: 0.5, theta: 0, phi: 86 }, // face / lens
      { p: 1.0, theta: 0, phi: 10 }, // top-down
    ];
    let inView = false;
    const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: 0 });
    io.observe(el);
    const onScroll = () => {
      if (!inView) return;
      const r = el.getBoundingClientRect();
      const prog = 1 - Math.min(Math.max((r.top + r.height / 2) / window.innerHeight, 0), 1);
      let a = KF[0];
      let b = KF[KF.length - 1];
      for (let i = 0; i < KF.length - 1; i++) {
        if (prog >= KF[i].p && prog <= KF[i + 1].p) {
          a = KF[i];
          b = KF[i + 1];
          break;
        }
      }
      const t = b.p === a.p ? 0 : (prog - a.p) / (b.p - a.p);
      const theta = a.theta + (b.theta - a.theta) * t;
      const phi = a.phi + (b.phi - a.phi) * t;
      el.setAttribute("camera-orbit", `${theta.toFixed(1)}deg ${phi.toFixed(1)}deg auto`);
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
        "interaction-prompt": "none",
        "disable-zoom": true,
        exposure: "0.95",
        "shadow-intensity": "0.4",
        // Scroll drives the orbit (side -> face -> top); start on the side view.
        // Reduced motion: a fixed 3/4 view, no scroll-driving.
        "camera-orbit": reducedRef.current ? "45deg 80deg auto" : "90deg 90deg auto",
        style: { width: "100%", height: "100%", backgroundColor: "transparent" },
      })}
    </div>
  );
}
