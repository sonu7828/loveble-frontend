import { useEffect, useState } from "react";
import { Star } from "lucide-react";

interface Props {
  placeId: string | null;
  fallbackUrl?: string | null;
  className?: string;
}

interface Live { configured: boolean; rating: number | null; reviewCount: number | null; googleMapsUri: string | null }

export default function GoogleReviewBadge({ placeId, fallbackUrl, className }: Props) {
  const [data, setData] = useState<Live | null>(null);
  const [loading, setLoading] = useState(!!placeId);

  useEffect(() => {
    if (!placeId) { setLoading(false); return; }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-google-reviews?placeId=${encodeURIComponent(placeId)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then(async (r) => r.ok ? r.json() : null)
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [placeId]);

  const rating = data?.rating ?? null;
  const count = data?.reviewCount ?? null;
  const link = data?.googleMapsUri ?? fallbackUrl ?? null;
  const displayRating = rating ?? 5.0;

  const inner = (
    <span className={`inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs ${className ?? ""}`}>
      <span className="flex gap-0.5" aria-hidden>
        {[0,1,2,3,4].map((i) => (
          <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(displayRating) ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}`} />
        ))}
      </span>
      <span className="font-medium">{displayRating.toFixed(1)}</span>
      {count != null ? (
        <span className="text-muted-foreground">· {count} Google review{count === 1 ? "" : "s"}</span>
      ) : loading ? (
        <span className="text-muted-foreground">· loading…</span>
      ) : (
        <span className="text-muted-foreground">· on Google</span>
      )}
    </span>
  );

  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition">{inner}</a>
  ) : inner;
}
