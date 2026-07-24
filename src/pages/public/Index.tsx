import { Link } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, ShieldCheck, Syringe, Zap, Droplet, HeartPulse, Star, ArrowRight } from "lucide-react";
import { usePreferredLocation } from "@/hooks/usePreferredLocation";
import { useEffect, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";

import { supabase } from "@/integrations/supabase/client";
import drFobiImg from "@/assets/dr-fobi.jpg";
import heroLeftImg from "@/assets/hero-left.png";
import heroRightImg from "@/assets/hero-right.png";

const WHAT_WE_DO = [
  { icon: Syringe, title: "Injectables", desc: "Botox, filler, lip enhancement", href: "/services#injectables" },
  { icon: Zap, title: "Lasers & Energy", desc: "Hair removal, IPL, resurfacing", href: "/services#lasers" },
  { icon: Droplet, title: "Skin & Facials", desc: "Peels, microneedling, glow", href: "/services#skin" },
  { icon: HeartPulse, title: "Medical Wellness", desc: "IV drip, IM, HRT, peptides", href: "/services#wellness" },
];

const FALLBACK_REVIEWS = [
  { quote: "Kien is the most awesome provider! Love her!", author: "Ann", location: "San Jose" },
  { quote: "I have never loved my skin as much as I do since Kien started taking care of it. Thanks to Kien's expertise and care, my skin has never looked better. I constantly receive compliments on how beautiful and healthy it looks, and I owe that to Kien. I highly recommend Kien to anyone looking for exceptional skincare treatments and results!", author: "Jenny", location: "San Jose" },
  { quote: "I had a great experience. Kien was very personable, professional, and kind through every step, and checked in throughout my procedure. I received great results.", author: "Cheri", location: "San Jose" },
];

type LiveReview = { id: string; quote: string; author: string; location: string };

const Index = () => {
  usePageMeta({
    title: "Radiantilyk Aesthetic — Medspa in San Jose",
    description: "Botox, filler, lasers, facials, GLP-1 wellness at our San Jose medspa. Book online with Radiantilyk Aesthetic.",
    canonical: "https://bookrka.com/",
    ogType: "website",
  });

  const { location } = usePreferredLocation();
  const bookHref = `/book?location=${location.id}`;
  const [placeIds, setPlaceIds] = useState<{ sj: string | null; sjUrl: string | null }>(
    { sj: null, sjUrl: null },
  );
  const [liveReviews, setLiveReviews] = useState<LiveReview[] | null>(null);
  const [rotationOffset, setRotationOffset] = useState(0);

  useEffect(() => {
    supabase.from("locations").select("slug, google_place_id, google_review_url").eq("slug", "san-jose")
      .then(({ data }) => {
        const sj = (data ?? []).find((r: any) => r.slug === "san-jose");
        setPlaceIds({
          sj: sj?.google_place_id ?? null,
          sjUrl: sj?.google_review_url ?? null,
        });
      });

    supabase
      .from("public_testimonials" as any)
      .select("id, comment, first_name, location_city, rating")
      .eq("rating", 5)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setLiveReviews(
          (data as any[]).map((t) => ({
            id: t.id,
            quote: t.comment,
            author: t.first_name || "Verified guest",
            location: t.location_city || "San Jose",
          })),
        );
      });
  }, []);

  const reviewPool = liveReviews ?? FALLBACK_REVIEWS.map((r, i) => ({ id: `fb-${i}`, ...r }));

  useEffect(() => {
    if (reviewPool.length <= 3) return;
    const t = setInterval(() => {
      setRotationOffset((o) => (o + 3) % reviewPool.length);
    }, 7000);
    return () => clearInterval(t);
  }, [reviewPool.length]);

  const reviewsToShow = reviewPool.length <= 3
    ? reviewPool
    : Array.from({ length: 3 }, (_, i) => reviewPool[(rotationOffset + i) % reviewPool.length]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 font-sans antialiased">
      <SiteHeader />

      {/* Hero Section — 3-Panel Side-by-Side Composition */}
      <section className="relative w-full bg-secondary/40 dark:bg-background border-b border-border overflow-hidden transition-colors duration-300">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 min-h-[580px] lg:min-h-[680px]">

          {/* Left Image Panel — Archway & Olive Tree */}
          <div className="hidden lg:block lg:col-span-4 relative overflow-hidden">
            <img
              src={heroLeftImg}
              alt="Radiantilyk Aesthetic Medspa Lounge and Archway"
              className="absolute -top-2 left-0 w-full h-[calc(100%+12px)] object-cover scale-[1.03] origin-bottom dark:opacity-80 transition-opacity"
            />
          </div>

          {/* Center Card Panel — A quiet ritual of refinement */}
          <div className="col-span-1 lg:col-span-4 flex items-center justify-center p-6 sm:p-10 bg-background lg:bg-secondary/40 dark:lg:bg-background">
            <div className="w-full max-w-[460px] bg-card/95 dark:bg-card/90 text-card-foreground rounded-xl p-8 sm:p-12 shadow-xl border border-border text-center flex flex-col items-center justify-between min-h-[480px]">
              {/* Header */}
              <div className="w-full flex flex-col items-center">
                <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] text-primary uppercase">
                  RADIANTILYK AESTHETIC
                </span>
                <div className="w-px h-8 bg-primary/30 my-3" />
              </div>

              {/* Headline */}
              <div className="my-4">
                <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-card-foreground font-medium leading-[1.08] tracking-tight">
                  A quiet<br />
                  <span className="italic font-serif text-primary font-normal">ritual</span><br />
                  of refinement.
                </h1>
              </div>

              {/* CTA Button */}
              <div className="w-full mt-6">
                <Button
                  asChild
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 h-auto text-xs font-medium tracking-[0.2em] uppercase rounded-lg shadow-md transition-all active:scale-[0.98]"
                >
                  <Link to={bookHref}>BOOK AN APPOINTMENT</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Right Image Panel — Reception & Logo Sign */}
          <div className="hidden lg:block lg:col-span-4 relative overflow-hidden">
            <img
              src={heroRightImg}
              alt="Radiantilyk Aesthetic Medspa Reception Desk"
              className="absolute -top-2 left-0 w-full h-[calc(100%+12px)] object-cover scale-[1.03] origin-bottom dark:opacity-80 transition-opacity"
            />
          </div>

        </div>
      </section>

      {/* What We Do Section */}
      <section className="border-t border-border bg-background py-20 px-6 sm:px-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
                WHAT WE DO
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground font-medium">
                Treatments, simply.
              </h2>
            </div>
            <Link
              to="/services"
              className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1.5 transition"
            >
              See full menu & pricing <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {WHAT_WE_DO.map(({ icon: Icon, title, desc, href }) => (
              <Link
                key={title}
                to={href}
                className="group rounded-xl border border-border bg-card text-card-foreground p-6 hover:border-primary/60 hover:shadow-md transition text-center flex flex-col items-center justify-between"
              >
                <div className="w-full flex flex-col items-center">
                  <div className="p-3 rounded-full bg-primary/10 text-primary mb-4 group-hover:scale-105 transition">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-serif text-xl font-medium text-card-foreground mb-2">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed font-light">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Our Philosophy Section */}
      <section className="border-t border-border bg-secondary/30 dark:bg-card/30 py-20 px-6 sm:px-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl mb-12">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
              OUR PHILOSOPHY
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground font-medium">
              Beauty, considered.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: ShieldCheck,
                title: "Medical Expertise",
                desc: "Led by board-certified professionals with years of medical experience."
              },
              {
                icon: Sparkles,
                title: "Advanced Technology",
                desc: "Premium devices and clinically proven treatments for natural, lasting results."
              },
              {
                icon: Calendar,
                title: "Effortless Booking",
                desc: "Modern, seamless experience so you can focus on what matters most—you."
              }
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card text-card-foreground border border-border rounded-xl p-8 flex flex-col items-start shadow-xs">
                <div className="p-3 rounded-full bg-primary/10 text-primary mb-5">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-2xl text-card-foreground font-medium mb-3">{title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-light">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Medical Director Section */}
      <section className="border-t border-border bg-background py-20 px-6 sm:px-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="md:col-span-7">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
              MEDICAL DIRECTOR
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground font-medium mb-6 leading-tight">
              Dr. Aloysius N. Fobi, <br className="hidden sm:inline" />
              <span className="italic font-normal text-2xl sm:text-3xl lg:text-4xl text-primary">MD, F.A.C.E.P., A.B.E.M.</span>
            </h2>

            <div className="space-y-4 text-xs sm:text-sm text-muted-foreground leading-relaxed font-light">
              <p>
                Our Medical Director, Dr. Aloysius N. Fobi, MD, F.A.C.E.P., A.B.E.M., ensures the highest
                standard of care—bringing expertise and leadership in aesthetic medicine to every treatment.
              </p>
              <p>
                Dr. Fobi is a board-certified medical doctor with over two decades of experience in medicine.
                His extensive background in emergency medicine and aesthetic procedures allows him to provide
                advanced, safe, and effective treatments.
              </p>
              <p>
                In addition to his medical expertise, Dr. Fobi has specialized training in aesthetic medicine.
              </p>
            </div>
          </div>

          <div className="md:col-span-5">
            <div className="relative aspect-[4/5] max-w-sm mx-auto md:ml-auto rounded-2xl overflow-hidden shadow-lg border border-border bg-card">
              <img
                src={drFobiImg}
                alt="Dr. Aloysius N. Fobi, MD — Medical Director"
                className="absolute inset-0 w-full h-full object-cover object-top"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* From Our Clients Section */}
      <section className="border-t border-border bg-secondary/30 dark:bg-card/30 py-20 px-6 sm:px-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
            FROM OUR CLIENTS
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground font-medium mb-3">
            In their words.
          </h2>

          {/* Rating Badge */}
          <div className="flex items-center justify-center gap-2 mb-10">
            <div className="flex text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
              ))}
            </div>
            <span className="text-xs font-semibold text-foreground">
              <span className="font-bold">5.0</span> on Google
            </span>
          </div>

          {/* Testimonial Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {reviewsToShow.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card text-card-foreground p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex text-amber-500 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                  <p className="font-serif text-sm sm:text-base text-card-foreground leading-relaxed italic mb-6">
                    "{r.quote}"
                  </p>
                </div>

                <div className="border-t border-border pt-4 text-xs">
                  <div className="font-semibold text-card-foreground">{r.author}</div>
                  <div className="text-[10px] text-muted-foreground">{r.location}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <a
              href={placeIds.sjUrl ?? "https://g.page/r/CSd3Q5ZmyEyKEBM/review"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1.5 transition"
            >
              Read San Jose reviews <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* Reserve CTA Banner */}
      <section className="px-6 py-16 sm:py-24 bg-background transition-colors duration-300">
        <div className="relative max-w-5xl mx-auto rounded-2xl bg-secondary/70 dark:bg-card border border-border py-16 px-8 sm:px-16 text-center overflow-hidden shadow-sm">
          {/* Subtle Leaf Branch Vector Accent */}
          <div className="pointer-events-none absolute right-4 bottom-0 opacity-20 text-primary">
            <svg width="240" height="240" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17,8C15.34,8 14,9.34 14,11C14,12.66 15.34,14 17,14C18.66,14 20,12.66 20,11C20,9.34 18.66,8 17,8M7,8C5.34,8 4,9.34 4,11C4,12.66 5.34,14 7,14C8.66,14 10,12.66 10,11C10,9.34 8.66,8 7,8M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2Z" />
            </svg>
          </div>

          <div className="relative z-10">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] font-semibold text-primary mb-2">
              RESERVE
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground font-medium mb-8">
              Begin the ritual.
            </h2>
            <Button
              asChild
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 h-auto text-xs font-medium tracking-[0.2em] uppercase rounded-lg shadow-md transition active:scale-[0.98]"
            >
              <Link to={bookHref}>BOOK YOUR APPOINTMENT</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Index;
