import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { DitherBackground } from "@/components/DitherBackground";
import { Header } from "@/components/Header";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ghost Tips",
  description:
    "Support who matters. Anonymously. Per-second, private support for creators and journalists.",
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
        <Providers>
          <Header />
          <div className="relative z-10">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
