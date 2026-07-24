import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { usePageMeta } from "@/hooks/usePageMeta";
import { findPost, posts } from "@/data/journalPosts";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";

export default function JournalPost() {
  const { slug = "" } = useParams();
  const post = findPost(slug);

  usePageMeta({
    title: post ? `${post.title} | Radiantilyk Aesthetic` : "Journal | Radiantilyk Aesthetic",
    description: post?.description,
    canonical: post ? `https://bookrka.com/journal/${post.slug}` : "https://bookrka.com/journal",
    ogType: post ? "article" : "website",
  });


  // Article + FAQPage JSON-LD
  useEffect(() => {
    if (!post) return;
    const data: any[] = [{
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.publishedAt,
      author: { "@type": "Organization", name: "Radiantilyk Aesthetic" },
      publisher: {
        "@type": "Organization",
        name: "Radiantilyk Aesthetic",
        logo: { "@type": "ImageObject", url: "https://bookrka.com/icon-512.png" },
      },
      image: "https://bookrka.com/og-image.jpg",
      mainEntityOfPage: `https://bookrka.com/journal/${post.slug}`,
    }];
    if (post.faqs?.length) {
      data.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faqs.map((f) => ({
          "@type": "Question", name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      });
    }
    let tag = document.head.querySelector('script[data-journal-jsonld]') as HTMLScriptElement | null;
    if (!tag) {
      tag = document.createElement("script");
      tag.type = "application/ld+json";
      tag.setAttribute("data-journal-jsonld", "1");
      document.head.appendChild(tag);
    }
    tag.textContent = JSON.stringify(data);
    return () => { tag?.remove(); };
  }, [post]);

  if (!post) return <Navigate to="/journal" replace />;

  const others = posts.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 sm:py-14 max-w-2xl">
        <Link to="/journal" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> All journal posts
        </Link>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          <span className="text-primary">{post.tag}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {post.readMinutes} min read</span>
          <span aria-hidden>·</span>
          <span>{new Date(post.publishedAt + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
        </div>

        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-4">{post.title}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">{post.excerpt}</p>

        <article className="space-y-8 text-[15px] sm:text-base leading-relaxed text-foreground/90">
          {post.body.map((section, i) => (
            <section key={i}>
              {section.h2 && <h2 className="font-serif text-2xl sm:text-3xl mt-2 mb-4 text-foreground">{section.h2}</h2>}
              {section.paragraphs.map((p, j) => (
                <p key={j} className="mb-4">{p}</p>
              ))}
            </section>
          ))}
        </article>

        {post.faqs && post.faqs.length > 0 && (
          <section className="mt-12 rounded-2xl border border-border bg-secondary/30 p-6 sm:p-8">
            <h2 className="font-serif text-2xl mb-4">Common questions</h2>
            <dl className="space-y-5">
              {post.faqs.map((f, i) => (
                <div key={i}>
                  <dt className="font-medium text-sm sm:text-base mb-1">{f.q}</dt>
                  <dd className="text-sm text-muted-foreground leading-relaxed">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <div className="mt-12 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-secondary/40 to-background p-6 sm:p-8 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl mb-2">Ready to talk it through in person?</h2>
          <p className="text-sm text-muted-foreground mb-5">Book a complimentary consultation — no pressure, no upsell.</p>
          <Link to="/book" className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-primary-foreground shadow-soft hover:opacity-90 text-sm font-medium">
            Book a consultation <ArrowRight className="h-4 w-4 ml-1.5" />
          </Link>
        </div>

        {others.length > 0 && (
          <section className="mt-14">
            <h2 className="font-serif text-xl mb-4">Keep reading</h2>
            <ul className="grid sm:grid-cols-2 gap-4">
              {others.map((p) => (
                <li key={p.slug}>
                  <Link to={`/journal/${p.slug}`} className="block rounded-2xl border border-border p-4 hover:border-primary/40 transition">
                    <div className="text-[10px] uppercase tracking-widest text-primary mb-1">{p.tag}</div>
                    <div className="font-serif text-lg leading-tight">{p.title}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
