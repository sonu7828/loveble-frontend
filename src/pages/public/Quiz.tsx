import { useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ArrowRight, Sparkles } from "lucide-react";

type Concern =
  | "wrinkles" | "volume" | "skin" | "acne" | "tightening"
  | "body" | "hair" | "weight" | "hormones" | "unsure";

interface Question {
  id: string;
  q: string;
  options: { label: string; value: Concern | string; emoji?: string }[];
}

const questions: Question[] = [
  {
    id: "goal",
    q: "What's your main goal right now?",
    options: [
      { label: "Soften fine lines & wrinkles", value: "wrinkles", emoji: "✨" },
      { label: "Restore volume / contour", value: "volume", emoji: "💧" },
      { label: "Glow & even skin tone", value: "skin", emoji: "🌟" },
      { label: "Clear acne or scars", value: "acne", emoji: "🧖" },
      { label: "Lift & tighten", value: "tightening", emoji: "⬆️" },
      { label: "Tone or sculpt body", value: "body", emoji: "🧘" },
      { label: "Reduce unwanted hair", value: "hair", emoji: "🪒" },
      { label: "Weight or hormone wellness", value: "weight", emoji: "⚕️" },
      { label: "Not sure — guide me", value: "unsure", emoji: "🤔" },
    ],
  },
  {
    id: "experience",
    q: "Have you had aesthetic treatments before?",
    options: [
      { label: "Brand new — first time", value: "new" },
      { label: "A little — Botox or facials", value: "some" },
      { label: "Regular client elsewhere", value: "regular" },
    ],
  },
  {
    id: "downtime",
    q: "How much downtime can you tolerate?",
    options: [
      { label: "None — back to life today", value: "none" },
      { label: "A day or two of redness", value: "low" },
      { label: "Up to a week — go big", value: "high" },
    ],
  },
  {
    id: "timing",
    q: "When would you like to be seen?",
    options: [
      { label: "This week", value: "asap" },
      { label: "Next 2–4 weeks", value: "soon" },
      { label: "Just exploring", value: "later" },
    ],
  },
];

const recommendations: Record<string, { title: string; blurb: string; cta: string; href: string }> = {
  wrinkles: {
    title: "Neurotoxins (Botox / Daxxify)",
    blurb: "Softens forehead lines, 11s, and crow's feet. ~10-min visit, no downtime, results in 7–14 days.",
    cta: "Browse Neurotoxins",
    href: "/services#c1000000-0000-0000-0000-000000000001",
  },
  volume: {
    title: "Dermal Fillers",
    blurb: "Restores cheek, lip, or jawline volume with HA fillers. Same-day results, minimal downtime.",
    cta: "Browse Fillers",
    href: "/services#c1000000-0000-0000-0000-000000000002",
  },
  skin: {
    title: "Signature Facial or Chemical Peel",
    blurb: "Resurfacing for glow, tone, and texture. Great every 4–6 weeks.",
    cta: "Browse Facials & Peels",
    href: "/services#c1000000-0000-0000-0000-000000000010",
  },
  acne: {
    title: "Clinical Facial + Chemical Peel",
    blurb: "Targeted extractions, peels, and home care to clear breakouts and fade marks.",
    cta: "Browse Skin Services",
    href: "/services#c1000000-0000-0000-0000-000000000004",
  },
  tightening: {
    title: "Volnewmer / RF Microneedling",
    blurb: "Non-invasive monopolar RF and microneedling to tighten skin without surgery.",
    cta: "Browse Tightening",
    href: "/services#c1000000-0000-0000-0000-000000000006",
  },
  body: {
    title: "Body Contouring",
    blurb: "Sculpt and tone problem areas without anesthesia or downtime.",
    cta: "Browse Body Services",
    href: "/services#c1000000-0000-0000-0000-000000000008",
  },
  hair: {
    title: "Laser Hair Reduction",
    blurb: "Long-lasting smooth skin in 6–8 sessions. Safe for most skin tones.",
    cta: "Browse Laser Hair",
    href: "/services#c1000000-0000-0000-0000-000000000009",
  },
  weight: {
    title: "Medical Wellness (Televisit with Kiem)",
    blurb: "GLP-1, HRT, and peptide therapy — initial televisit consultation is complimentary.",
    cta: "Book Free Televisit",
    href: "/book?service=a1000000-0000-0000-0000-000000000002",
  },
  hormones: {
    title: "Medical Wellness (Televisit with Kiem)",
    blurb: "Hormone replacement and peptide therapies — initial televisit is complimentary.",
    cta: "Book Free Televisit",
    href: "/book?service=a1000000-0000-0000-0000-000000000002",
  },
  unsure: {
    title: "Complimentary In-Studio Consultation",
    blurb: "Sit with a provider, walk through your concerns, and leave with a clear plan. No pressure, no cost.",
    cta: "Book Free Consultation",
    href: "/book?service=a1000000-0000-0000-0000-000000000001",
  },
};

export default function Quiz() {
  usePageMeta({
    title: "Treatment Finder Quiz — Radiantilyk Aesthetic",
    description: "Answer 4 quick questions and we'll recommend the right treatment or a complimentary consultation.",
    canonical: "https://bookrka.com/quiz",
  });

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const pick = (val: string) => {
    const next = { ...answers, [questions[idx].id]: val };
    setAnswers(next);
    if (idx === questions.length - 1) setDone(true);
    else setIdx(i => i + 1);
  };

  const goal = answers.goal as Concern | undefined;
  const rec = goal ? recommendations[goal] : recommendations.unsure;
  const downtime = answers.downtime;
  const showConsultFirst = answers.experience === "new" || goal === "unsure";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 sm:py-16 max-w-2xl">
        <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-primary mb-3">Treatment Finder</p>
        <h1 className="font-serif text-3xl sm:text-5xl mb-2">Not sure what you need?</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Four quick questions. Less than a minute. We'll point you to the right next step.
        </p>

        {!done && (
          <div>
            <div className="flex gap-1.5 mb-6" role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={idx + 1}>
              {questions.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i <= idx ? "bg-primary" : "bg-secondary"}`} />
              ))}
            </div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
              Question {idx + 1} of {questions.length}
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl mb-6">{questions[idx].q}</h2>
            <div className="grid gap-3">
              {questions[idx].options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => pick(opt.value)}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition px-4 py-4 text-left text-sm sm:text-base min-h-[56px]"
                >
                  <span className="flex items-center gap-3">
                    {opt.emoji && <span className="text-xl" aria-hidden>{opt.emoji}</span>}
                    <span>{opt.label}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                </button>
              ))}
            </div>
            {idx > 0 && (
              <button
                onClick={() => setIdx(i => Math.max(0, i - 1))}
                className="mt-6 text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
            )}
          </div>
        )}

        {done && (
          <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-secondary/40 to-background p-6 sm:p-8 shadow-elegant">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Your match
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl mb-3">{rec.title}</h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-5">{rec.blurb}</p>

            {downtime === "none" && goal !== "wrinkles" && goal !== "weight" && (
              <p className="text-xs text-foreground/80 bg-background/60 border border-border rounded-xl p-3 mb-5">
                Heads up — you picked <span className="font-medium">no downtime</span>. Tell your provider; we'll
                tailor settings so you can head straight back to your day.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to={rec.href}
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-primary-foreground shadow-soft hover:opacity-90 text-sm font-medium"
              >
                {rec.cta} →
              </Link>
              {showConsultFirst && goal !== "unsure" && (
                <Link
                  to="/book?service=a1000000-0000-0000-0000-000000000001"
                  className="inline-flex items-center justify-center rounded-full border border-primary px-6 py-3 text-primary hover:bg-primary/10 text-sm"
                >
                  Or book a free consult
                </Link>
              )}
            </div>

            <button
              onClick={() => { setAnswers({}); setIdx(0); setDone(false); }}
              className="mt-6 text-xs text-muted-foreground hover:text-foreground"
            >
              ↺ Start over
            </button>
          </div>
        )}

        <div className="mt-10 text-center text-xs text-muted-foreground">
          Prefer to talk it through?{" "}
          <a href="sms:+14083511873" className="text-primary hover:underline">Text us</a>
          {" · "}
          <a href="tel:4083511873" className="text-primary hover:underline">Call 408 · 351 · 1873</a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
