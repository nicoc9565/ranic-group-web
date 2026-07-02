import { AboutUs } from "@/components/public/AboutUs";
import { CategoriesSection } from "@/components/public/CategoriesSection";
import { ContactSection } from "@/components/public/ContactSection";
import { CredentialsBar } from "@/components/public/CredentialsBar";
import { Faq } from "@/components/public/Faq";
import { Hero } from "@/components/public/Hero";
import { HowWeWork } from "@/components/public/HowWeWork";
import { MapBrandProtection } from "@/components/public/MapBrandProtection";
import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteHeader } from "@/components/public/SiteHeader";
import { WhyUs } from "@/components/public/WhyUs";

export const metadata = {
  title: "RANIC GROUP LLC | Wholesale Buyer & Amazon Seller",
  description:
    "U.S.-based wholesale buyer and Amazon seller in Summit, NJ, purchasing inventory directly from brands with MAP discipline.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "RANIC GROUP LLC | Wholesale Buyer & Amazon Seller",
    description:
      "U.S.-based wholesale buyer and Amazon seller in Summit, NJ, purchasing inventory directly from brands.",
    url: "https://www.ranicgroup.com/",
    siteName: "RANIC GROUP LLC",
    type: "website",
  },
};

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-cream">
        <Hero />
        <CredentialsBar />
        <AboutUs />
        <WhyUs />
        <HowWeWork />
        <CategoriesSection />
        <MapBrandProtection />
        <Faq />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
