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
            <main className="relative min-h-screen flex-1 border-l border-border">
              {/* Fixed-in-view animated background: sticky full-screen layer, with the
                  scrolling content pulled up over it via -mt-[100vh]. */}
              <div className="pointer-events-none sticky top-0 z-0 h-screen w-full overflow-hidden">
                <DitherBackground />
                <div className="absolute inset-0 bg-black/35" />
              </div>
              <div className="relative z-10 -mt-[100vh]">
                <TopMarquee />
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
