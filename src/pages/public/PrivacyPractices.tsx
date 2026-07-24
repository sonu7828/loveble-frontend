import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { usePageMeta } from "@/hooks/usePageMeta";

export const NPP_VERSION = "2026-07";

export default function PrivacyPractices() {
  usePageMeta({
    title: "Notice of Privacy Practices | Radiantilyk Aesthetic",
    description:
      "How Radiantilyk Aesthetic uses and protects your Protected Health Information (PHI) under HIPAA.",
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">
            HIPAA · Version {NPP_VERSION}
          </div>
          <h1 className="font-serif text-4xl md:text-5xl">Notice of Privacy Practices</h1>
          <p className="text-muted-foreground mt-3">
            Effective July 1, 2026 · Radiantilyk Aesthetic · 2100 Curtner Ave, Ste 1B, San Jose, CA
          </p>
        </div>

        <div className="prose prose-sm max-w-none text-foreground/85 space-y-6 leading-relaxed">
          <p className="font-semibold text-foreground">
            THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED
            AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.
          </p>

          <section>
            <h2 className="font-serif text-xl mt-8 mb-2">Our commitment to your privacy</h2>
            <p>
              Radiantilyk Aesthetic is required by the Health Insurance Portability and
              Accountability Act (HIPAA) to protect the privacy of your Protected Health
              Information (PHI), provide you this notice of our legal duties and privacy
              practices, and follow the terms of the notice currently in effect.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl mt-8 mb-2">How we may use and disclose your PHI</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Treatment.</strong> To provide, coordinate, or manage your care with our clinicians and consulting providers.</li>
              <li><strong>Payment.</strong> To bill and obtain payment for services from you, your card on file, or a financing partner.</li>
              <li><strong>Healthcare operations.</strong> Quality assessment, staff training, licensure, audits, and business planning.</li>
              <li><strong>Appointment reminders</strong> by email and text at the contact info you provide.</li>
              <li><strong>As required by law</strong> — including reporting suspected abuse, adverse events, or public health obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl mt-8 mb-2">Uses requiring your written authorization</h2>
            <p>
              We will obtain your written authorization before using or disclosing PHI for
              marketing, before/after photo publication, sale of PHI, or most disclosures
              of psychotherapy notes. You may revoke an authorization at any time in writing.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl mt-8 mb-2">Your rights</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Access.</strong> Inspect and receive a copy of your record. You can export your data anytime from your Account page.</li>
              <li><strong>Amendment.</strong> Request corrections to information you believe is inaccurate.</li>
              <li><strong>Accounting of disclosures.</strong> Request a list of certain disclosures we have made.</li>
              <li><strong>Restriction.</strong> Ask us to limit how we use or disclose your PHI.</li>
              <li><strong>Confidential communications.</strong> Ask that we contact you at a specific number or address.</li>
              <li><strong>Deletion.</strong> Request deletion of your PHI (subject to retention obligations under state and federal law).</li>
              <li><strong>Paper copy.</strong> Request a paper copy of this notice at any time.</li>
              <li><strong>Complaint.</strong> File a complaint with us or with the U.S. Department of Health and Human Services without retaliation.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl mt-8 mb-2">How we protect your PHI</h2>
            <p>
              We use administrative, physical, and technical safeguards including encrypted
              storage, access controls, audit logs, workforce training, signed Business
              Associate Agreements with our vendors, and a breach notification process
              consistent with HIPAA §164.400.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl mt-8 mb-2">Breach notification</h2>
            <p>
              If a breach of your unsecured PHI occurs, we will notify you without
              unreasonable delay and in no case later than 60 days after discovery.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl mt-8 mb-2">Changes to this notice</h2>
            <p>
              We reserve the right to change this notice and to make the revised notice
              effective for PHI we already have and any we receive in the future. The
              current version and effective date are shown at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl mt-8 mb-2">Contact — Privacy Officer</h2>
            <p>
              Kiem Vukadinovic, NP · Privacy &amp; Security Officer<br />
              Radiantilyk Aesthetic · 2100 Curtner Ave, Ste 1B, San Jose, CA 95124<br />
              <a className="underline" href="mailto:privacy@bookrka.com">privacy@bookrka.com</a> ·
              <a className="underline ml-2" href="tel:4083511873">408-351-1873</a>
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              To file a complaint with HHS: <a className="underline" href="https://www.hhs.gov/hipaa/filing-a-complaint" target="_blank" rel="noopener noreferrer">hhs.gov/hipaa/filing-a-complaint</a>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
