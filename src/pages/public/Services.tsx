import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Search, X as XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { NurseDiscountBanner } from "@/components/NurseDiscountBanner";
import FinancingBadge from "@/components/FinancingBadge";
import { CANCELLATION_POLICY_LONG } from "@/lib/cancellationPolicy";
import { usePageMeta } from "@/hooks/usePageMeta";


interface Cat { id: string; name: string; description: string | null; display_order: number; }
interface Svc {
  id: string; category_id: string; name: string;
  description: string | null;
  duration_minutes: number; price_cents: number | null; price_note: string | null;
  promo_group: string | null;
}

const formatPrice = (s: Svc) => {
  if (s.price_cents == null) return "Inquire";
  if (s.price_cents === 0) return "Complimentary";
  const isWhole = s.price_cents % 100 === 0;
  return (s.price_cents / 100).toLocaleString("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  });
};

// Each concern maps to category IDs + keyword regexes that match service names/descriptions.
const CONCERN_FILTERS: { key: string; label: string; categoryIds?: string[]; keywords?: RegExp }[] = [
  { key: "wrinkles", label: "Wrinkles & lines", categoryIds: ["c1000000-0000-0000-0000-000000000001"], keywords: /botox|daxxify|xeomin|jeuveau|tox|wrinkle|line/i },
  { key: "volume", label: "Volume & lips", categoryIds: ["c1000000-0000-0000-0000-000000000002", "c1000000-0000-0000-0000-000000000003"], keywords: /filler|lip|cheek|jaw|sculptra|radiesse|biostim/i },
  { key: "skin", label: "Glow & skin tone", categoryIds: ["c1000000-0000-0000-0000-000000000004", "c1000000-0000-0000-0000-000000000010", "c1000000-0000-0000-0000-000000000011"], keywords: /peel|facial|glow|hydra|tone|pigment|melasma|brighten/i },
  { key: "acne", label: "Acne & scars", keywords: /acne|scar|breakout|blemish/i },
  { key: "tightening", label: "Lift & tighten", categoryIds: ["c1000000-0000-0000-0000-000000000005", "c1000000-0000-0000-0000-000000000006"], keywords: /tighten|lift|microneedling|rf|volnewmer|ultherapy|everesse/i },
  { key: "laser", label: "Lasers", categoryIds: ["c1000000-0000-0000-0000-000000000007"], keywords: /laser|ipl|pico|nd:yag|co2|resurfac/i },
  { key: "body", label: "Body & sculpt", categoryIds: ["c1000000-0000-0000-0000-000000000008"], keywords: /body|sculpt|contour|cellulite|tone/i },
  { key: "hair", label: "Hair removal", categoryIds: ["c1000000-0000-0000-0000-000000000009"], keywords: /hair removal|laser hair/i },
  { key: "weight", label: "Weight & wellness", categoryIds: ["c1000000-0000-0000-0000-000000000013", "c1000000-0000-0000-0000-000000000099"], keywords: /glp-?1|semaglutide|tirzepatide|weight|hrt|hormone|peptide|wellness/i },
  
];

function matchesConcern(s: Svc, c: Cat | undefined, concernKey: string | null): boolean {
  if (!concernKey) return true;
  const f = CONCERN_FILTERS.find(x => x.key === concernKey);
  if (!f) return true;
  if (f.categoryIds?.includes(s.category_id)) return true;
  const hay = `${s.name} ${s.description ?? ""} ${c?.name ?? ""}`;
  return !!f.keywords?.test(hay);
}

function matchesQuery(s: Svc, c: Cat | undefined, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  const hay = `${s.name} ${s.description ?? ""} ${c?.name ?? ""}`.toLowerCase();
  return hay.includes(needle);
}


const Services = () => {
  usePageMeta({
    title: "Medspa Services & Pricing — Radiantilyk Aesthetic",
    description: "Browse Botox, filler, lasers, microneedling, facials, and GLP-1 wellness with transparent pricing at Radiantilyk Aesthetic in San Jose.",
    canonical: "https://bookrka.com/services",
    ogType: "website",
  });

  const [cats, setCats] = useState<Cat[]>([]);
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [promoSlots, setPromoSlots] = useState<Record<string, string[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [concern, setConcern] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      supabase.from("service_categories").select("*").eq("is_active", true).order("display_order"),
      supabase.from("services").select("*").eq("is_active", true).order("display_order"),
      supabase.from("promo_slots").select("promo_group, slot_at, claimed_appointment_id").order("slot_at"),
    ]).then(([c, s, ps]) => {
      setCats(c.data ?? []);
      // Hide package/series SKUs from the public listing — they're duplicates of the
      // base service and cause conflicting price display. Packages are applied via
      // promos at checkout, not booked directly by the client.
      const rows = (s.data ?? []) as any[];
      setSvcs(rows.filter(r => !/\bpackage of\b/i.test(r.name ?? "")) as any);
      const byGroup: Record<string, string[]> = {};
      (ps.data ?? []).forEach((row: any) => {
        if (row.claimed_appointment_id) return;
        (byGroup[row.promo_group] ||= []).push(row.slot_at);
      });
      setPromoSlots(byGroup);
    });
  }, []);
  const fmtSlot = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });

  const everessePromos = svcs.filter(s => s.promo_group?.startsWith("everesse-"));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 sm:py-16 max-w-4xl">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-primary mb-3 sm:mb-4">Our Services</p>
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl mb-6 sm:mb-8">Tailored for you.</h1>

        <NurseDiscountBanner className="mb-6" />


        <div className="rounded-2xl border border-border bg-secondary/40 p-4 sm:p-5 mb-10 text-xs sm:text-sm leading-relaxed">
          <p>
            <span className="font-medium">Cancellation policy.</span> {CANCELLATION_POLICY_LONG}
          </p>
          <p className="mt-2 text-muted-foreground text-[11px] sm:text-xs">
            Some services are priced per unit or per syringe — your final investment is confirmed at your complimentary consultation.
            Flexible financing through Cherry and Affirm. Custom treatment packages available.
          </p>
        </div>

        <FinancingBadge className="mb-8" />

        {/* Inline search + concern filters */}
        <div className="mb-10 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services — botox, peel, laser hair, GLP-1…"
              className="w-full rounded-full border border-border bg-background pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Search services"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {CONCERN_FILTERS.map(c => {
              const active = concern === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setConcern(active ? null : c.key)}
                  className={`text-xs sm:text-[13px] px-3 py-1.5 rounded-full border transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                  aria-pressed={active}
                >
                  {c.label}
                </button>
              );
            })}
            {(concern || query) && (
              <button
                onClick={() => { setConcern(null); setQuery(""); }}
                className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Can't decide? <Link to="/quiz" className="text-primary hover:underline">Take the 1-minute treatment finder →</Link>
          </p>
        </div>

        {everessePromos.length > 0 && (
          <section className="mb-14 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-secondary/40 to-background p-6 sm:p-8 shadow-elegant">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.4em] text-primary">Limited Promotion</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">10 spots per service</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl mb-2">Volnewmer (Everesse) — Launch Special</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Korea's premier monopolar RF skin-tightening device. San Jose only · Launches July 18, 2026 ·
              Performed exclusively by Kiem & Kamaren. Each service has its own 10 reservations.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {everessePromos.map(s => {
                const slots = (s.promo_group && promoSlots[s.promo_group]) || [];
                const remaining = slots.length;
                return (
                  <div key={s.id} className="rounded-2xl border border-border bg-background/60 p-4 flex flex-col">
                    <div className="text-sm font-medium mb-1">{s.name.replace(/^Everesse Promo — /, "")}</div>
                    <div className="font-serif text-2xl text-primary">{formatPrice(s)}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{s.duration_minutes} min</div>
                    {s.price_note && (
                      <div className="text-[11px] text-muted-foreground mt-2 whitespace-pre-line">{s.price_note}</div>
                    )}
                    <div className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {remaining} of 10 spots open
                    </div>
                    {slots.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[11px] text-foreground/80 max-h-44 overflow-y-auto pr-1">
                        {slots.map((iso) => (
                          <li key={iso} className="leading-snug">• {fmtSlot(iso)} PT</li>
                        ))}
                      </ul>
                    )}
                    <Link to={`/book?service=${s.id}`} className="mt-3 text-xs text-primary hover:underline self-start">
                      Reserve your spot →
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {(() => {
          const visibleByCat = cats.map(c => ({
            cat: c,
            list: svcs.filter(s =>
              s.category_id === c.id &&
              !s.promo_group &&
              matchesConcern(s, c, concern) &&
              matchesQuery(s, c, query),
            ),
          })).filter(x => x.list.length > 0);
          const totalVisible = visibleByCat.reduce((n, x) => n + x.list.length, 0);
          if (totalVisible === 0) {
            return (
              <div className="rounded-2xl border border-border bg-secondary/30 p-8 text-center">
                <p className="text-sm text-muted-foreground mb-3">No services match those filters.</p>
                <button
                  onClick={() => { setConcern(null); setQuery(""); }}
                  className="text-sm text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            );
          }
          return (
        <div className="space-y-12">
          {visibleByCat.map(({ cat: c, list }) => {
            return (
              <section key={c.id}>
                <h2 className="font-serif text-3xl mb-2">{c.name}</h2>
                {c.description && <p className="text-muted-foreground text-sm mb-5">{c.description}</p>}
                <div className="grid sm:grid-cols-2 gap-x-8">
                  {list.map(s => {
                    const isOpen = openId === s.id;
                    const hasDesc = !!s.description;
                    return (
                      <div key={s.id} className="border-b border-border">
                        <button
                          type="button"
                          onClick={() => hasDesc && setOpenId(isOpen ? null : s.id)}
                          aria-expanded={isOpen}
                          className={`w-full flex items-start justify-between gap-4 py-3 text-left text-sm ${hasDesc ? "cursor-pointer hover:bg-secondary/30 -mx-2 px-2 rounded-md transition-colors" : "cursor-default"}`}
                        >
                          <div className="min-w-0 flex items-start gap-2">
                            {hasDesc && (
                              <ChevronDown
                                className={`h-4 w-4 mt-0.5 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                aria-hidden
                              />
                            )}
                            <div className="min-w-0">
                              <div>{s.name}</div>
                              {s.price_note && (
                                <div className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-line">{s.price_note}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <div className="font-medium">{formatPrice(s)}</div>
                            <div className="text-[10px] text-muted-foreground">{s.duration_minutes} min</div>
                          </div>
                        </button>
                        {isOpen && hasDesc && (
                          <div className="pb-4 pl-6 pr-2 text-xs sm:text-[13px] leading-relaxed text-muted-foreground">
                            {s.description}
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                              <Link to={`/services/${s.id}`} className="text-primary hover:underline text-xs">
                                Learn more →
                              </Link>
                              <Link to={`/book?service=${s.id}`} className="text-primary hover:underline text-xs">
                                Book this service →
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
          );
        })()}

        <div className="mt-16 text-center flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/book" className="inline-flex items-center rounded-full bg-primary px-8 py-3 text-primary-foreground shadow-elegant hover:opacity-90">
            Book Appointment
          </Link>
          <Link to="/book?service=a1000000-0000-0000-0000-000000000002" className="inline-flex items-center rounded-full border border-primary px-8 py-3 text-primary hover:bg-primary/10">
            Book Free Televisit Consultation
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Services;
