import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { DitherBackground } from "@/components/DitherBackground";
import { Sidebar } from "@/components/Sidebar";
import { FloatingDeposit } from "@/components/FloatingDeposit";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ghost Tips",
  description: "Support anyone, by the second — without anyone knowing it's you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="relative min-h-screen">
        <DitherBackground />
        <Sidebar />
        <div className="relative z-10">
          <Providers>{children}</Providers>
        </div>
        <FloatingDeposit />
      </body>
    </html>
  );
}
