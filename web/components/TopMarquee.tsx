const SEGMENTS = [
  "SUPPORT CREATORS PRIVATELY",
  "NOBODY SEES WHO YOU BACK",
  "PER-SECOND, ANONYMOUS",
  "SETTLED ON ARC",
];

const LINE = SEGMENTS.join("  —  ") + "  —  ";

/** Top scrolling marquee. Pure CSS (translateX loop), reduced-motion aware. */
export function TopMarquee() {
  return (
    <div className="relative z-10 overflow-hidden border-b border-border bg-black/70 py-2 backdrop-blur">
      <div className="gt-marquee-track flex w-max whitespace-nowrap font-mono text-xs uppercase tracking-widest text-muted">
        <span className="px-2">{LINE}</span>
        <span className="px-2" aria-hidden>
          {LINE}
        </span>
      </div>
    </div>
  );
}
