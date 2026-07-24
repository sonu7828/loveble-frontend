import { Link } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { usePageMeta } from "@/hooks/usePageMeta";
import { posts } from "@/data/journalPosts";
import { ArrowRight, Clock } from "lucide-react";

export default function Journal() {
  usePageMeta({
    title: "Journal — Skincare & Medspa Notes | Radiantilyk Aesthetic",
    description: "Evergreen guides on Botox, GLP-1, microneedling, lip filler, and chemical peels from our San Jose medspa team.",
    canonical: "https://bookrka.com/journal",
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 sm:py-16 max-w-4xl">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-primary mb-3">Journal</p>
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl mb-4">Notes from the studio.</h1>
        <p className="text-muted-foreground text-base sm:text-lg mb-10 max-w-2xl">
          Honest, evergreen guides on the treatments we get asked about every day — written by the providers who perform them.
        </p>

        <div className="grid gap-6 sm:gap-8">
          {posts.map((p) => (
            <article key={p.slug} className="group rounded-2xl border border-border bg-card hover:border-primary/40 transition p-5 sm:p-7">
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                <span className="text-primary">{p.tag}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.readMinutes} min read</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl mb-2 leading-tight">
                <Link to={`/journal/${p.slug}`} className="hover:text-primary transition">{p.title}</Link>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-4">{p.excerpt}</p>
              <Link to={`/journal/${p.slug}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Read article <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
