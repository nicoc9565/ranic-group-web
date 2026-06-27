import type { Metadata } from "next";
import { SiteFooter } from "@/components/public/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of use for ranicgroup.com.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-ink">
            Terms of Use
          </h1>
          <p className="mt-2 text-sm text-ink-soft">Last updated: June 2026.</p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Acceptance of terms
              </h2>
              <p className="mt-2">
                By using this site, you accept these terms of use. If you
                disagree, please don&apos;t use it.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Use of the site
              </h2>
              <p className="mt-2">
                This site is informational: it presents RANIC GROUP LLC as a
                wholesale buyer and Amazon seller, and the product categories we
                purchase. We don&apos;t sell products directly through this site
                — any transaction happens on third-party marketplaces, outside
                our control.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Intellectual property
              </h2>
              <p className="mt-2">
                The content of this site (text, design, brand) belongs to RANIC
                GROUP LLC. It may not be reproduced without authorization.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                No warranties
              </h2>
              <p className="mt-2">
                This site is provided &quot;as is&quot;, with no warranties of
                any kind regarding its availability or accuracy.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Limitation of liability
              </h2>
              <p className="mt-2">
                RANIC GROUP LLC is not liable for damages arising from the use
                or inability to use this site.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Governing law
              </h2>
              <p className="mt-2">
                These terms are governed by the laws of the State of New Jersey,
                United States.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Contact
              </h2>
              <p className="mt-2">
                For any questions about these terms, write to us at{" "}
                <a
                  href="mailto:nicolas.conti@ranicgroup.com"
                  className="underline hover:text-ink-soft"
                >
                  nicolas.conti@ranicgroup.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
