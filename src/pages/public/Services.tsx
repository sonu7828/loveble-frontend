import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Search, X as XIcon, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { NurseDiscountBanner } from "@/components/NurseDiscountBanner";
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
  const [openCatIds, setOpenCatIds] = useState<Record<string, boolean>>({});
  const [showPolicy, setShowPolicy] = useState(false);
  const [query, setQuery] = useState("");
  const [concern, setConcern] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("service_categories").select("*").eq("is_active", true).order("display_order"),
      supabase.from("services").select("*").eq("is_active", true).order("display_order"),
      supabase.from("promo_slots").select("promo_group, slot_at, claimed_appointment_id").order("slot_at"),
    ]).then(([c, s, ps]) => {
      setCats(c.data ?? []);
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

  const visibleByCat = useMemo(() => {
    return cats.map(c => ({
      cat: c,
      list: svcs.filter(s =>
        s.category_id === c.id &&
        !s.promo_group &&
        matchesConcern(s, c, concern) &&
        matchesQuery(s, c, query),
      ),
    })).filter(x => x.list.length > 0);
  }, [cats, svcs, concern, query]);

  const totalVisible = useMemo(() => {
    return visibleByCat.reduce((n, x) => n + x.list.length, 0);
  }, [visibleByCat]);

  const toggleAllCats = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    if (expand) {
      visibleByCat.forEach(x => { next[x.cat.id] = true; });
    }
    setOpenCatIds(next);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        {/* Compact Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">Our Services</span>
            <h1 className="font-serif text-2xl sm:text-3xl text-foreground font-normal">Tailored for you.</h1>
          </div>
          <NurseDiscountBanner className="sm:w-auto shrink-0 justify-start sm:justify-end" />
        </div>

        {/* Collapsible Policy & Financing Info Strip */}
        <div className="rounded-xl border-2 border-border bg-secondary/30 mb-5 text-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPolicy(!showPolicy)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-secondary/50 transition-colors font-medium text-foreground/85"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <span>Cancellation Policy & Financing (Cherry / Affirm)</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <span>{showPolicy ? "Hide details" : "View policy & financing"}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPolicy ? "rotate-180" : ""}`} />
            </div>
          </button>
          {showPolicy && (
            <div className="px-3.5 pb-3 pt-1.5 text-muted-foreground border-t border-border text-[11px] leading-relaxed space-y-2 bg-background/50">
              <p><span className="font-semibold text-foreground">Cancellation policy:</span> {CANCELLATION_POLICY_LONG}</p>
              <p>Flexible financing available through <a href="https://withcherry.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Cherry</a> and <a href="https://www.affirm.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Affirm</a> with soft credit check. Custom treatment packages confirmed during complimentary consultation.</p>
            </div>
          )}
        </div>

        {/* Compact Search & Concern Filters */}
        <div className="mb-6 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services — botox, peel, laser hair, GLP-1…"
              className="w-full rounded-full border border-border bg-background pl-9 pr-9 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Search services"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {CONCERN_FILTERS.map(c => {
              const active = concern === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setConcern(active ? null : c.key)}
                  className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-full border transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary font-medium"
                      : "bg-secondary/40 border-border text-foreground/80 hover:text-foreground hover:border-primary"
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
                className="text-[11px] px-2.5 py-1 text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Volnewmer Launch Special (Compact Banner) */}
        {everessePromos.length > 0 && (
          <section className="mb-6 rounded-2xl border-2 border-primary/50 bg-gradient-to-br from-primary/10 via-secondary/40 to-background p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[9px] uppercase tracking-[0.3em] text-primary font-semibold">Limited Promotion</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/40 font-medium">10 spots per service</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl mb-1">Volnewmer (Everesse) — Launch Special</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Korea's premier monopolar RF skin-tightening device. San Jose only · Launches July 18, 2026.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {everessePromos.map(s => {
                const slots = (s.promo_group && promoSlots[s.promo_group]) || [];
                const remaining = slots.length;
                return (
                  <div key={s.id} className="rounded-xl border border-border bg-background/70 p-3 flex flex-col">
                    <div className="text-xs font-medium mb-0.5">{s.name.replace(/^Everesse Promo — /, "")}</div>
                    <div className="font-serif text-xl text-primary">{formatPrice(s)}</div>
                    <div className="text-[10px] text-muted-foreground">{s.duration_minutes} min</div>
                    {s.price_note && (
                      <div className="text-[10px] text-muted-foreground mt-1 whitespace-pre-line line-clamp-2">{s.price_note}</div>
                    )}
                    <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {remaining} of 10 spots open
                    </div>
                    {slots.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-[10px] text-foreground/80 max-h-24 overflow-y-auto pr-1">
                        {slots.map((iso) => (
                          <li key={iso} className="leading-snug">• {fmtSlot(iso)} PT</li>
                        ))}
                      </ul>
                    )}
                    <Link to={`/book?service=${s.id}`} className="mt-2 text-xs text-primary hover:underline font-medium self-start">
                      Reserve →
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Category Accordion Header Info & Controls */}
        <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
          <span className="font-medium">{visibleByCat.length} Categories ({totalVisible} Services)</span>
          {!query && !concern && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAllCats(true)}
                className="hover:text-primary transition-colors text-[11px] underline-offset-2 hover:underline"
              >
                Expand All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => toggleAllCats(false)}
                className="hover:text-primary transition-colors text-[11px] underline-offset-2 hover:underline"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>

        {/* Service Categories list as Accordions */}
        {visibleByCat.length === 0 ? (
          <div className="rounded-2xl border border-border bg-secondary/30 p-6 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">No services match those filters.</p>
            <button
              onClick={() => { setConcern(null); setQuery(""); }}
              className="text-xs text-primary hover:underline font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleByCat.map(({ cat: c, list }) => {
              const isSearching = !!(query || concern);
              const isOpen = isSearching || !!openCatIds[c.id];
              return (
                <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs transition-all">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSearching) {
                        setOpenCatIds(prev => ({ ...prev, [c.id]: !prev[c.id] }));
                      }
                    }}
                    className="w-full flex items-center justify-between p-3 sm:p-3.5 text-left hover:bg-secondary/40 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-serif text-base sm:text-lg text-foreground font-medium">{c.name}</h2>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-sans font-medium">
                          {list.length} {list.length === 1 ? "service" : "services"}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-muted-foreground text-xs line-clamp-1 mt-0.5">{c.description}</p>
                      )}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-primary" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 sm:px-4 sm:pb-3.5 pt-1 border-t border-border bg-background/50">
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                        {list.map(s => {
                          const isSvcOpen = openId === s.id;
                          const hasDesc = !!s.description;
                          return (
                            <div key={s.id} className="border-b border-border/70 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                              <button
                                type="button"
                                onClick={() => hasDesc && setOpenId(isSvcOpen ? null : s.id)}
                                aria-expanded={isSvcOpen}
                                className={`w-full flex items-start justify-between gap-3 py-2 text-left text-xs sm:text-sm ${
                                  hasDesc ? "cursor-pointer hover:bg-secondary/30 -mx-1.5 px-1.5 rounded-md transition-colors" : "cursor-default"
                                }`}
                              >
                                <div className="min-w-0 flex items-start gap-1.5">
                                  {hasDesc && (
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0 transition-transform ${
                                        isSvcOpen ? "rotate-180" : ""
                                      }`}
                                      aria-hidden
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-medium text-foreground">{s.name}</div>
                                    {s.price_note && (
                                      <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-pre-line leading-tight">
                                        {s.price_note}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right whitespace-nowrap shrink-0">
                                  <div className="font-semibold text-primary">{formatPrice(s)}</div>
                                  <div className="text-[10px] text-muted-foreground">{s.duration_minutes} min</div>
                                </div>
                              </button>
                              {isSvcOpen && hasDesc && (
                                <div className="pb-2.5 pl-5 pr-1 text-xs leading-relaxed text-muted-foreground">
                                  {s.description}
                                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                    <Link to={`/services/${s.id}`} className="text-primary hover:underline text-[11px] font-medium">
                                      Learn details →
                                    </Link>
                                    <Link to={`/book?service=${s.id}`} className="text-primary hover:underline text-[11px] font-medium">
                                      Book this service →
                                    </Link>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom CTAs */}
        <div className="mt-8 text-center flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Link to="/book" className="inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-xs sm:text-sm font-medium text-primary-foreground shadow-elegant hover:opacity-90 transition-opacity">
            Book Appointment
          </Link>
          <Link to="/book?service=a1000000-0000-0000-0000-000000000002" className="inline-flex items-center rounded-full border border-primary px-6 py-2.5 text-xs sm:text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
            Book Free Consultation
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Services;

