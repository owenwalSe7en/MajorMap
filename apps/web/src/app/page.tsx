import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FooterSection } from "@/components/landing/footer-section";

export default function HomePage() {
  return (
    <main className="relative overflow-x-hidden noise-overlay">
      <HeroSection />
      <FeaturesSection />
      <FooterSection />
    </main>
  );
}
