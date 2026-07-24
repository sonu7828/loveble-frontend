import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { useEffect } from "react";

export default function Terms() {
  useEffect(() => { document.title = "Terms of Service — Radiantilyk Aesthetic"; }, []);
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="font-serif text-4xl md:text-5xl mb-2">Terms of Service</h1>
        <p className="text-xs text-muted-foreground mb-10">Last updated: May 7, 2026</p>

        <article className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-serif text-2xl mt-2">1. Booking</h2>
            <p>Appointment requests are not confirmed until you receive an approval email from our team. Times shown are tentative until approved.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">2. Cancellation policy (48-hour notice)</h2>
            <p>We require <strong>at least 48 hours' notice</strong> to cancel or reschedule. Cancellations or no-shows inside the 48-hour window are subject to a <strong>$200 no-show fee</strong>, charged to the card on file.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">3. Card on file</h2>
            <p>A valid credit card is required to book. We charge the card only for no-show fees or services you receive. We do not collect a booking deposit.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">4. Medical care & consent</h2>
            <p>Treatments are performed under medical direction. You agree to provide accurate health information and to sign required consent forms before treatment. Results vary.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">5. Communications</h2>
            <p>By booking you agree to receive booking, reminder, and follow-up emails and SMS. You can reply STOP to opt out of SMS or unsubscribe from email at any time. Transactional appointment messages may continue.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">6. Refunds</h2>
            <p>Services rendered are non-refundable. Pricing, packages, and promotions are subject to change.</p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">7. Contact</h2>
            <p>Questions? <a className="underline" href="mailto:kv@rkaglow.com">kv@rkaglow.com</a> · 408-351-1873.</p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
