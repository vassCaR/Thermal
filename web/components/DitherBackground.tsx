"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// WebGL component → client-only, never SSR'd. Fills its (relative) parent.
const Dither = dynamic(() => import("./Dither/Dither"), { ssr: false });

/** Ghost/cyber dithered waves (cold cyan), filling the hero behind the content.
 *  Animation is paused when the user prefers reduced motion. */
export function DitherBackground() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div className="absolute inset-0 z-0 h-full w-full" aria-hidden>
      <Dither
        waveColor={[0.37, 0.83, 0.9]}
        disableAnimation={reduced}
        enableMouseInteraction={!reduced}
        mouseRadius={0.3}
        colorNum={4}
        pixelSize={2}
        waveAmplitude={0.3}
        waveFrequency={3}
        waveSpeed={0.05}
      />
    </div>
  );
}
