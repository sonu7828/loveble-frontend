import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { useEffect } from "react";

export default function Privacy() {
  useEffect(() => { document.title = "Privacy Policy — Radiantilyk Aesthetic"; }, []);
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="font-serif text-4xl md:text-5xl mb-2">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mb-10">Last updated: May 7, 2026</p>

        <article className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-serif text-2xl mt-2">1. Introduction</h2>
            <p>Radiantilyk Aesthetic ("we", "us") respects your privacy. This policy explains what we collect when you use bookrka.com, our booking and patient portal, and how we use it.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">2. Information we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contact info</strong>: name, email, phone, date of birth.</li>
              <li><strong>Appointment data</strong>: services booked, provider, location, notes you provide.</li>
              <li><strong>Health info</strong>: signed consent forms and intake answers needed to safely deliver care (PHI).</li>
              <li><strong>Payment info</strong>: a payment processor (Stripe) securely stores your card. We never see full card numbers.</li>
              <li><strong>Technical</strong>: IP address, browser/device, basic analytics.</li>
            </ul>
          </section>
          <section>
            <h2 className="font-serif text-2xl">3. How we use it</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Schedule and confirm your appointments.</li>
              <li>Send reminders and post-visit follow-ups via email and SMS.</li>
              <li>Process no-show fees per our cancellation policy.</li>
              <li>Comply with medical record-keeping obligations.</li>
            </ul>
          </section>
          <section>
            <h2 className="font-serif text-2xl">4. SMS messaging</h2>
            <p>By providing your phone number you consent to receive booking and reminder text messages. Reply STOP to unsubscribe; reply HELP for help. Message and data rates may apply.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">5. Sharing</h2>
            <p>We share data only with vendors that help us run the business (booking, payments, email/SMS, calendars) under contracts that restrict their use. We do not sell personal information.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">6. Your rights</h2>
            <p>California residents may request access, correction, or deletion of personal information. Email <a className="underline" href="mailto:kv@rkaglow.com">kv@rkaglow.com</a> to make a request.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">7. Security & retention</h2>
            <p>We protect data with industry-standard encryption in transit and at rest. Medical records are retained for the period required by California law.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">8. Contact</h2>
            <p>Radiantilyk Aesthetic · 2100 Curtner Ave, Ste 1B, San Jose, CA 95124 · <a className="underline" href="mailto:kv@rkaglow.com">kv@rkaglow.com</a> · 408-351-1873.</p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
