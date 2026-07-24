// Evergreen journal posts. Stored in code (not the DB) so they're shipped with
// the bundle and indexable on first paint. To add a post: drop a new entry and
// add the slug to the sitemap.

export interface JournalPost {
  slug: string;
  title: string;
  excerpt: string;
  description: string; // meta description, ≤160 chars
  publishedAt: string; // ISO date
  readMinutes: number;
  tag: string;
  body: Section[];
  faqs?: { q: string; a: string }[];
}

interface Section {
  h2?: string;
  paragraphs: string[];
}

export const posts: JournalPost[] = [
  {
    slug: "botox-vs-daxxify",
    title: "Botox vs Daxxify: which neurotoxin is right for you?",
    excerpt: "Both relax the same muscles, but onset, duration, and dosing differ. Here's how we choose at Radiantilyk.",
    description: "Botox vs Daxxify at a San Jose medspa — onset, duration, unit pricing, and how we choose for first-timers vs experienced clients.",
    publishedAt: "2026-06-01",
    readMinutes: 5,
    tag: "Neurotoxins",
    body: [
      {
        paragraphs: [
          "If you've started researching wrinkle relaxers, you've probably seen a few names: Botox, Daxxify, Xeomin, and Jeuveau. They are all FDA-approved botulinum toxin type A — the same family of neuromodulator — and they all work by temporarily quieting the small muscles that pull skin into expression lines.",
          "At Radiantilyk Aesthetic the two most-requested options are Botox and Daxxify. Here's the honest comparison we walk new clients through.",
        ],
      },
      {
        h2: "How they work (the boring-but-important part)",
        paragraphs: [
          "Both Botox and Daxxify block the release of acetylcholine, the chemical that tells a muscle to contract. Less contraction over time means smoother skin at rest. Neither product 'erases' wrinkles — they soften the muscle action that causes them.",
          "Units are roughly 1:1 between Botox and Daxxify, so the dose conversation is simpler. The difference shows up in how long the result lasts, not in how many units you need.",
        ],
      },
      {
        h2: "Onset & duration",
        paragraphs: [
          "Onset is similar — softening typically begins at days 3–5, with full effect around two weeks for both products.",
          "Duration is where Daxxify stands apart. Botox typically lasts 3–4 months; Daxxify is formulated with a peptide stabilizer that extends results to roughly 6 months for many clients (some closer to 4, some closer to 9). If you're tired of three-times-a-year touch-ups, Daxxify is usually the upgrade conversation.",
        ],
      },
      {
        h2: "Precision & feel",
        paragraphs: [
          "Both products allow precise, targeted work in the right hands — forehead, 11s, crow's feet, lip flip, jawline slimming, masseter, neck bands. Your injector's technique matters more than the molecule.",
          "Some long-time Botox clients say Daxxify feels 'a touch stronger' for the first few weeks; we account for that with conservative first-time dosing.",
        ],
      },
      {
        h2: "How we choose at Radiantilyk",
        paragraphs: [
          "First-time client who wants to try neurotoxin and see how their face responds? Usually Botox — predictable, 3–4 month duration, easy to fine-tune at the follow-up.",
          "Repeat client who's happy with their result? We stay with what's working.",
          "Client who hates re-booking every quarter, or has a busy travel/work calendar? Daxxify, for the longer runway between visits.",
          "Highly expressive forehead, small features, or asking for a 'baby Botox' look? Botox or Xeomin, smaller doses, more frequent touch-ups.",
        ],
      },
    ],
    faqs: [
      { q: "Does it hurt?", a: "Most clients describe it as a quick pinch. We use a fine 32G needle and can apply topical numbing on request — no downtime, you can drive yourself home." },
      { q: "Will I look frozen?", a: "Only if you ask to be. Our default is a soft, natural result — you'll still raise your eyebrows and show emotion. Conservative dosing is easier to add to than to undo." },
      { q: "How much does it cost?", a: "We price per unit so you only pay for what you actually need. A typical first-time forehead + 11s treatment lands in the $300–$600 range with Botox; Daxxify is priced slightly higher per unit but lasts longer. We'll quote you exactly before anything happens." },
    ],
  },
  {
    slug: "glp-1-san-jose-guide",
    title: "GLP-1 in San Jose: an honest, realistic guide",
    excerpt: "What semaglutide and tirzepatide actually do, who they're for, what they cost, and what we won't promise you.",
    description: "GLP-1 medical weight loss in San Jose — semaglutide and tirzepatide. Eligibility, monthly cost, side effects, and our televisit workflow.",
    publishedAt: "2026-06-05",
    readMinutes: 7,
    tag: "Medical Wellness",
    body: [
      {
        paragraphs: [
          "GLP-1 receptor agonists are the most-asked-about category of medicine in our clinic right now. If you've heard friends mention 'the shot' or seen weekly injectables in the news, this post is for you.",
          "Our medical-wellness program is run by Kiem, our nurse practitioner, via secure televisit. Initial visits are complimentary so you can ask questions before committing to anything.",
        ],
      },
      {
        h2: "What GLP-1s actually do",
        paragraphs: [
          "GLP-1 (glucagon-like peptide-1) is a gut hormone your body already makes. The medications — semaglutide and tirzepatide — mimic it for much longer.",
          "Effects: appetite quiets, you feel full sooner, food noise drops, and blood sugar stays steadier. For most people, a 10–20% reduction in body weight over 9–12 months is realistic with consistent use plus protein-forward meals and resistance training.",
        ],
      },
      {
        h2: "Who is a candidate",
        paragraphs: [
          "Generally, BMI ≥ 27 with a weight-related condition (insulin resistance, PCOS, hypertension, sleep apnea) or BMI ≥ 30 without. We'll review labs and history during your televisit.",
          "Not a fit: active pancreatitis history, personal/family history of medullary thyroid carcinoma or MEN2, current pregnancy or trying to conceive, certain eating disorders. We screen for these on intake.",
        ],
      },
      {
        h2: "What it costs",
        paragraphs: [
          "Our compounded GLP-1 programs typically run $250–$450/month depending on the medication and dose. The price includes the medication, monthly check-ins, and dose titration. No surprise bills.",
          "Brand-name Ozempic, Wegovy, Mounjaro, and Zepbound are not part of our compounded program — those go through your insurance and pharmacy.",
        ],
      },
      {
        h2: "Side effects to expect (and what to do about them)",
        paragraphs: [
          "Nausea is the most common in the first 2–4 weeks. We start low, titrate slow, and you'll have direct messaging access to Kiem if anything is off.",
          "Other commons: constipation, fatigue, headache. Less common but worth knowing: gallbladder issues, pancreatitis, hair shedding at fast weight-loss rates. Protein, hydration, and a measured pace prevent most issues.",
        ],
      },
      {
        h2: "What we won't promise",
        paragraphs: [
          "We won't promise '30 lbs in 30 days', won't push you to a higher dose than you need, and won't keep you on the medication forever if you don't want to be. The goal is a sustainable result — including a maintenance plan you can actually live with.",
        ],
      },
    ],
    faqs: [
      { q: "Is the televisit really free?", a: "Yes. Your first televisit consultation with Kiem is complimentary. You only pay if you decide to start a medication program." },
      { q: "How fast will I see results?", a: "Most clients notice less hunger within the first 1–2 weeks. Visible weight changes typically start at 4–6 weeks and build steadily. We measure progress monthly." },
      { q: "Do I need to inject myself?", a: "Yes — it's a small subcutaneous injection once weekly. We teach you how at your first visit; most clients find it easier than a flu shot." },
    ],
  },
  {
    slug: "microneedling-vs-rf-microneedling",
    title: "Microneedling vs RF microneedling: which one for which skin?",
    excerpt: "Pen microneedling builds collagen on the surface. RF adds heat that tightens deeper. Here's how to choose.",
    description: "Compare traditional microneedling vs RF microneedling for acne scars, fine lines, pores, and skin tightening — and which is right for your goals.",
    publishedAt: "2026-06-08",
    readMinutes: 5,
    tag: "Skin",
    body: [
      {
        paragraphs: [
          "Microneedling sounds like one treatment but it's really a family. The two most-asked-for versions at our clinic are pen microneedling and RF microneedling. They share a name and a basic idea — controlled micro-injuries that trigger collagen — but the depth of effect is quite different.",
        ],
      },
      {
        h2: "Pen microneedling",
        paragraphs: [
          "A small device with 12–16 sterile needles glides across the skin, creating microchannels in the epidermis and upper dermis. Your body responds by producing collagen and elastin in that zone over the next 4–8 weeks.",
          "Best for: texture, dull tone, mild acne scarring, fine lines, large pores. Series of 3–6 sessions, spaced 4 weeks apart. Downtime: a day or two of pink, sunburn-like skin.",
        ],
      },
      {
        h2: "RF microneedling",
        paragraphs: [
          "Same needle concept, but each needle delivers radiofrequency heat at a precise depth (we can go from 0.5 mm to 4 mm). The heat contracts existing collagen and stimulates more — a stronger remodeling effect.",
          "Best for: acne scarring with real depth, jawline laxity, neck crepiness, deeper lines, large pores. Series of 3 sessions, 4–6 weeks apart. Downtime: 2–4 days of redness and tiny grid marks that fade.",
        ],
      },
      {
        h2: "How we choose",
        paragraphs: [
          "Texture and tone work, sensitive skin, or a glow-up plan in your 20s–early 30s? Start with pen microneedling.",
          "Scarring, laxity, or you're past the 'just glow' stage and want tightening? RF microneedling is the move.",
          "Either way, sunscreen daily and a quality home routine make a bigger difference than any single in-clinic treatment.",
        ],
      },
    ],
    faqs: [
      { q: "Does it hurt?", a: "We apply 30–45 minutes of strong topical numbing first. Most clients rate the sensation a 3/10 — vibration plus warmth, especially for RF." },
      { q: "Is it safe for darker skin?", a: "Yes — both treatments are color-blind because they don't rely on light. RF microneedling is actually one of the better tightening options for skin of color." },
      { q: "When will I see results?", a: "Initial glow at 1 week, real collagen remodeling at 8–12 weeks, full result by 3–6 months. We take before-and-after photos to keep you honest." },
    ],
  },
  {
    slug: "lip-filler-natural-results",
    title: "Lip filler done well: natural results, realistic expectations",
    excerpt: "Half a syringe, the right product, and a conservative plan beat a single dramatic session every time.",
    description: "Natural lip filler at a San Jose medspa — product choice, syringe count, swelling timeline, and how to avoid 'duck lip' results.",
    publishedAt: "2026-06-10",
    readMinutes: 4,
    tag: "Fillers",
    body: [
      {
        paragraphs: [
          "If you've been on social media you've seen lip filler done badly — flat, shelf-like, no movement. The good news: that look is a choice, not an inevitability.",
          "We treat lips conservatively. A natural result usually means half a syringe at a time, the right HA product, and a follow-up at 2 weeks to refine.",
        ],
      },
      {
        h2: "Product matters",
        paragraphs: [
          "Hyaluronic acid fillers come in different consistencies. Softer, more flexible HAs (think Juvéderm Volbella, Restylane Kysse) give a hydrated look without the puffy projection.",
          "Stiffer products belong in cheeks and jawlines, not lips. If a previous filler felt 'lumpy' you may have had the wrong product — or just too much, too fast.",
        ],
      },
      {
        h2: "What 'half a syringe' actually looks like",
        paragraphs: [
          "Half a syringe (0.5 mL) is enough for most first-time clients to see hydration, a soft border, and a touch more shape. We'd rather see you again in 4 weeks to add a touch more than overdo it on day one.",
          "Swelling peaks at 24–48 hours. Bruising is possible — arnica, no alcohol for 24 hours, and skipping fish oil/ibuprofen for a week beforehand reduces the risk.",
        ],
      },
      {
        h2: "When to wait",
        paragraphs: [
          "Active cold sore or fever blister? We reschedule. Big event in 5 days? Push it to 3 weeks out so swelling and any bruising have time to resolve. Pregnant or nursing? We wait.",
        ],
      },
    ],
    faqs: [
      { q: "How long does it last?", a: "Lip filler typically lasts 9–12 months. It metabolizes faster in active people and in the very front of the lip where there's the most movement." },
      { q: "Can I dissolve it if I don't like it?", a: "Yes. HA filler can be dissolved with hyaluronidase in about 24 hours. We rarely need to — but it's a real safety net." },
      { q: "Will it look fake?", a: "Not if it's conservative. We err on the side of underdone — you can always add, you can't always subtract without dissolving." },
    ],
  },
  {
    slug: "chemical-peels-picking-the-right-one",
    title: "Chemical peels: how to pick the right one for your skin",
    excerpt: "From a lunchtime Light Peel to focal TCA CROSS for acne scars — here's what each of our four peels does and who they're for.",
    description: "Our chemical peel menu — Light Peel, Advanced Peel, Perfect Derma Peel, and TCA CROSS — explained by a San Jose medspa.",
    publishedAt: "2026-06-12",
    readMinutes: 5,
    tag: "Skin",
    body: [
      {
        paragraphs: [
          "A chemical peel is a controlled exfoliation — an acid solution dissolves the bonds between dead skin cells so the fresher, more even layer underneath can show up.",
          "The right peel depends on your skin type, your goal, and how much downtime you can tolerate. At Radiantilyk Aesthetic we offer four peels, each with a clear job. Here is how we choose.",
        ],
      },
      {
        h2: "Light Peel — glow with no downtime",
        paragraphs: [
          "Our gentlest option. A surface-level peel that brightens dullness, smooths texture, and evens tone with little to no visible peeling — most clients can return to work or a dinner the same evening.",
          "Best for: first-time peelers, a pre-event refresh, sensitive skin, or a monthly maintenance step between bigger treatments.",
        ],
      },
      {
        h2: "Advanced Peel — medical-grade resurfacing",
        paragraphs: [
          "A stronger medical-grade peel that targets sun damage, pigmentation, fine lines, and uneven texture in a single session.",
          "Expect light flaking on days 3–5. Plan it for a quiet weekend. Best for: photoaging, dullness that a Light Peel hasn't moved, and clients ready for a noticeable reset.",
        ],
      },
      {
        h2: "Perfect Derma Peel — our signature for melasma, sun spots & tone",
        paragraphs: [
          "A medium-depth blend peel that pairs TCA, retinoic acid, kojic, salicylic, and glutathione. It's our go-to for melasma, sun spots, post-acne marks, and overall tone evenness.",
          "Visible peeling on days 3–5, with the full result unfolding over about two weeks. Best for: pigmentation that won't fade with topicals, twice-a-year skin overhauls, and clients with darker skin tones (with proper pre-treatment).",
        ],
      },
      {
        h2: "TCA CROSS — focal treatment for acne scars",
        paragraphs: [
          "Not a full-face peel. TCA CROSS is a focal technique where high-concentration TCA is placed precisely inside individual icepick and narrow boxcar acne scars to trigger collagen remodeling from the base up.",
          "Per-session pricing; a series of 3–6 sessions, spaced 4–6 weeks apart, is typical. Often combined with microneedling or RF microneedling for broader resurfacing alongside the focal work.",
        ],
      },
      {
        h2: "How we choose",
        paragraphs: [
          "Sensitive skin, first peel, or you have an event this week? Light Peel.",
          "Sun damage and dullness, ready for a few days of social downtime? Advanced Peel.",
          "Melasma, sun spots, post-acne discoloration, or overall tone work? Perfect Derma Peel.",
          "Individual icepick or boxcar acne scars? TCA CROSS — usually inside a larger scar plan.",
        ],
      },
    ],
    faqs: [
      { q: "How do I prep for a peel?", a: "Stop retinoids 5–7 days before. No waxing, lasers, or aggressive exfoliation for two weeks before. Tell us if you've had cold sores — we may pre-treat with antivirals." },
      { q: "How often can I peel?", a: "Light Peels every 4 weeks if you like; Advanced and Perfect Derma 2–4 times per year. TCA CROSS runs as a series of 3–6 sessions, 4–6 weeks apart. We'll build a plan based on your goal, not push you into a package you don't need." },
      { q: "Can darker skin tones get peels?", a: "Yes — but the choice matters. Light Peel and Perfect Derma Peel are typically the safest starting points for Fitzpatrick IV–VI, with proper pre-treatment. We screen and customize for every skin tone." },
    ],
  },
  {
    slug: "no-peel-peels-rds-biorepeel-prx",
    title: "No-peel peels, explained: RDS Regenerative, Velvet Reset & PRX Facial",
    excerpt: "Three of our most-requested signature facials are all 'no-peel peels' — real acid chemistry, glow-up results, zero flaking. Here's what's actually in each one.",
    description: "RDS Regenerative (Factor Five), Velvet Reset (BioRePeel) and PRX Facial (PRX-T33) compared — three no-peel peels at Radiantilyk Aesthetic, San Jose.",
    publishedAt: "2026-06-15",
    readMinutes: 6,
    tag: "Facials",
    body: [
      {
        paragraphs: [
          "A 'no-peel peel' sounds like a contradiction — and that's the point. These are real medical-grade acid treatments (TCA, lactobionic, kojic, hydrogen peroxide, growth factors) formulated so they exfoliate, brighten, and remodel collagen without the visible flaking, redness, or downtime of a traditional peel.",
          "Translation: you walk out glowing and go straight back to work, dinner, or your camera roll. At Radiantilyk Aesthetic we offer three of the best no-peel peels on the market — RDS Regenerative, Velvet Reset, and PRX Facial. Here's the honest breakdown of what each one is, what it does, and how we choose.",
        ],
      },
      {
        h2: "RDS Regenerative Facial — Factor Five RDS",
        paragraphs: [
          "RDS stands for Regenerative Defense System, a serum from Factor Five built around exosome-derived growth factors. Exosomes are tiny cell-to-cell messengers that signal your skin's own fibroblasts to make more collagen, elastin, and hyaluronic acid.",
          "The Factor Five RDS facial layers this serum into a cleanse → gentle exfoliation → infusion → mask → LED protocol. There is no peeling phase, no crusting, no social downtime — just steady, cellular-level repair.",
          "Best for: dullness, post-inflammatory pigmentation, post-procedure recovery (after laser, microneedling, or RF), sensitive or rosacea-prone skin that can't tolerate aggressive acids, and anyone in their 30s–60s building a long-term anti-aging routine. Great as a monthly maintenance ritual.",
        ],
      },
      {
        h2: "Velvet Reset Facial — BioRePeel",
        paragraphs: [
          "BioRePeel is an Italian-formulated two-phase treatment. Phase one is a lipophilic film of TCA (trichloroacetic acid), salicylic acid, and tartaric acid that bonds to the skin. Phase two is a hydrophilic layer of amino acids, vitamins, and GABA that drives renewal without irritation.",
          "Together they resurface, refine pores, fade dark spots, soften fine lines, and stimulate collagen — with no visible peeling. Most clients see brightening and tighter texture by day three.",
          "Best for: oily and acne-prone skin, congested pores, post-acne marks, uneven tone, early fine lines, and anyone who has an event in 48 hours and wants real chemistry doing real work — without a flake in sight.",
        ],
      },
      {
        h2: "PRX Facial — PRX-T33",
        paragraphs: [
          "PRX-T33 is the bio-revitalization treatment beloved by European derms. It combines a higher-concentration TCA (33%) with kojic acid and hydrogen peroxide, but the kicker is delivery: the hydrogen peroxide buffers the acid so it works in the dermis without burning the epidermis. No injections, no peeling.",
          "It is the closest thing to a 'liquid microneedling' result — firmer, tighter, brighter, more bounce — in a 30–45 minute treatment. A series of 4 sessions one week apart is the classic protocol, with maintenance every 1–2 months.",
          "Best for: skin laxity, dull tone, melasma maintenance, sun damage, crepey neck and décolleté, post-pregnancy or post-weight-loss skin, and the bride/event client who wants firmer skin fast without downtime.",
        ],
      },
      {
        h2: "Quick comparison",
        paragraphs: [
          "RDS Regenerative — growth factors + exosomes. Heals and rejuvenates. Best for sensitive, post-procedure, or anti-aging maintenance.",
          "Velvet Reset (BioRePeel) — TCA + salicylic + amino acids. Brightens, refines pores, softens acne marks. Best for oily, acne-prone, or pre-event glow.",
          "PRX Facial (PRX-T33) — TCA + kojic + H₂O₂. Tightens and firms at the dermal level. Best for laxity, melasma, neck/décolleté.",
        ],
      },
      {
        h2: "How we choose at Radiantilyk",
        paragraphs: [
          "We start with your skin goal, your downtime tolerance, and your calendar. A free consultation (in-person or televisit) lets us look at your skin, ask about retinoid use, sun exposure, and any recent injectables or laser, and recommend the right facial — or the right series.",
          "All three are safe across Fitzpatrick skin types I–VI when properly prepped. None of them require you to take time off, and all three pair beautifully with Botox, filler, microneedling, or laser as part of a broader plan.",
        ],
      },
    ],
    faqs: [
      { q: "Will I actually peel?", a: "No. That is the entire point of a no-peel peel — the chemistry works under the surface so you don't see flaking. You may see mild pinkness for a few hours and a noticeable glow by the next morning." },
      { q: "How often should I do them?", a: "RDS: monthly maintenance is ideal. BioRePeel (Velvet Reset): a series of 4, one week apart, then monthly. PRX-T33: a series of 4, one week apart, then every 1–2 months. We'll build a realistic plan around your goals and budget." },
      { q: "Can I combine them with Botox, filler, or laser?", a: "Yes. We typically do the facial first, then injectables the same visit, or schedule laser/microneedling 1–2 weeks apart. We map it out for you so nothing competes." },
      { q: "Are they safe for darker skin tones?", a: "Yes — these three are some of the safest brightening options for Fitzpatrick IV–VI because there's no controlled wounding of the epidermis. We still screen for melasma triggers and pre-treat when appropriate." },
      { q: "How much do they cost?", a: "All three signature no-peel facials are $185 at Radiantilyk. Series and membership pricing available." },
    ],
  },
];



export const findPost = (slug: string) => posts.find((p) => p.slug === slug);
