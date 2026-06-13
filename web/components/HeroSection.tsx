import { CtaButtons } from "@/components/CtaButtons";

/** Central hero: wordmark title, mono description, CTAs. */
export function HeroSection() {
  return (
    <div className="w-full max-w-3xl space-y-8 text-center">
      <h1 className="font-display text-6xl font-black uppercase leading-[0.95] tracking-tight text-fg sm:text-8xl">
        Ghost Tips
      </h1>
      <p className="mx-auto max-w-xl font-mono text-[17px] font-bold text-fg sm:text-[19px]">
        Per-second support for creators and journalists. The link between you and
        who you support stays private.
      </p>
      <CtaButtons />
    </div>
  );
}
