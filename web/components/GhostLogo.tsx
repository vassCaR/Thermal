/**
 * Ghost mark. The source SVG is a dark multi-path logo; brightness(0) collapses
 * every path to black (alpha preserved), then invert(1) flips it to a clean white
 * silhouette on a transparent background — no residual colored/white square.
 */
export function GhostLogo({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-ghost.svg"
      alt="Ghost"
      className={className}
      style={{ filter: "brightness(0) invert(1)", objectFit: "contain" }}
    />
  );
}
