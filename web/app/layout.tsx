import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { DitherBackground } from "@/components/DitherBackground";
import { Sidebar } from "@/components/Sidebar";
import { TopMarquee } from "@/components/TopMarquee";

// Display = basement-grotesque (OFL, self-hosted). Montserrat kept as the
// reactivable alternative (swap --font-display in globals.css).
const basement = localFont({
  src: "./fonts/BasementGrotesque-Black.woff2",
  variable: "--font-basement",
  weight: "900",
  display: "swap",
});
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: "Ghost Tips",
  description:
    "Support creators privately. Per-second, anonymous support for creators and journalists.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${basement.variable} ${jetbrains.variable} ${montserrat.variable}`}
    >
      <body>
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden border-l border-border">
              <DitherBackground />
              {/* legibility veil over the shader */}
              <div className="pointer-events-none absolute inset-0 z-[1] bg-black/30" />
              <TopMarquee />
              <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-16">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
