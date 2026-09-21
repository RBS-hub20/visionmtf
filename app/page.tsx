import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { WhyMTF } from "@/components/WhyMTF";
import { HowItWorks } from "@/components/HowItWorks";
import { WaitFeature } from "@/components/WaitFeature";
import { LiveStatus } from "@/components/LiveStatus";
import { Pricing } from "@/components/Pricing";
import { Footer } from "@/components/Footer";
import { GridBackground } from "@/components/ui/GridBackground";

export default function Home() {
  return (
    <>
      <GridBackground />
      <Navbar />
      <main className="relative">
        <Hero />
        <WhyMTF />
        <HowItWorks />
        <WaitFeature />
        <LiveStatus />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
