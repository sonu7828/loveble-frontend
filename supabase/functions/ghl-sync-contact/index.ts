// Upserts a contact into GoHighLevel with optional tags + custom fields for SMS workflows.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";

// GHL custom field keys (must match keys created in GHL → Settings → Custom Fields)
const FIELD_KEYS = [
  "next_appointment_time",
  "next_appointment_service",
  "next_appointment_staff",
  "next_appointment_location",
  "review_url",
  "review_location",
  "resume_url",
  "rebook_service",
];

let cachedFieldMap: Record<string, string> | null = null;
async function getFieldMap(token: string, locationId: string): Promise<Record<string, string>> {
  if (cachedFieldMap) return cachedFieldMap;
  try {
    const r = await fetch(`${GHL_BASE}/locations/${locationId}/customFields`, {
      headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" },
    });
    const data = await r.json().catch(() => ({}));
    const map: Record<string, string> = {};
    const fields = data?.customFields ?? data?.fields ?? [];
    for (const f of fields) {
      const key = (f.fieldKey || f.key || "").replace(/^contact\./, "");
      if (key && FIELD_KEYS.includes(key)) map[key] = f.id;
    }
    cachedFieldMap = map;
    return map;
  } catch (e) {
    console.error("ghl field map fetch failed", e);
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const token = Deno.env.get("GHL_PRIVATE_TOKEN");
  const locationId = Deno.env.get("GHL_LOCATION_ID");
  if (!token || !locationId) return json({ error: "GHL not configured" }, 500);

  try {
    const body = await req.json();
    const contacts: any[] = Array.isArray(body?.contacts) ? body.contacts : [body];
    const fieldMap = await getFieldMap(token, locationId);
    const results: any[] = [];

    for (const c of contacts) {
      const email = (c?.email || "").trim().toLowerCase();
      if (!email) { results.push({ ok: false, error: "missing email" }); continue; }

      const customFieldsInput = (c.customFields || {}) as Record<string, string>;
      const customFields = Object.entries(customFieldsInput)
        .filter(([k, v]) => fieldMap[k] && v !== undefined && v !== null && v !== "")
        .map(([k, v]) => ({ id: fieldMap[k], key: k, field_value: String(v) }));

      const payload: Record<string, unknown> = {
        locationId,
        email,
        firstName: c.firstName || c.first_name || "",
        lastName: c.lastName || c.last_name || "",
        phone: c.phone || "",
        dateOfBirth: c.dob || c.dateOfBirth || undefined,
        source: c.source || "rkabook.com",
        tags: Array.isArray(c.tags) ? c.tags : (c.tag ? [c.tag] : ["rkabook"]),
        ...(customFields.length ? { customFields } : {}),
      };
      Object.keys(payload).forEach((k) => (payload as any)[k] === "" || (payload as any)[k] === undefined ? delete (payload as any)[k] : null);

      try {
        const r = await fetch(`${GHL_BASE}/contacts/upsert`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Version: "2021-07-28",
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          console.error("GHL upsert failed", r.status, data);
          results.push({ ok: false, email, status: r.status, error: data });
        } else {
          results.push({ ok: true, email, contactId: data?.contact?.id ?? data?.id });
        }
      } catch (e) {
        console.error("GHL upsert error", e);
        results.push({ ok: false, email, error: (e as Error).message });
      }
    }

    return json({ results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
