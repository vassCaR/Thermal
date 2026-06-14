"use client";

import dynamic from "next/dynamic";
import { Reveal } from "@/components/Reveal";

// Heavy WebGL canvas → lazy, client-only.
const Privacy3D = dynamic(() => import("@/components/Privacy3D"), { ssr: false });

/** Scrollable brutalist content below the hero (basement.studio-style scroll). */
export function HomeSections() {
  return (
    <div className="relative">
      <WhoWeAre />
      <HowItWorks />
      <HelmetSplit />
      <PrivacyCanvas />
      <WhyPrivacy />
      <TheProblem />
      <FinalCta />
    </div>
  );
}

function Section({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="border-t border-border/50 bg-white/[0.025] px-6 py-24 backdrop-blur-md sm:py-32"
    >
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </section>
  );
}

const SKETCHFAB_MODEL = "932a96f443cc4c5aa7cb795afdb75f17";

/** Split layout: copy on one side, the Ghost helmet (Sketchfab embed) on the
 *  other. Real-time R3F does not present on this machine's GPU, so we use the
 *  official Sketchfab viewer (license-compliant, its own WebGL pipeline). */
function HelmetSplit() {
  return (
    <section
      id="helmet"
      className="border-t border-border/50 bg-white/[0.025] px-6 py-24 backdrop-blur-md sm:py-32"
    >
      <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div>
            <p className="gt-eyebrow">UNIT / GHOST</p>
            <h2 className="gt-section-title">Built for the unseen</h2>
            <p className="mt-6 max-w-md font-display text-[15px] leading-relaxed text-fg/75">
              Privacy is a posture, not an afterthought. Inspect the Ghost unit
              from every angle — drag to orbit. Support stays just as invisible as
              the face behind the visor.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="relative aspect-[4/3] w-full overflow-hidden border border-border/60 bg-black/40">
            <iframe
              title="Ghost helmet — 3D"
              src={`https://sketchfab.com/models/${SKETCHFAB_MODEL}/embed?autospin=0.4&autostart=1&preload=0&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=0&dnt=1`}
              loading="lazy"
              allow="autoplay; fullscreen; xr-spatial-tracking"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
              style={{ border: 0 }}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function WhoWeAre() {
  return (
    <Section id="about">
      <Reveal>
        <p className="gt-eyebrow">00 / WHO WE ARE</p>
        <h2 className="gt-section-title max-w-3xl">
          Support that leaves no trace
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-6 max-w-2xl font-mono text-[15px] leading-relaxed text-fg/80">
          Ghost is a private support platform for content creators and
          journalists. You back the voices that matter while the link between you
          and who you support stays completely anonymous — no one, not even us, can
          see who you fund.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          ["Anonymous by default", "The fan→creator link never touches a public ledger."],
          ["Per-second", "Hold a button; you give a tiny amount of USDC every second."],
          ["Settled on Arc", "Real value moves and settles on Circle's Arc network."],
        ].map(([title, body], i) => (
          <Reveal key={title} delay={0.1 * i} className="h-full">
            <div className="gt-card h-full">
              <p className="font-display text-lg font-black uppercase text-accent">
                {title}
              </p>
              <p className="mt-3 font-mono text-[13px] leading-relaxed text-muted">
                {body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    ["01", "Connect a wallet", "Bring MetaMask, Brave, Rabby, Coinbase or WalletConnect. A private account is created for you on first support."],
    ["02", "Hold to support", "Press and hold. Every second, a micro-amount of USDC is routed privately to the creator you chose."],
    ["03", "Stay invisible", "The creator sees an anonymous running total. Release to stop. Your identity never leaves your device."],
  ];
  return (
    <Section id="how">
      <Reveal>
        <p className="gt-eyebrow">01 / HOW IT WORKS</p>
        <h2 className="gt-section-title">Three moves, zero exposure</h2>
      </Reveal>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {steps.map(([n, title, body], i) => (
          <Reveal key={n} delay={0.1 * i} className="h-full">
            <div className="gt-card flex h-full flex-col gap-4">
              <span className="font-display text-5xl font-black text-accent/30">
                {n}
              </span>
              <p className="font-display text-xl font-black uppercase text-fg">
                {title}
              </p>
              <p className="font-mono text-[13px] leading-relaxed text-muted">
                {body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function WhyPrivacy() {
  const points = [
    ["No public trail", "There is no on-chain record linking your wallet to a creator you support."],
    ["Anonymous totals", "Creators only ever see an aggregate amount — never a supporter list."],
    ["Safe to back anyone", "Support dissidents, journalists or controversial voices without risk."],
  ];
  return (
    <Section id="privacy">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <Reveal>
          <p className="gt-eyebrow">02 / WHY PRIVACY</p>
          <h2 className="gt-section-title">
            Backing someone shouldn&apos;t expose you
          </h2>
          <p className="mt-6 font-mono text-[15px] leading-relaxed text-fg/80">
            Public tipping turns your support into a permanent, searchable record.
            Ghost keeps the act of giving private by design, so who you fund is
            nobody&apos;s business but yours.
          </p>
        </Reveal>
        <div className="grid gap-4">
          {points.map(([title, body], i) => (
            <Reveal key={title} delay={0.08 * i}>
              <div className="gt-card flex items-start gap-4">
                <span className="mt-1 h-2 w-2 shrink-0 bg-accent" aria-hidden />
                <div>
                  <p className="font-display text-base font-black uppercase text-fg">
                    {title}
                  </p>
                  <p className="mt-1 font-mono text-[13px] leading-relaxed text-muted">
                    {body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

function TheProblem() {
  return (
    <Section id="problem">
      <Reveal>
        <p className="gt-eyebrow">03 / THE PROBLEM</p>
        <h2 className="gt-section-title">Public money, public risk</h2>
      </Reveal>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Reveal>
          <div className="h-full border border-border bg-black/55 p-7 backdrop-blur">
            <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-muted">
              Public tipping
            </p>
            <ul className="mt-5 space-y-3 font-mono text-[13px] leading-relaxed text-muted">
              <li>— Everyone can see who you back</li>
              <li>— Donations are permanent and searchable</li>
              <li>— Supporters can be targeted or doxxed</li>
              <li>— Creators expose their whole audience</li>
            </ul>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="h-full border-2 border-accent bg-accent/10 p-7 backdrop-blur">
            <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-accent">
              Ghost
            </p>
            <ul className="mt-5 space-y-3 font-mono text-[13px] leading-relaxed text-fg/90">
              <li>— Nobody sees who you support</li>
              <li>— The fan→creator link stays off-ledger</li>
              <li>— Supporters stay anonymous and safe</li>
              <li>— Creators see only an anonymous total</li>
            </ul>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function PrivacyCanvas() {
  return (
    <section
      id="privacy-3d"
      className="border-t border-border/50 bg-white/[0.025] px-6 py-20 backdrop-blur-md sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <p className="gt-eyebrow text-center">THE PRINCIPLE</p>
        </Reveal>
        <Reveal delay={0.08}>
          {/* Wide, short stage for the extruded wireframe word. */}
          <div className="relative mx-auto h-[clamp(160px,28vw,360px)] w-full">
            <Privacy3D />
            {/* Accessible text — the visual is decorative wireframe geometry. */}
            <span className="sr-only">PRIVACY</span>
          </div>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mx-auto mt-6 max-w-xl text-center font-display text-[15px] leading-relaxed text-fg/70">
            Privacy isn&apos;t a feature bolted on top — it&apos;s the structure
            everything else is built around.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <Section>
      <Reveal>
        <div className="flex flex-col items-center gap-8 text-center">
          <h2 className="gt-section-title max-w-3xl">
            Ready to support, privately?
          </h2>
          <p className="max-w-xl font-mono text-[15px] leading-relaxed text-fg/80">
            Scroll back up, hold the button, and start backing the voices that
            matter — without anyone knowing it&apos;s you.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="#top" className="gt-brutal-btn">
              Start supporting
            </a>
            <a
              href="https://github.com/vassCaR/ghost-tips"
              target="_blank"
              rel="noreferrer"
              className="gt-frame-link min-w-[180px]"
            >
              <span>GitHub</span>
              <span aria-hidden>&rarr;</span>
            </a>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
