import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, ArrowRight, Loader2 } from "lucide-react";
import GoogleReviewBadge from "@/components/GoogleReviewBadge";
import FinancingBadge from "@/components/FinancingBadge";

interface Location {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  google_review_url: string | null;
  google_place_id: string | null;
  image_url: string | null;
  hero_image_url: string | null;
}

interface Provider {
  id: string;
  full_name: string;
  title: string;
  bio: string | null;
  credentials: string | null;
  photo_url: string | null;
}

const ALLOWED_SLUGS = ["san-jose"];

export default function LocationPage() {
  const { slug } = useParams();
  const [loc, setLoc] = useState<Location | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<{ name: string; description: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: l } = await supabase.from("locations").select("*").eq("slug", slug).maybeSingle();
      if (!l) { setLoading(false); return; }
      setLoc(l as Location);

      const { data: rows } = await supabase
        .from("service_providers")
        .select("staff_id, service_id, staff_profiles(id, full_name, title, bio, credentials, photo_url, is_active), services(name, description, is_active)")
        .eq("location_id", l.id);

      const staffMap = new Map<string, Provider>();
      const svcMap = new Map<string, { name: string; description: string | null }>();
      for (const p of rows ?? []) {
        const s = (p as any).staff_profiles;
        const v = (p as any).services;
        if (s?.is_active) {
          staffMap.set(p.staff_id, {
            id: s.id, full_name: s.full_name, title: s.title,
            bio: s.bio ?? null, credentials: s.credentials ?? null, photo_url: s.photo_url ?? null,
          });
        }
        if (v?.is_active) svcMap.set(p.service_id, { name: v.name, description: v.description });
      }
      setProviders(Array.from(staffMap.values()));
      setServices(Array.from(svcMap.values()).slice(0, 8));
      setLoading(false);
    })();
  }, [slug]);

  if (slug && !ALLOWED_SLUGS.includes(slug)) return <Navigate to="/" replace />;
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!loc) return <Navigate to="/" replace />;

  const fullAddress = `${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`;
  const mapsQ = encodeURIComponent(fullAddress);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapsQ}`;
  const embedUrl = `https://www.google.com/maps?q=${mapsQ}&output=embed`;
  const phoneE164 = loc.phone ? loc.phone.replace(/[^0-9+]/g, "") : "";
  const title = `Medspa in ${loc.city} | Radiantilyk Aesthetic`;
  const description = `Botox, fillers, lasers, and skincare at our ${loc.city} studio. ${fullAddress}. Book online — same-week appointments often available.`;
  const canonical = `https://bookrka.com/${loc.slug}`;

  const geoBySlug: Record<string, { lat: number; lng: number }> = {
    "san-jose": { lat: 37.2839, lng: -121.8800 },
  };

  const geo = geoBySlug[loc.slug];
  const openingHoursSpecification = [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Tuesday","Wednesday","Thursday","Friday"], opens: "10:00", closes: "18:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "10:00", closes: "16:00" },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["MedicalBusiness", "LocalBusiness"],
    "@id": canonical,
    name: `Radiantilyk Aesthetic — ${loc.city}`,
    image: loc.hero_image_url || loc.image_url || "https://bookrka.com/og-image.jpg",
    url: canonical,
    telephone: loc.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: loc.address,
      addressLocality: loc.city,
      addressRegion: loc.state,
      postalCode: loc.zip,
      addressCountry: "US",
    },
    ...(geo ? { geo: { "@type": "GeoCoordinates", latitude: geo.lat, longitude: geo.lng } } : {}),
    openingHoursSpecification,
    priceRange: "$$",
    medicalSpecialty: ["Dermatology"],
    areaServed: [loc.city, "Bay Area"],
    sameAs: loc.google_review_url ? [loc.google_review_url] : undefined,
  };

  useEffect(() => {
    document.title = title;
    let desc = document.head.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!desc) { desc = document.createElement("meta"); desc.name = "description"; document.head.appendChild(desc); }
    desc.content = description;
    let canon = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
    canon.href = canonical;
    let ld = document.head.querySelector('script[data-loc-jsonld]') as HTMLScriptElement | null;
    if (!ld) { ld = document.createElement("script"); ld.type = "application/ld+json"; ld.setAttribute("data-loc-jsonld", "1"); document.head.appendChild(ld); }
    ld.textContent = JSON.stringify(jsonLd);
  }, [title, description, canonical, JSON.stringify(jsonLd)]);

  const hero = loc.hero_image_url || loc.image_url;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="container mx-auto px-4 py-12 md:py-20 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">Radiantilyk Aesthetic · {loc.city}</p>
              <h1 className="font-serif text-4xl md:text-6xl leading-tight mb-5">Medspa in {loc.city}</h1>
              <p className="text-lg text-muted-foreground max-w-xl mb-5">
                Injectables, lasers, and clinical skincare in a calm, considered space.
                Personalized plans, no upsell, no pressure.
              </p>
              <div className="mb-6">
                <GoogleReviewBadge placeId={loc.google_place_id} fallbackUrl={loc.google_review_url} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to={`/book?location=${loc.id}`}>
                  <Button size="lg" className="rounded-full">Book at {loc.city} <ArrowRight className="h-4 w-4 ml-1.5" /></Button>
                </Link>
                {phoneE164 && (
                  <a href={`tel:${phoneE164}`}>
                    <Button variant="outline" size="lg" className="rounded-full"><Phone className="h-4 w-4 mr-1.5" />{loc.phone}</Button>
                  </a>
                )}
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border border-border bg-secondary/30 aspect-[4/3]">
              {hero ? (
                <img src={hero} alt={`${loc.name} studio interior`} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs uppercase tracking-widest text-muted-foreground/60 text-center px-6">
                  Studio photo coming soon
                </div>
              )}
            </div>
          </div>
        </section>

        {/* NAP + Map */}
        <section className="container mx-auto px-4 pb-16 max-w-5xl grid md:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-border bg-card p-8">
            <h2 className="font-serif text-2xl mb-6">Visit us</h2>
            <dl className="space-y-5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Address</dt>
                <dd className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>{loc.address}<br/>{loc.city}, {loc.state} {loc.zip}</div>
                </dd>
              </div>
              {loc.phone && (
                <div>
                  <dt className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Phone</dt>
                  <dd><a href={`tel:${phoneE164}`} className="hover:text-primary inline-flex items-center gap-2"><Phone className="h-4 w-4" />{loc.phone}</a></dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Hours</dt>
                <dd className="text-muted-foreground">By appointment — see availability when booking.</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 mt-6">
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="rounded-full">Get directions</Button>
              </a>
            </div>
            <FinancingBadge className="mt-6" />
          </div>
          <div className="rounded-2xl overflow-hidden border border-border bg-card min-h-[320px]">
            <iframe
              title={`Map of ${loc.name}`}
              src={embedUrl}
              loading="lazy"
              className="w-full h-full min-h-[320px]"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>

        {/* Providers with bios */}
        {providers.length > 0 && (
          <section className="container mx-auto px-4 pb-16 max-w-5xl">
            <h2 className="font-serif text-3xl mb-8">Your providers in {loc.city}</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {providers.map((p) => (
                <article key={p.id} className="rounded-2xl border border-border bg-card p-6 flex gap-5">
                  <div className="shrink-0 h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden bg-secondary/40 border border-border">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.full_name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center font-serif text-2xl text-primary/50">
                        {p.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif text-xl leading-tight">{p.full_name}</div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{p.title}</div>
                    {p.credentials && (
                      <div className="text-[11px] text-primary/90 font-mono mt-1">{p.credentials}</div>
                    )}
                    {p.bio && <p className="text-sm text-foreground/85 mt-3 leading-relaxed">{p.bio}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Services */}
        {services.length > 0 && (
          <section className="container mx-auto px-4 pb-16 max-w-5xl">
            <h2 className="font-serif text-3xl mb-8">Services at {loc.city}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((s, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5">
                  <div className="font-serif text-lg mb-1">{s.name}</div>
                  {s.description && <p className="text-sm text-muted-foreground line-clamp-3">{s.description}</p>}
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link to="/services" className="text-sm text-primary inline-flex items-center gap-1.5">All services <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="container mx-auto px-4 pb-24 max-w-3xl text-center">
          <h2 className="font-serif text-3xl mb-4">Ready when you are.</h2>
          <p className="text-muted-foreground mb-6">Pick a time that works — most clients book same week.</p>
          <Link to={`/book?location=${loc.id}`}>
            <Button size="lg" className="rounded-full">Book at {loc.city} <ArrowRight className="h-4 w-4 ml-1.5" /></Button>
          </Link>
          <div className="mt-6 text-sm">
            <Link to="/faq" className="text-primary hover:underline">Read FAQ →</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
