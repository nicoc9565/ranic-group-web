import type { Metadata } from "next";
import { SiteFooter } from "@/components/public/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How RANIC GROUP LLC collects and uses information on ranicgroup.com.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-ink">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-ink-soft">Last updated: June 2026.</p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Information we collect
              </h2>
              <p className="mt-2">
                This site has a contact form. If you submit it, we collect your
                company/brand name, contact name, email address, the category
                you select, and your message. That information is sent directly
                to our email through Resend, a transactional email provider — it
                is not stored in any database on this site. If you email us
                directly instead, that communication stays in our inbox. To
                understand site traffic, we use Vercel Analytics, which records
                visits in an aggregated, anonymous way, without third-party
                tracking cookies and without identifying individual visitors.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                How we use this information
              </h2>
              <p className="mt-2">
                We use contact form submissions to respond to your inquiry, and
                aggregated Vercel Analytics data to understand how many people
                visit the site and improve its content. We don&apos;t sell or
                share visitor or contact information with third parties.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Cookies
              </h2>
              <p className="mt-2">
                This site does not use third-party tracking cookies.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Third-party links
              </h2>
              <p className="mt-2">
                This site is informational. Any purchase of our products happens
                on third-party platforms, subject to their own privacy policies,
                not this one.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Changes to this policy
              </h2>
              <p className="mt-2">
                We may update this policy occasionally. The date of the last
                update always appears at the top of this page.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Contact
              </h2>
              <p className="mt-2">
                For any privacy questions, write to us at{" "}
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
