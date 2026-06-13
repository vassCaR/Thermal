"use client";

import dynamic from "next/dynamic";

// WebGL component → client-only, never SSR'd. Fills its (relative) parent.
const Dither = dynamic(() => import("./Dither/Dither"), { ssr: false });

/** Orange halftone/dithering shader, filling the central block. */
export function DitherBackground() {
  return (
    <div className="absolute inset-0 z-0" aria-hidden>
      <Dither
        waveColor={[0.9764705882352941, 0.29411764705882354, 0.09411764705882353]}
        disableAnimation={false}
        enableMouseInteraction
        mouseRadius={0.1}
        colorNum={4.5}
        pixelSize={2}
        waveAmplitude={0.39}
        waveFrequency={3.7}
        waveSpeed={0.2}
      />
    </div>
  );
}
