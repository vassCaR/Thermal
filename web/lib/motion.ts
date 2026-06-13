import type { Transition, Variants } from "motion/react";

/** Shared spring used across the app (transform/opacity only for perf). */
export const spring: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 30,
  mass: 0.8,
};

/** Fade + small rise. Children of a `container` stagger in. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: spring },
};

/** Parent that staggers its children's entrance. */
export const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};
