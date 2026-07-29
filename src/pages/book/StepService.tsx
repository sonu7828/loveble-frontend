import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Check, Clock, ShieldCheck, Star, CreditCard, Calendar as CalIcon, ChevronDown, ChevronUp, Sparkles, AlertCircle } from "lucide-react";
import type { Category, Service, ProviderRow } from "./types";

const FAQS = [
  {
    id: "deposit",
    q: "Do I need to pay a deposit?",
    a: "No. We don't charge a booking deposit. We do require a card on file — it's only charged if you no-show or cancel with less than 48 hours notice ($200 fee), or for the service you receive.",
  },
  {
    id: "cancel",
    q: "Can I reschedule or cancel?",
    a: "Yes — anytime up to 48 hours before your appointment, free of charge. Just sign in to your account or use the link in your confirmation email.",
  },
  {
    id: "approval",
    q: "Is my appointment confirmed right away?",
    a: "You'll get instant confirmation that we received your request. Our team reviews and approves new bookings within a few hours during business hours, then you'll receive a final confirmation by email.",
  },
  {
    id: "first",
    q: "It's my first visit — what should I expect?",
    a: "We'll guide you through consents during checkout, and your provider will do a brief in-person consultation before any treatment to make sure the plan is right for you.",
  },
  {
    id: "locations",
    q: "Where are you located?",
    a: "Our studio is in San Jose at 2100 Curtner Ave, Ste 1B.",
  },
];

export const StepService = ({
  categories, services, providers, selected, onToggle, onContinue,
}: {
  categories: Category[]; services: Service[]; providers: ProviderRow[];
  selected: string[]; onToggle: (id: string) => void; onContinue: () => void;
}) => {
  const offeredServiceIds = new Set(providers.map(p => p.service_id));
  const cats = categories.filter(c =>
    services.some(s => s.category_id === c.id && (offeredServiceIds.size === 0 || offeredServiceIds.has(s.id)))
  );

  // If categories list is empty, fallback to showing all categories that have services
  const displayCats = cats.length > 0 ? cats : categories.filter(c => services.some(s => s.category_id === c.id));

  const initialOpen = selected.length
    ? (services.find(s => s.id === selected[selected.length - 1])?.category_id ?? null)
    : null;
  const [openCat, setOpenCat] = useState<string | null>(initialOpen ?? (displayCats.length === 1 ? displayCats[0].id : null));

  const selectedSvcs = selected
    .map(id => services.find(s => s.id === id))
    .filter(Boolean) as Service[];
  const totalMin = selectedSvcs.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalCents = selectedSvcs.reduce((sum, s) => sum + (s.price_cents ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Title & Subheader Section */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-border/40">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl text-foreground font-semibold tracking-tight">
            What would you like?
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add one or more services — book several in a single visit.
          </p>
        </div>

        <a
          href="/quiz"
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-semibold transition shrink-0"
        >
          <Sparkles className="h-3 w-3" /> Not sure? Take 60s quiz →
        </a>
      </div>

      {/* Trust & Policy Badges */}
      <div className="flex flex-wrap gap-2 text-xs font-medium pt-0.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-foreground text-[11px] shadow-2xs">
          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> 5.0 Google Reviews
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-foreground text-[11px] shadow-2xs">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Licensed MD/NP
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-foreground text-[11px] shadow-2xs">
          <CreditCard className="h-3.5 w-3.5 text-primary" /> No deposit required
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-foreground text-[11px] shadow-2xs">
          <CalIcon className="h-3.5 w-3.5 text-primary" /> Free 48h cancellation
        </span>
      </div>

      {/* Selected Visit Summary Pill Bar */}
      {selectedSvcs.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-2xs">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-primary mb-1.5 flex items-center justify-between">
            <span>Your Selected Visit</span>
            <span className="font-mono text-[11px]">
              {selectedSvcs.length} service{selectedSvcs.length > 1 ? "s" : ""} · {totalMin} min{totalCents > 0 ? ` · $${(totalCents / 100).toFixed(totalCents % 100 === 0 ? 0 : 2)}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedSvcs.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggle(s.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium px-3 py-1 hover:opacity-90 transition cursor-pointer"
                aria-label={`Remove ${s.name}`}
              >
                {s.name}
                <span aria-hidden className="text-sm font-bold leading-none">×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories & Services Grid OR Empty State */}
      {displayCats.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 p-8 text-center my-4 shadow-2xs">
          <AlertCircle className="h-8 w-8 text-primary/60 mx-auto mb-2" />
          <h3 className="font-serif text-base sm:text-lg font-semibold text-foreground">No Services Currently Available</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
            We are currently updating our service menu and live availability. Please check back shortly or contact our San Jose clinic directly at (408) 351-1873.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch pt-1">
          {displayCats.map(c => {
            const isOpen = openCat === c.id;
            const catServices = services.filter(s => s.category_id === c.id);
            const selCount = catServices.filter(s => selected.includes(s.id)).length;
            return (
              <div key={c.id} className={isOpen ? "col-span-full" : "h-full"}>
                <div
                  className={`w-full h-full rounded-xl border p-4 sm:p-5 transition-all duration-300 ${isOpen
                      ? "border-primary/60 bg-card shadow-sm ring-1 ring-primary/20"
                      : "border-border/80 bg-card hover:border-primary/40 hover:shadow-2xs"
                    }`}
                >
                  {/* Category Header Button */}
                  <button
                    type="button"
                    onClick={() => setOpenCat(isOpen ? null : c.id)}
                    className="w-full text-left flex items-start justify-between gap-3 group cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-base sm:text-lg font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                        {c.name}
                      </div>
                      {c.description && (
                        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {c.description}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full group-hover:bg-primary/20 transition">
                        {catServices.length} {catServices.length === 1 ? "service" : "services"}
                        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </span>
                      {selCount > 0 && (
                        <div className="text-[11px] font-semibold text-primary mt-1">
                          {selCount} selected
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded Services List */}
                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {catServices.map(s => {
                        const isSel = selected.includes(s.id);
                        const price = typeof s.price_cents === "number"
                          ? (s.price_cents === 0
                            ? "Complimentary"
                            : `$${(s.price_cents / 100).toFixed(s.price_cents % 100 === 0 ? 0 : 2)}`)
                          : null;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggle(s.id);
                            }}
                            className={`w-full text-left rounded-lg border p-3.5 transition-all duration-200 cursor-pointer flex items-start gap-3 ${isSel
                                ? "border-primary bg-primary text-primary-foreground shadow-2xs scale-[1.005]"
                                : "border-border/80 bg-background hover:border-primary/40 hover:bg-accent/40"
                              }`}
                          >
                            <span
                              className={`mt-0.5 h-4.5 w-4.5 shrink-0 rounded border flex items-center justify-center transition-colors ${isSel
                                  ? "bg-primary-foreground border-primary-foreground text-primary font-bold"
                                  : "border-muted-foreground/40 bg-background"
                                }`}
                            >
                              {isSel && <Check className="h-3 w-3" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs sm:text-sm leading-snug">{s.name}</div>
                              {price && (
                                <div className="text-base font-bold mt-1 leading-none">{price}</div>
                              )}
                              {s.price_note && (
                                <div className={`text-[11px] mt-0.5 font-medium ${isSel ? "opacity-90" : "text-muted-foreground"}`}>
                                  {s.price_note}
                                </div>
                              )}
                              {s.description && (
                                <div className={`text-[11px] mt-1 line-clamp-2 leading-relaxed ${isSel ? "opacity-90" : "text-muted-foreground"}`}>
                                  {s.description}
                                </div>
                              )}
                              <div className={`text-[11px] mt-2 inline-flex items-center gap-1 font-medium ${isSel ? "opacity-85" : "text-muted-foreground"}`}>
                                <Clock className="h-3 w-3" />{s.duration_minutes} min
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Common Questions — 2-Column Grid with Larger Font Size */}
      <div className="mt-8 pt-4 border-t border-border/50">
        <h2 className="font-serif text-xl sm:text-2xl font-semibold text-foreground mb-4">
          Common questions
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {FAQS.map(faq => (
            <Accordion key={faq.id} type="single" collapsible className="rounded-xl border border-border/80 bg-card shadow-2xs">
              <AccordionItem value={faq.id} className="border-0 px-4 py-0.5">
                <AccordionTrigger className="text-base sm:text-lg font-medium text-foreground py-3 text-left leading-snug hover:text-primary transition-colors">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1 pb-3">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ))}
        </div>
      </div>

      {/* Floating Bottom Sticky Action Bar — 90% Width Aligned */}
      {selected.length > 0 && (
        <>
          <div className="h-24" aria-hidden />
          <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border/80 p-3.5 z-40 shadow-lg">
            <div className="w-[95%] xl:w-[90%] max-w-[1440px] mx-auto flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">Selected Summary</div>
                <div className="text-xs sm:text-sm font-bold text-foreground">
                  {selected.length} service{selected.length > 1 ? "s" : ""} · {totalMin} min · ${(totalCents / 100).toFixed(0)}
                </div>
              </div>
              <Button onClick={onContinue} size="default" className="rounded-full px-6 font-semibold shadow-xs">
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
