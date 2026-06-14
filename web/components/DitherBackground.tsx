"use client";

import dynamic from "next/dynamic";

// WebGL component → client-only, never SSR'd. Fills its (relative) parent.
const Dither = dynamic(() => import("./Dither/Dither"), { ssr: false });

/** Official React Bits Dither (orange halftone waves), filling the central block. */
export function DitherBackground() {
  return (
    <div className="absolute inset-0 z-0" aria-hidden>
      <Dither
        waveColor={[1, 0.4, 0.14901960784313725]}
        disableAnimation={false}
        enableMouseInteraction
        mouseRadius={0.2}
        colorNum={5}
        pixelSize={4}
        waveAmplitude={0.3}
        waveFrequency={5}
        waveSpeed={0.05}
      />
    </div>
  );
}
