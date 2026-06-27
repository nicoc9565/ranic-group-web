import { CategoriesSection } from "@/components/public/CategoriesSection";
import { CtaBand } from "@/components/public/CtaBand";
import { Hero } from "@/components/public/Hero";
import { SiteFooter } from "@/components/public/SiteFooter";

export default function Home() {
  return (
    <>
      <main className="flex-1">
        <Hero />
        <CategoriesSection />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
