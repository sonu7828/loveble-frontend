import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Clock, ShieldCheck, Sparkles, AlertTriangle } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { usePageMeta } from "@/hooks/usePageMeta";

const HERO = "https://moqxtvbdgfambpmmslrr.supabase.co/storage/v1/object/public/marketing-assets/campaigns/everesse-july-2026.png";

type Offer = {
  id: string;
  name: string;
  price: string;
  per?: string;
  badge?: string;
  duration: string;
  blurb: string;
  highlight?: boolean;
};

const PROMOS: Offer[] = [
  {
    id: "36650951-4dd0-455d-8904-308353acbd0c",
    name: "Under Eyes",
    price: "$250",
    badge: "July only",
    duration: "30 min",
    blurb: "Tighten and brighten the under-eye area — soften crepiness, lift hollows.",
  },
  {
    id: "05025d97-5b51-4193-9cd9-ca73feeac535",
    name: "Neck / Jawline",
    price: "$250",
    badge: "July only",
    duration: "60 min",
    blurb: "Redefine the jawline and smooth neck laxity in one session.",
  },
  {
    id: "2fc20f89-0b58-450e-9417-837b6d433c78",
    name: "Full Face",
    price: "$350",
    badge: "July only · best value",
    duration: "60 min",
    blurb: "Full-face lift, tighten and collagen-boost. No downtime.",
    highlight: true,
  },
];

const PACKAGES: Offer[] = [
  {
    id: "497160a1-d1e7-45f6-bad3-8e3d6692c513",
    name: "Full Face — Package of 2",
    price: "$1,400",
    per: "$700/session · save $100",
    duration: "2 sessions · 4–6 wks apart",
    blurb: "Compounding lift with two full-face Volnewmer sessions.",
  },
  {
    id: "6e129068-79ac-4e91-9d0a-b49f005b0574",
    name: "Full Face — Package of 3",
    price: "$1,950",
    per: "$650/session · save $300",
    duration: "3 sessions · 4–6 wks apart",
    blurb: "Maximum collagen remodeling for the most dramatic result.",
    highlight: true,
  },
  {
    id: "45cf4015-e5c6-4689-9997-704ad87c1bef",
    name: "Full Face + Neck — Package of 2",
    price: "$1,800",
    per: "$900/session · save $100",
    duration: "2 sessions · 4–6 wks apart",
    blurb: "Treat face and neck together for cohesive lifting.",
  },
];

const bookHref = (id: string) => `/book?service=${id}`;

export default function Everesse() {
  usePageMeta({
    title: "Everesse by Volnewmer — July Promo | Radiantilyk Aesthetic",
    description:
      "Everesse by Volnewmer monopolar RF skin tightening — July promo. Under eyes $250 · Neck/Jawline $250 · Full Face $350. Only 10 spots. Online booking only.",
  });

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="container mx-auto max-w-6xl px-4 py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs uppercase tracking-widest mb-4">
                <Sparkles className="h-3.5 w-3.5" /> Finally arrived · July only
              </div>
              <h1 className="font-serif text-4xl md:text-6xl leading-tight mb-4">
                Everesse by Volnewmer
              </h1>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                The next generation of monopolar RF skin tightening — lift, tighten, and stimulate
                deep collagen and elastin in a single session. No needles. No downtime. Safe for
                every skin tone.
              </p>
              <div className="flex flex-wrap gap-3 mb-6 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
                  <Clock className="h-3.5 w-3.5" /> 30–60 min
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> No downtime
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" /> All skin types
                </span>
              </div>
              <Button asChild size="lg" className="rounded-full px-8">
                <a href="#book">Book your spot</a>
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Only 10 spots total across all three promo areas. First come, first served.
              </p>
            </div>
            <div className="relative">
              <img
                src={HERO}
                alt="Everesse by Volnewmer launch"
                className="rounded-2xl shadow-xl w-full object-cover"
                loading="eager"
              />
            </div>
          </div>
        </section>

        {/* Critical booking rule */}
        <section className="bg-amber-50 border-b border-amber-200">
          <div className="container mx-auto max-w-4xl px-4 py-5 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-900 leading-relaxed">
              <strong>Online booking only.</strong> Do NOT text or call to reserve this service.
              You must book yourself online and sign the consent. Phone and text bookings will not
              be accepted for Everesse.
            </div>
          </div>
        </section>

        {/* July promo cards */}
        <section id="book" className="container mx-auto max-w-6xl px-4 py-14">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl md:text-4xl mb-2">July Promo Pricing</h2>
            <p className="text-muted-foreground">Only 10 spots total — choose your area below.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {PROMOS.map((p) => (
              <OfferCard key={p.id} offer={p} cta="Book this spot" />
            ))}
          </div>
        </section>

        {/* Packages */}
        <section className="bg-secondary/30 border-y border-border">
          <div className="container mx-auto max-w-6xl px-4 py-14">
            <div className="text-center mb-10">
              <h2 className="font-serif text-3xl md:text-4xl mb-2">Package Deals</h2>
              <p className="text-muted-foreground">
                Standard Volnewmer pricing — series sessions for compounding results.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {PACKAGES.map((p) => (
                <OfferCard key={p.id} offer={p} cta="Book package" />
              ))}
            </div>
          </div>
        </section>

        {/* What is it */}
        <section className="container mx-auto max-w-3xl px-4 py-14">
          <h2 className="font-serif text-3xl mb-4">What is Everesse?</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Everesse by Volnewmer is a next-generation monopolar radiofrequency device that
              delivers controlled deep heat to the dermis and subdermal tissue. The energy triggers
              immediate collagen contraction for visible lift, and stimulates new collagen and
              elastin production over the following 8–12 weeks for long-term tightening.
            </p>
            <p>
              Sessions take 30–60 minutes depending on the area. Most clients report a warm,
              comfortable sensation. There is no downtime — you can return to normal activity
              immediately. Results build gradually and continue improving for up to 3 months.
            </p>
            <p>
              Everesse is safe for all skin tones and types, including darker Fitzpatrick scores
              where many laser treatments are contraindicated.
            </p>
          </div>
        </section>

        <section className="container mx-auto max-w-3xl px-4 pb-20">
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <h3 className="font-serif text-2xl mb-2">Ready to book?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Online booking only — phone and text bookings will not be accepted for this service.
            </p>
            <Button asChild size="lg" className="rounded-full px-8">
              <a href="#book">Choose your area</a>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function OfferCard({ offer, cta }: { offer: Offer; cta: string }) {
  return (
    <div
      className={`rounded-2xl border p-6 bg-card flex flex-col ${
        offer.highlight ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
    >
      {offer.badge && (
        <div className="inline-flex self-start items-center rounded-full bg-primary/10 text-primary text-[11px] uppercase tracking-widest px-2.5 py-1 mb-3">
          {offer.badge}
        </div>
      )}
      <h3 className="font-serif text-2xl mb-1">{offer.name}</h3>
      <div className="text-3xl font-semibold mb-1">{offer.price}</div>
      {offer.per && <div className="text-xs text-muted-foreground mb-2">{offer.per}</div>}
      <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mb-3">
        <Clock className="h-3 w-3" />
        {offer.duration}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">{offer.blurb}</p>
      <Button asChild size="lg" className="rounded-full w-full">
        <Link to={bookHref(offer.id)}>{cta}</Link>
      </Button>
    </div>
  );
}
