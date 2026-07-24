import { useEffect } from "react";
import { Link } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import { ArrowRight, HelpCircle } from "lucide-react";
import FinancingBadge from "@/components/FinancingBadge";

// Plain-text mirror of SECTIONS used for FAQPage JSON-LD (no JSX/links).
const SCHEMA_QA: { q: string; a: string }[] = [
  { q: "How much do treatments cost?", a: "Every treatment is priced individually on our services menu. Some items like neurotoxins are priced per unit, and your final investment is confirmed at your complimentary consultation — no surprises." },
  { q: "Do you require a deposit to book?", a: "No deposit is taken at booking. We keep a card on file and only charge it for completed services or per our cancellation policy." },
  { q: "Do you offer financing?", a: "Yes — flexible monthly plans through Cherry and Affirm. Soft-credit check only, no impact on your score. Memberships and custom packages also available." },
  { q: "What is your cancellation policy?", a: "We require at least 48 hours notice to cancel or reschedule. Cancellations inside 48 hours or no-shows are charged a $200 fee to the card on file." },
  { q: "Where are you located?", a: "Our San Jose studio is at 2100 Curtner Ave, Ste 1B, San Jose, CA 95124." },
];


const SECTIONS: { id: string; title: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    id: "pricing",
    title: "Pricing",
    items: [
      {
        q: "How much do treatments cost?",
        a: <>Every treatment is priced individually on our <Link to="/services" className="text-primary underline">services menu</Link>. Some items (like neurotoxins) are priced per unit, and your final investment is confirmed at your complimentary consultation — no surprises.</>,
      },
      {
        q: "Do you require a deposit to book?",
        a: <>No deposit is taken at booking. We keep a card on file and only charge it for completed services or per our cancellation policy below.</>,
      },
      {
        q: "Do you offer financing?",
        a: <>Yes — flexible monthly plans through Cherry and Affirm. Soft-credit check only, no impact on your score. Memberships and custom packages also available.</>,
      },
    ],
  },
  {
    id: "comfort",
    title: "Comfort, pain & downtime",
    items: [
      {
        q: "Does it hurt?",
        a: <>Most clients describe injectables as a quick pinch. We use ice, vibration tools, and topical numbing where appropriate. Laser comfort varies by device — we'll walk you through what to expect.</>,
      },
      {
        q: "Is there downtime?",
        a: <>Most treatments have little to no real downtime — you can typically return to your day right after. Specific aftercare is in the "After your visit" section of each service page and in the pre-/post-visit emails we send you.</>,
      },
      {
        q: "What should I do to prepare?",
        a: <>For most injectables: avoid alcohol and blood-thinning supplements for 24 hours, arrive with clean skin, and eat a light meal. Detailed pre-visit instructions are emailed to you ahead of every appointment.</>,
      },
    ],
  },
  {
    id: "policies",
    title: "Cancellations & policies",
    items: [
      {
        q: "What is your cancellation policy?",
        a: <>We require 48 hours notice to reschedule or cancel. A $200 fee applies for no-shows or late cancellations, charged to the card on file. Within 48 hours, please call <a href="tel:4083511873" className="underline">408-351-1873</a>.</>,
      },
      {
        q: "Can I change my appointment online?",
        a: <>Yes — every confirmation email has a "Manage appointment" link that lets you reschedule or cancel without signing in (outside the 48-hour window).</>,
      },
      {
        q: "Is my health information private?",
        a: <>Yes. We follow HIPAA practices. Read our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link> for details.</>,
      },
    ],
  },
  {
    id: "general",
    title: "General",
    items: [
      {
        q: "Where are you located?",
        a: <>We're located in <Link to="/san-jose" className="text-primary underline">San Jose</Link> at 2100 Curtner Ave, Ste 1B.</>,
      },
      {
        q: "Who will I see?",
        a: <>You'll be seen by a licensed medical provider on our team — credentials and bios are on each location page.</>,
      },
      {
        q: "Do you offer free consultations?",
        a: <>Yes — complimentary in-person or televisit consultations are available so we can build a plan that fits you.</>,
      },
    ],
  },
];

export default function FAQ() {
  usePageMeta({
    title: "FAQ — Radiantilyk Aesthetic",
    description: "Pricing, financing, pain, downtime, cancellation policy and other frequently asked questions about Radiantilyk Aesthetic medspa in San Jose.",
    canonical: "https://bookrka.com/faq",
  });

  // FAQPage JSON-LD for rich results
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: SCHEMA_QA.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 sm:py-16 max-w-3xl">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-primary mb-3">Help center</p>
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl mb-4">Questions, answered.</h1>
        <p className="text-muted-foreground max-w-2xl mb-8">
          The honest version of everything we get asked most often. Don't see your question?
          Text or call <a href="tel:4083511873" className="underline hover:text-primary">408-351-1873</a> — a real person will get back to you.
        </p>

        <FinancingBadge className="mb-10" />

        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="mb-10 scroll-mt-24">
            <h2 className="font-serif text-2xl sm:text-3xl mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" /> {s.title}
            </h2>
            <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-4">
              {s.items.map((it, i) => (
                <AccordionItem key={i} value={`${s.id}-${i}`}>
                  <AccordionTrigger className="text-sm text-left">{it.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-foreground/80 leading-relaxed">{it.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}

        <div className="mt-12 text-center">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/book">Book an appointment <ArrowRight className="h-4 w-4 ml-1.5" /></Link>
          </Button>
        </div>

        {/* FAQPage JSON-LD for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: SECTIONS.flatMap((s) => s.items).map((it) => ({
                "@type": "Question",
                name: it.q,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: typeof it.a === "string" ? it.a : "See radiantilyk.com/faq for the full answer.",
                },
              })),
            }),
          }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
