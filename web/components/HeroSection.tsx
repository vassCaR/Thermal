import { CtaButtons } from "@/components/CtaButtons";

/** Central hero: THERMAL wordmark, subtitle, support CTAs (no logo placeholder). */
export function HeroSection() {
  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-8 text-center">
      <h1 className="font-display text-[clamp(2.75rem,11vw,8rem)] font-extrabold uppercase leading-[0.9] tracking-tight text-fg">
        Thermal
      </h1>
      <p className="mx-auto max-w-2xl font-display text-[clamp(1rem,2.2vw,1.4rem)] font-normal leading-relaxed text-fg/75">
        Private support for creators and journalists. The link between you and
        who you support stays anonymous.
      </p>
      <CtaButtons />
    </div>
  );
}
