// Public endpoint that returns live Google rating/review count for a place.
// Uses the Google Maps Platform connector via the Lovable gateway.
// Falls back to {error, configured:false} when not connected so the UI can degrade.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const placeId = url.searchParams.get("placeId");
  if (!placeId || placeId.length < 8) {
    return json({ error: "placeId required" }, 400);
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gmapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!lovableKey || !gmapsKey) {
    return json({ error: "Google Maps connector not configured", configured: false }, 503);
  }

  try {
    const r = await fetch(`https://connector-gateway.lovable.dev/google_maps/places/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmapsKey,
        "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,googleMapsUri",
      },
    });
    if (!r.ok) {
      const body = await r.text();
      return json({ error: `Google API ${r.status}: ${body.slice(0, 200)}`, configured: true }, 502);
    }
    const d = await r.json();
    return json({
      configured: true,
      placeId,
      name: d?.displayName?.text ?? null,
      rating: typeof d?.rating === "number" ? d.rating : null,
      reviewCount: typeof d?.userRatingCount === "number" ? d.userRatingCount : null,
      googleMapsUri: d?.googleMapsUri ?? null,
    }, 200, 300); // cache 5min on edge
  } catch (e) {
    return json({ error: (e as Error).message, configured: true }, 500);
  }
});

function json(body: unknown, status = 200, sMaxAge = 0) {
  const headers: Record<string, string> = { ...corsHeaders, "Content-Type": "application/json" };
  if (sMaxAge > 0) headers["Cache-Control"] = `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 2}`;
  return new Response(JSON.stringify(body), { status, headers });
}
