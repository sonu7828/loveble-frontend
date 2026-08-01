import { Link } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, ShieldCheck, Syringe, Zap, Droplet, HeartPulse, Star, ArrowRight } from "lucide-react";
import { usePreferredLocation } from "@/hooks/usePreferredLocation";
import { useEffect, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";

import { apiQuery, authService, ApiClient } from "@/services/api";
import drFobiImg from "@/assets/dr-fobi.jpg";
import heroLeftImg from "@/assets/hero-left.png";
import heroRightImg from "@/assets/hero-right.png";
import rkaLogo from "@/assets/rka-logo.webp";

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
    apiQuery("locations").select("slug, google_place_id, google_review_url").eq("slug", "san-jose")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        const sj = list.find((r: any) => r.slug === "san-jose");
        setPlaceIds({
          sj: sj?.google_place_id ?? null,
          sjUrl: sj?.google_review_url ?? null,
        });
      });

    apiQuery("public_testimonials")
      .select("id, comment, first_name, location_city, rating")
      .eq("rating", 5)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        if (list.length === 0) return;
        setLiveReviews(
          list.map((t) => ({
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
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 min-h-[500px] lg:min-h-[640px]">

          {/* Left Image Panel — Archway & Olive Tree */}
          <div className="hidden lg:block lg:col-span-4 relative overflow-hidden">
            <img
              src={heroLeftImg}
              alt="Radiantilyk Aesthetic Medspa Lounge and Archway"
              className="absolute -top-2 left-0 w-full h-[calc(100%+12px)] object-cover scale-[1.03] origin-bottom dark:opacity-80 transition-opacity"
            />
          </div>

          {/* Center Card Panel — A quiet ritual of refinement */}
          <div className="col-span-1 lg:col-span-4 flex items-stretch justify-center bg-background lg:bg-[#f5f0eb] dark:lg:bg-background">
            <div className="w-full max-w-[520px] bg-card/95 dark:bg-card/90 text-card-foreground flex flex-col justify-between min-h-[500px] lg:min-h-[640px] px-10 sm:px-14 pt-10 pb-8 sm:pb-10 border-x border-border">

              {/* Top: Brand label + divider line */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] tracking-[0.28em] text-primary uppercase font-medium">
                  RADIANTILYK AESTHETIC
                </span>
                <div className="w-px h-10 bg-primary/30 mt-3" />
              </div>

              {/* Middle: Headline + location tag */}
              <div className="flex flex-col gap-6 my-auto">
                <h1 className="font-serif text-4xl sm:text-5xl lg:text-[4rem] text-card-foreground font-medium leading-[1.05] tracking-tight">
                  A quiet<br />
                  <span className="italic font-serif text-primary font-normal">ritual</span><br />
                  of refinement.
                </h1>

                {/* Location tag */}
                <div className="flex items-start gap-3">
                  <div className="w-0.5 h-8 bg-primary/60 rounded-full shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-[9px] tracking-[0.22em] text-muted-foreground uppercase font-medium">Considered Care</span>
                    <span className="text-[11px] tracking-[0.18em] text-foreground uppercase font-semibold mt-0.5">San Jose</span>
                  </div>
                </div>
              </div>

              {/* Bottom: Pagination dots + CTA button */}
              <div className="flex flex-col items-center gap-5 mt-10">
                {/* Dots */}
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <div className="w-2.5 h-2.5 rounded-full bg-primary/25" />
                  <div className="w-2.5 h-2.5 rounded-full bg-primary/25" />
                </div>
                {/* Full-width button */}
                <Button
                  asChild
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-5 h-auto text-xs font-medium tracking-[0.22em] uppercase rounded-md shadow-none transition-all active:scale-[0.98]"
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
      <section className="border-t border-border bg-background py-10 px-6 sm:px-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
                WHAT WE DO
              </p>
              <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground font-medium">
                Treatments, simply.
              </h3>
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
                className="group rounded-xl border border-border bg-card text-card-foreground pt-6 pb-4 px-4 hover:border-primary/60 hover:shadow-md transition-all text-center flex flex-col items-center justify-between h-full"
              >
                <div className="w-full flex flex-col items-center">
                  <div className="p-3 rounded-full bg-primary/10 text-primary mb-3 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-serif text-lg font-medium text-card-foreground mb-1">{title}</h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed font-light">{desc}</p>
                </div>
                
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-bold text-primary">
                  Explore <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Our Philosophy Section */}
      <section className="border-t border-border bg-secondary/30 dark:bg-card/30 py-10 px-6 sm:px-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl mb-8">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
              OUR PHILOSOPHY
            </p>
            <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground font-medium">
              Beauty, considered.
            </h3>
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
              <div key={title} className="bg-card text-card-foreground border border-border rounded-xl p-5 md:p-6 flex flex-col items-start shadow-xs h-full">
                <div className="p-3 rounded-full bg-primary/10 text-primary mb-3">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-xl text-card-foreground font-medium mb-2">{title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-light">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Medical Director Section */}
      <section className="border-t border-border bg-background py-8 px-6 sm:px-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 items-center">
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
                className="absolute inset-0 w-full h-full object-cover object-top scale-[1.08] origin-top-left"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* From Our Clients Section */}
      <section className="border-t border-border bg-secondary/30 dark:bg-card/30 py-10 px-6 sm:px-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
            FROM OUR CLIENTS
          </p>
          <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground font-medium mb-3">
            In their words.
          </h3>

          {/* Rating Badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
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
              <div key={r.id} className="rounded-xl border border-border bg-card text-card-foreground p-4 md:p-5 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex text-amber-500 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                  <p className="font-serif text-sm sm:text-base text-card-foreground leading-relaxed italic mb-4">
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

          <div className="mt-8">
            <Link
              to="/reviews"
              className="text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1.5 transition"
            >
              Read San Jose reviews <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Reserve CTA Banner */}
      <section className="px-4 sm:px-6 pt-4 pb-8 sm:pt-8 sm:pb-12 bg-background transition-colors duration-300">
        <div className="relative max-w-5xl mx-auto rounded-2xl bg-secondary/40 dark:bg-card border border-border py-8 sm:py-10 px-5 sm:px-8 md:px-16 text-center overflow-hidden shadow-sm">
          {/* Subtle Leaf Branch Vector Accent */}
          <div className="pointer-events-none absolute -right-6 sm:right-2 md:right-12 top-1/2 -translate-y-1/2 opacity-20 sm:opacity-30 md:opacity-50">
            <img
              src={rkaLogo}
              alt=""
              className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full object-cover shadow-sm mix-blend-multiply dark:mix-blend-lighten"
            />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] font-semibold text-primary mb-2">
              RESERVE
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground font-medium mb-6 sm:mb-8">
              Begin the ritual.
            </h2>
            <Button
              asChild
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-6 sm:px-8 py-4 h-auto text-[10px] sm:text-xs font-medium tracking-[0.15em] sm:tracking-[0.2em] uppercase rounded-lg shadow-md transition active:scale-[0.98]"
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
