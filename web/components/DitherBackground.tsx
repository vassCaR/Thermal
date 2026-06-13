"use client";

import dynamic from "next/dynamic";

// WebGL component → client-only, never SSR'd.
const Dither = dynamic(() => import("./Dither/Dither"), { ssr: false });

/**
 * Fond animé Dither (React Bits) plein écran, derrière tout le contenu.
 * Props reprises telles quelles de la config fournie.
 */
export function DitherBackground() {
  return (
    <div className="fixed inset-0 z-0" aria-hidden>
      <Dither
        waveColor={[0.20392156862745098, 0.34901960784313724, 0.7098039215686275]}
        disableAnimation={false}
        enableMouseInteraction={false}
        mouseRadius={0.1}
        colorNum={4.5}
        pixelSize={2}
        waveAmplitude={0.39}
        waveFrequency={3.7}
        waveSpeed={0.01}
      />
    </div>
  );
}
