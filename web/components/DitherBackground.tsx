"use client";

import dynamic from "next/dynamic";

// WebGL component → client-only, never SSR'd. Fills its (relative) parent.
const Dither = dynamic(() => import("./Dither/Dither"), { ssr: false });

/** Orange halftone/dithering shader, filling the central block. */
export function DitherBackground() {
  return (
    <div className="absolute inset-0 z-0" aria-hidden>
      <Dither
        waveColor={[1, 0.42, 0.1]}
        disableAnimation={false}
        enableMouseInteraction
        mouseRadius={0.3}
        colorNum={4.5}
        pixelSize={2}
        waveAmplitude={0.39}
        waveFrequency={3.7}
        waveSpeed={0.02}
      />
    </div>
  );
}
