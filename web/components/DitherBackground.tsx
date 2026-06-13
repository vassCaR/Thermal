"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// WebGL component → client-only, never SSR'd. Fills its (relative) parent.
const Dither = dynamic(() => import("./Dither/Dither"), { ssr: false });

/** Tiny on-page readout of the Dither render loop, shown only with ?ditherdebug
 *  in the URL. Lets us confirm the loop ticks without pasting into the console. */
function DitherDebug() {
  const [show, setShow] = useState(false);
  const [info, setInfo] = useState("…");

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("ditherdebug")) return;
    setShow(true);
    let last = 0;
    const id = setInterval(() => {
      const d = (window as unknown as { __dither?: { tick: number; time: number } }).__dither;
      const tick = d?.tick ?? -1;
      const moving = tick > last;
      last = tick;
      setInfo(`tick=${tick} time=${d?.time?.toFixed(2) ?? "?"} ${moving ? "TOURNE" : "BLOQUEE"}`);
    }, 500);
    return () => clearInterval(id);
  }, []);

  if (!show) return null;
  return (
    <div className="pointer-events-none fixed left-2 top-2 z-[9999] bg-black/80 px-3 py-2 font-mono text-xs text-green-400">
      DITHER {info}
    </div>
  );
}

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
      <DitherDebug />
    </div>
  );
}
