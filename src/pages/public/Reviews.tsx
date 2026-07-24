import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { format } from "date-fns";

type Testimonial = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  first_name: string | null;
  service_name: string | null;
  location_city: string | null;
  location_slug: string | null;
  provider_first_name: string | null;
};

const Reviews = () => {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Client Reviews | Radiantilyk Aesthetic — San Jose";
    const meta = document.querySelector('meta[name="description"]') ||
      Object.assign(document.createElement("meta"), { name: "description" });
    meta.setAttribute("content", "Real reviews from Radiantilyk Aesthetic clients at our San Jose medspa studio.");

    if (!meta.parentElement) document.head.appendChild(meta);

    (async () => {
      const { data } = await supabase
        .from("public_testimonials" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      setItems(((data ?? []) as unknown) as Testimonial[]);
      setLoading(false);
    })();
  }, []);

  const avg = items.length
    ? (items.reduce((a, t) => a + t.rating, 0) / items.length).toFixed(1)
    : null;

  // JSON-LD
  useEffect(() => {
    if (!items.length) return;
    const ld = {
      "@context": "https://schema.org",
      "@type": "MedicalBusiness",
      name: "Radiantilyk Aesthetic",
      aggregateRating: avg ? {
        "@type": "AggregateRating",
        ratingValue: avg,
        reviewCount: items.length,
      } : undefined,
      review: items.slice(0, 20).map((t) => ({
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: t.rating, bestRating: 5 },
        author: { "@type": "Person", name: t.first_name || "Verified guest" },
        reviewBody: t.comment,
        datePublished: t.created_at,
      })),
    };
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.text = JSON.stringify(ld);
    document.head.appendChild(tag);
    return () => { tag.remove(); };
  }, [items, avg]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12 sm:py-20 max-w-5xl">
        <header className="text-center mb-12">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">In their words</p>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">Reviews from our guests</h1>
          {avg && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${Number(avg) >= n - 0.25 ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                ))}
              </div>
              <span className="text-sm font-medium">{avg}</span>
              <span className="text-xs text-muted-foreground">· {items.length} verified review{items.length === 1 ? "" : "s"}</span>
            </div>
          )}
        </header>

        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">Reviews coming soon.</p>
            <Link to="/book" className="inline-block mt-6 rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground hover:opacity-90 transition">
              Book your visit
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {items.map((t) => (
                <article key={t.id} className="rounded-2xl border border-border bg-card p-6 flex flex-col">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${t.rating >= n ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <p className="text-foreground/90 leading-relaxed flex-1">"{t.comment}"</p>
                  <footer className="mt-5 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
                    <div className="font-medium text-foreground/80">
                      {t.first_name || "Verified guest"}
                      <span className="text-muted-foreground"> · {format(new Date(t.created_at), "MMM yyyy")}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {t.service_name && <span>{t.service_name}</span>}
                      {t.provider_first_name && <span>· with {t.provider_first_name}</span>}
                      {t.location_city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {t.location_city}
                        </span>
                      )}
                    </div>
                  </footer>
                </article>
              ))}
            </div>

            <div className="text-center mt-14 space-y-3">
              <p className="text-sm text-muted-foreground">Ready to experience it yourself?</p>
              <Link to="/book" className="inline-block rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground hover:opacity-90 transition shadow-soft">
                Book your visit
              </Link>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default Reviews;
