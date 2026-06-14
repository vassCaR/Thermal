"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// WebGL component → client-only, never SSR'd. Fills its (relative) parent.
const Dither = dynamic(() => import("./Dither/Dither"), { ssr: false });

/** Variant A background — thermal/iron dithered waves (heat zones) behind the
 *  content. Slow + heavily pixelated; paused when off-viewport (IntersectionObserver),
 *  when the tab is hidden, or when the user prefers reduced motion. Mouse
 *  interaction is off — the CrosshairCursor overlay replaces the old pointer halo. */
export function DitherBackground() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0 z-0 h-full w-full" aria-hidden>
      <Dither
        waveColor={[1.0, 0.353, 0.0]}
        disableAnimation={reduced}
        enableMouseInteraction={false}
        mouseRadius={0.3}
        colorNum={5}
        pixelSize={4}
        waveAmplitude={0.3}
        waveFrequency={3}
        waveSpeed={0.025}
        paused={offscreen}
      />
    </div>
  );
}
