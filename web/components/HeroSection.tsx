import { CtaButtons } from "@/components/CtaButtons";
import { GhostLogo } from "@/components/GhostLogo";

/** Central hero: ghost mark + GHOST TIPS wordmark, subtitle, CTAs. */
export function HeroSection() {
  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-8 text-center">
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        <GhostLogo className="h-[clamp(3rem,9vw,7rem)] w-[clamp(3rem,9vw,7rem)] shrink-0" />
        <h1 className="font-display text-[clamp(2.75rem,11vw,8rem)] font-extrabold uppercase leading-[0.9] tracking-tight text-fg">
          Thermal
        </h1>
      </div>
      <p className="mx-auto max-w-2xl font-display text-[clamp(1rem,2.2vw,1.4rem)] font-normal leading-relaxed text-fg/75">
        Per-second support for creators and journalists. The link between you and
        who you support stays private.
      </p>
      <CtaButtons />
    </div>
  );
}
