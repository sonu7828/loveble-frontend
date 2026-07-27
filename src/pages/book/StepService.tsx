import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Check, Clock, ShieldCheck, Star, CreditCard, Calendar as CalIcon, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { Category, Service, ProviderRow } from "./types";

export const StepService = ({
  categories, services, providers, selected, onToggle, onContinue,
}: {
  categories: Category[]; services: Service[]; providers: ProviderRow[];
  selected: string[]; onToggle: (id: string) => void; onContinue: () => void;
}) => {
  const offeredServiceIds = new Set(providers.map(p => p.service_id));
  const cats = categories.filter(c =>
    services.some(s => s.category_id === c.id && offeredServiceIds.has(s.id))
  );
  const initialOpen = selected.length
    ? (services.find(s => s.id === selected[selected.length - 1])?.category_id ?? null)
    : null;
  const [openCat, setOpenCat] = useState<string | null>(initialOpen ?? (cats.length === 1 ? cats[0].id : null));

  const selectedSvcs = selected
    .map(id => services.find(s => s.id === id))
    .filter(Boolean) as Service[];
  const totalMin = selectedSvcs.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalCents = selectedSvcs.reduce((sum, s) => sum + (s.price_cents ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Title & Subheader Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-foreground font-semibold tracking-tight">
            What would you like?
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Add one or more services — book several in a single visit.
          </p>
        </div>

        <a
          href="/quiz"
          className="inline-flex items-center gap-1.5 self-start md:self-auto px-4 py-2 rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition"
        >
          <Sparkles className="h-3.5 w-3.5" /> Not sure? Take 60s quiz →
        </a>
      </div>

      {/* Trust & Policy Badges */}
      <div className="flex flex-wrap gap-2.5 text-xs font-medium">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-foreground shadow-2xs">
          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> 5.0 Google Reviews
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-foreground shadow-2xs">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Licensed MD/NP
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-foreground shadow-2xs">
          <CreditCard className="h-3.5 w-3.5 text-primary" /> No deposit required
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-foreground shadow-2xs">
          <CalIcon className="h-3.5 w-3.5 text-primary" /> Free 48h cancellation
        </span>
      </div>

      {/* Selected Visit Summary Pill Bar */}
      {selectedSvcs.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-xs">
          <div className="text-xs uppercase tracking-wider font-semibold text-primary mb-2 flex items-center justify-between">
            <span>Your Selected Visit</span>
            <span className="font-mono text-xs">
              {selectedSvcs.length} service{selectedSvcs.length > 1 ? "s" : ""} · {totalMin} min{totalCents > 0 ? ` · $${(totalCents / 100).toFixed(totalCents % 100 === 0 ? 0 : 2)}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedSvcs.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggle(s.id)}
                className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-xs font-medium px-3.5 py-1.5 hover:opacity-90 transition cursor-pointer"
                aria-label={`Remove ${s.name}`}
              >
                {s.name}
                <span aria-hidden className="text-sm font-bold leading-none">×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
        {cats.map(c => {
          const isOpen = openCat === c.id;
          const catServices = services.filter(s => s.category_id === c.id && offeredServiceIds.has(s.id));
          const selCount = catServices.filter(s => selected.includes(s.id)).length;
          return (
            <div key={c.id} className={isOpen ? "col-span-full" : "h-full"}>
              <div
                className={`w-full h-full rounded-2xl border p-5 sm:p-6 transition-all duration-300 ${
                  isOpen
                    ? "border-primary/60 bg-card shadow-md ring-1 ring-primary/20"
                    : "border-border/80 bg-card hover:border-primary/40 hover:shadow-xs"
                }`}
              >
                {/* Category Header Button */}
                <button
                  type="button"
                  onClick={() => setOpenCat(isOpen ? null : c.id)}
                  className="w-full text-left flex items-start justify-between gap-4 group cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg sm:text-xl font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                      {c.name}
                    </div>
                    {c.description && (
                      <div className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {c.description}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-3 py-1.5 rounded-full group-hover:bg-primary/20 transition">
                      {catServices.length} {catServices.length === 1 ? "service" : "services"}
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </span>
                    {selCount > 0 && (
                      <div className="text-xs font-semibold text-primary mt-1.5">
                        {selCount} selected
                      </div>
                    )}
                  </div>
                </button>

                {/* Expanded Services List */}
                {isOpen && (
                  <div className="mt-6 pt-5 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                          className={`w-full text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer flex items-start gap-3.5 ${
                            isSel
                              ? "border-primary bg-primary text-primary-foreground shadow-sm scale-[1.01]"
                              : "border-border/80 bg-background hover:border-primary/40 hover:bg-accent/40"
                          }`}
                        >
                          <span
                            className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                              isSel
                                ? "bg-primary-foreground border-primary-foreground text-primary font-bold"
                                : "border-muted-foreground/40 bg-background"
                            }`}
                          >
                            {isSel && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="font-semibold text-xs sm:text-sm leading-snug">{s.name}</div>
                              {price && (
                                <div className="text-xs sm:text-sm font-bold shrink-0">{price}</div>
                              )}
                            </div>
                            {s.price_note && (
                              <div className={`text-xs mt-1 font-medium ${isSel ? "opacity-90" : "text-muted-foreground"}`}>
                                {s.price_note}
                              </div>
                            )}
                            {s.description && (
                              <div className={`text-xs mt-1.5 line-clamp-2 leading-relaxed ${isSel ? "opacity-90" : "text-muted-foreground"}`}>
                                {s.description}
                              </div>
                            )}
                            <div className={`text-xs mt-2.5 inline-flex items-center gap-1 font-medium ${isSel ? "opacity-85" : "text-muted-foreground"}`}>
                              <Clock className="h-3.5 w-3.5" />{s.duration_minutes} min
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

      {/* Common Questions Accordion */}
      <div className="mt-12">
        <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card shadow-xs">
          <AccordionItem value="faq" className="border-0 px-6 py-1">
            <AccordionTrigger className="text-base font-serif font-semibold text-foreground">Common questions</AccordionTrigger>
            <AccordionContent>
              <Accordion type="single" collapsible className="divide-y divide-border border-t border-border -mx-6 pt-2">
                <AccordionItem value="deposit" className="border-0 px-6 py-2">
                  <AccordionTrigger className="text-sm font-medium">Do I need to pay a deposit?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    No. We don't charge a booking deposit. We do require a card on file — it's only charged if you no-show or cancel with less than 48 hours notice ($200 fee), or for the service you receive.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cancel" className="border-0 px-6 py-2">
                  <AccordionTrigger className="text-sm font-medium">Can I reschedule or cancel?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    Yes — anytime up to 48 hours before your appointment, free of charge. Just sign in to your account or use the link in your confirmation email.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="approval" className="border-0 px-6 py-2">
                  <AccordionTrigger className="text-sm font-medium">Is my appointment confirmed right away?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    You'll get instant confirmation that we received your request. Our team reviews and approves new bookings within a few hours during business hours, then you'll receive a final confirmation by email.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="first" className="border-0 px-6 py-2">
                  <AccordionTrigger className="text-sm font-medium">It's my first visit — what should I expect?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    We'll guide you through consents during checkout, and your provider will do a brief in-person consultation before any treatment to make sure the plan is right for you.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="locations" className="border-0 px-6 py-2">
                  <AccordionTrigger className="text-sm font-medium">Where are you located?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    Our studio is in San Jose at 2100 Curtner Ave, Ste 1B.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Floating Bottom Sticky Action Bar — 90% Width Aligned */}
      {selected.length > 0 && (
        <>
          <div className="h-28" aria-hidden />
          <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t border-border/80 p-4 z-40 shadow-lg">
            <div className="w-[95%] xl:w-[90%] max-w-[1440px] mx-auto flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground font-medium">Selected Summary</div>
                <div className="text-sm font-bold text-foreground">
                  {selected.length} service{selected.length > 1 ? "s" : ""} · {totalMin} min · ${ (totalCents / 100).toFixed(0) }
                </div>
              </div>
              <Button onClick={onContinue} size="lg" className="rounded-full px-8 font-semibold shadow-md">
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
