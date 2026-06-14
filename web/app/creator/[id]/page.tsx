"use client";

import { useParams } from "next/navigation";
import { CtaButtons } from "@/components/CtaButtons";

/** Per-creator support page. The creator is fixed by the URL; the same
 *  amount-based support widget as the home hero drives the donation. */
export default function CreatorPage() {
  const params = useParams<{ id: string }>();
  const creatorId = decodeURIComponent(params.id ?? "ghost:alice");

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-10 px-6 py-28 text-center">
      <header>
        <p className="gt-eyebrow mb-1 justify-center">Creator</p>
        <h1 className="font-display text-4xl font-black uppercase text-fg">
          {creatorId}
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-wide text-muted">
          support this creator privately
        </p>
      </header>

      <CtaButtons creatorId={creatorId} />

      <a href="/" className="gt-frame-link min-w-[180px] justify-center">
        <span>Back home</span>
        <span aria-hidden>&larr;</span>
      </a>
    </div>
  );
}
