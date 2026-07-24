import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ArrowLeft, Clock, Sparkles, Calendar, Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MarkdownLite } from "@/components/BookingExtras";
import { usePageMeta } from "@/hooks/usePageMeta";
import FinancingBadge from "@/components/FinancingBadge";

interface Service {
  id: string; name: string; description: string | null;
  duration_minutes: number; price_cents: number | null; price_note: string | null;
  image_url: string | null; category_id: string;
}
interface PrePost { title: string; body_markdown: string }

const formatPrice = (s: Service) => {
  if (s.price_cents == null) return "Inquire";
  if (s.price_cents === 0) return "Complimentary";
  const whole = s.price_cents % 100 === 0;
  return (s.price_cents / 100).toLocaleString("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2,
  });
};

export default function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [pre, setPre] = useState<PrePost | null>(null);
  const [post, setPost] = useState<PrePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase
        .from("services")
        .select("id, name, description, duration_minutes, price_cents, price_note, image_url, category_id")
        .eq("id", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!s) { setNotFound(true); setLoading(false); return; }
      setService(s as Service);
      const [{ data: p }, { data: po }] = await Promise.all([
        supabase.from("service_pre_op_instructions").select("title, body_markdown").eq("service_id", s.id).maybeSingle(),
        supabase.from("service_post_op_instructions").select("title, body_markdown").eq("service_id", s.id).maybeSingle(),
      ]);
      setPre(p?.body_markdown ? (p as PrePost) : null);
      setPost(po?.body_markdown ? (po as PrePost) : null);
      setLoading(false);
    })();
  }, [slug]);

  usePageMeta({
    title: service ? `${service.name} — Radiantilyk Aesthetic` : "Service — Radiantilyk Aesthetic",
    description: service?.description
      ? service.description.slice(0, 155)
      : "Bespoke medical aesthetic treatments in San Jose.",
    canonical: service ? `https://bookrka.com/services/${service.id}` : undefined,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></main>
        <SiteFooter />
      </div>
    );
  }
  if (notFound || !service) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Service not found.</p>
          <Link to="/services" className="text-primary text-sm mt-4 inline-block">← Back to all services</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <Link to="/services" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-6">
          <ArrowLeft className="h-3 w-3" /> All services
        </Link>

        <header className="mb-8">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-primary mb-3">Treatment</p>
          <h1 className="font-serif text-4xl sm:text-5xl mb-4">{service.name}</h1>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-serif text-2xl text-primary">{formatPrice(service)}</span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />{service.duration_minutes} min
            </span>
          </div>
          {service.price_note && (
            <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">{service.price_note}</p>
          )}
          <FinancingBadge className="mt-5" />
        </header>

        {service.image_url && (
          <img src={service.image_url} alt={service.name}
            className="w-full aspect-[16/9] object-cover rounded-2xl mb-8" loading="lazy" />
        )}

        {service.description && (
          <section className="mb-10">
            <h2 className="font-serif text-2xl mb-3">About this treatment</h2>
            <p className="text-sm sm:text-base leading-relaxed text-foreground/85 whitespace-pre-line">
              {service.description}
            </p>
          </section>
        )}

        <section className="mb-10 rounded-2xl border border-border bg-secondary/30 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-xl">What to expect</h2>
          </div>
          <ul className="text-sm space-y-2 text-foreground/85">
            <li>• A short consult to confirm goals and answer questions.</li>
            <li>• Treatment time around {service.duration_minutes} minutes, plus a few extra to settle in.</li>
            <li>• Clear aftercare guidance — and we're a text away if anything comes up.</li>
          </ul>
        </section>

        {pre && (
          <section className="mb-10">
            <h2 className="font-serif text-2xl mb-3">Before your visit</h2>
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <MarkdownLite text={pre.body_markdown} />
            </div>
          </section>
        )}

        {post && (
          <section className="mb-10">
            <h2 className="font-serif text-2xl mb-3">After your visit</h2>
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <MarkdownLite text={post.body_markdown} />
            </div>
          </section>
        )}

        <section className="mb-12">
          <h2 className="font-serif text-2xl mb-3">Common questions</h2>
          <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-4">
            <AccordionItem value="q1">
              <AccordionTrigger className="text-sm">How soon will I see results?</AccordionTrigger>
              <AccordionContent className="text-sm text-foreground/80">
                It varies by treatment. We'll set expectations at your consult so you know exactly when to look for results and what's normal along the way.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger className="text-sm">Is there downtime?</AccordionTrigger>
              <AccordionContent className="text-sm text-foreground/80">
                Most treatments have little to no downtime. Specifics for this service are in the "After your visit" section above.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger className="text-sm">What is your cancellation policy?</AccordionTrigger>
              <AccordionContent className="text-sm text-foreground/80">
                We require 48 hours notice to reschedule or cancel. A $200 fee applies to no-shows or late cancellations, charged to the card on file.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger className="text-sm">Do you offer financing?</AccordionTrigger>
              <AccordionContent className="text-sm text-foreground/80">
                Yes — flexible financing through Cherry and Affirm. Memberships and custom packages are also available.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <div className="sticky bottom-4 sm:static rounded-2xl bg-card sm:bg-transparent border sm:border-0 border-border p-3 sm:p-0 shadow-elegant sm:shadow-none">
          <Link
            to={`/book?service=${service.id}`}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-primary-foreground shadow-elegant hover:opacity-90"
          >
            <Calendar className="h-4 w-4 mr-2" /> Book {service.name}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
