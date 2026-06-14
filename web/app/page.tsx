import { HeroSection } from "@/components/HeroSection";
import { HomeSections } from "@/components/HomeSections";

export default function Home() {
  return (
    <>
      <section
        id="top"
        className="flex min-h-screen items-center justify-center px-6 py-20"
      >
        <HeroSection />
      </section>
      <HomeSections />
    </>
  );
}
