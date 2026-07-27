import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Search, X as XIcon, Info, Sparkles, ArrowRight } from "lucide-react";
import { apiQuery } from "@/services/api";
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
  const [showPolicy, setShowPolicy] = useState(false);
  const [query, setQuery] = useState("");
  const [concern, setConcern] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiQuery("service_categories").select("*").eq("is_active", true).order("display_order"),
      apiQuery("services").select("*").eq("is_active", true).order("display_order"),
      apiQuery("promo_slots").select("promo_group, slot_at, claimed_appointment_id").order("slot_at"),
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      {/* Main Container — Middle 90% Width */}
      <main className="flex-1 w-[95%] xl:w-[90%] max-w-[1440px] mx-auto px-4 sm:px-6 pt-4 pb-16">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-border/60">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">Our Menu</span>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              Services & Transparent Pricing
            </h1>
          </div>
          <NurseDiscountBanner className="sm:w-auto shrink-0 justify-start sm:justify-end" />
        </div>

        {/* Collapsible Policy Strip */}
        <div className="rounded-xl border border-border bg-card shadow-2xs mb-5 text-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPolicy(!showPolicy)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/40 transition-colors font-medium text-foreground cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <span>Cancellation Policy & Flexible Financing (Cherry / Affirm)</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <span>{showPolicy ? "Hide details" : "View details"}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPolicy ? "rotate-180" : ""}`} />
            </div>
          </button>
          {showPolicy && (
            <div className="px-4 pb-3 pt-1 text-muted-foreground border-t border-border/60 text-[11px] leading-relaxed space-y-2 bg-background/50">
              <p><span className="font-semibold text-foreground">Cancellation policy:</span> {CANCELLATION_POLICY_LONG}</p>
              <p>Flexible financing available through <a href="https://withcherry.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">Cherry</a> and <a href="https://www.affirm.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">Affirm</a>. Custom treatment packages confirmed during consultation.</p>
            </div>
          )}
        </div>

        {/* Search Bar & Concern Filters */}
        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search treatments — botox, lip filler, laser hair, chemical peel..."
              className="w-full rounded-full border border-border/80 bg-card pl-10 pr-10 py-2.5 text-xs sm:text-sm shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              aria-label="Search services"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CONCERN_FILTERS.map(c => {
              const active = concern === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setConcern(active ? null : c.key)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition cursor-pointer font-medium ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                      : "bg-card border-border/80 text-foreground/80 hover:border-primary/50 hover:text-foreground"
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
                className="text-xs px-3 py-1 text-primary font-medium hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Everesse Volnewmer Special */}
        {everessePromos.length > 0 && (
          <section className="mb-8 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">Limited Launch Promo</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-semibold">San Jose Clinic</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold mb-1">Volnewmer (Everesse) — Launch Special</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              Korea's premier monopolar RF skin-tightening device.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {everessePromos.map(s => {
                const slots = (s.promo_group && promoSlots[s.promo_group]) || [];
                return (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-semibold mb-1">{s.name.replace(/^Everesse Promo — /, "")}</div>
                      <div className="font-serif text-xl font-bold text-primary">{formatPrice(s)}</div>
                      <div className="text-xs text-muted-foreground">{s.duration_minutes} min</div>
                      {s.price_note && (
                        <div className="text-xs text-muted-foreground mt-1.5">{s.price_note}</div>
                      )}
                    </div>
                    <Link
                      to={`/book?service=${s.id}`}
                      className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
                    >
                      Reserve Spot <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Dynamic Category & Service Cards Grid */}
        {visibleByCat.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center my-6">
            <Sparkles className="h-8 w-8 text-primary/60 mx-auto mb-2" />
            <h3 className="font-serif text-lg font-semibold text-foreground">No Matching Services</h3>
            <p className="text-xs text-muted-foreground mt-1">Try clearing your search filters to view all menu offerings.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {visibleByCat.map(({ cat, list }) => (
              <section key={cat.id} className="space-y-3">
                <div className="border-b border-border/60 pb-2 flex items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{cat.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-medium shrink-0">
                    {list.length} {list.length === 1 ? "treatment" : "treatments"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {list.map(s => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-border/80 bg-card p-4 hover:border-primary/40 hover:shadow-2xs transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-sm sm:text-base leading-snug text-foreground">{s.name}</h3>
                          <div className="font-bold text-sm text-primary shrink-0">{formatPrice(s)}</div>
                        </div>
                        {s.price_note && (
                          <div className="text-xs text-muted-foreground font-medium">{s.price_note}</div>
                        )}
                        {s.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">
                            {s.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground font-medium">
                          ⏱ {s.duration_minutes} min
                        </span>
                        <Link
                          to={`/book?service=${s.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          Book Now <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Services;
