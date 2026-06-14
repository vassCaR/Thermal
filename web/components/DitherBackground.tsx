"use client";

/**
 * Animated background, pure CSS (no WebGL / three.js).
 * The WebGL Dither shader rendered fine but ANGLE/D3D11 would not present its
 * swapped frames on this machine, so the canvas looked frozen. This CSS version
 * is compositor-driven and animates reliably on any GPU/driver, while keeping the
 * same orange brutalist dithered-smoke aesthetic.
 */
export function DitherBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="gt-smoke" />
      <div className="gt-halftone" />
    </div>
  );
}
