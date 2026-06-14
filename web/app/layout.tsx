import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
// Variant B (branch background-efecto): Efecto-style thermal gradient-map field.
// Variant A (branch master): React Bits Dither. Both export DitherBackground, so
// only this import line differs between the two background branches.
import { DitherBackground } from "@/components/EfectoBackground";
import { TopBar } from "@/components/TopBar";
import { CrosshairCursor } from "@/components/CrosshairCursor";

// Rigid Square (local OTF) — display + secondary text per the Ghost brand.
const rigid = localFont({
  src: [
    { path: "./fonts/RigidSquare-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/RigidSquare-ExtraBold.otf", weight: "800", style: "normal" },
  ],
  variable: "--font-rigid",
  display: "swap",
});
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Thermal",
  description:
    "Thermal — support creators privately. Per-second, anonymous support for creators and journalists.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${rigid.variable} ${jetbrains.variable} scroll-smooth`}>
      <body className="overflow-x-hidden">
        <Providers>
          <CrosshairCursor />
          <main className="relative min-h-screen w-full overflow-x-hidden">
            {/* Fixed-in-view animated dither background (sticky full-screen layer);
                content scrolls over it via -mt-[100vh]. */}
            <div className="pointer-events-none sticky top-0 z-0 h-screen w-full overflow-hidden">
              <DitherBackground />
              <div className="absolute inset-0 bg-black/35" />
            </div>
            <div className="relative z-10 -mt-[100vh]">
              <TopBar />
              {children}
            </div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
