// Shows pre-visit safety gaps for an upcoming appointment:
//   • Missing or expired GFE (required for injectable / energy / wellness)
//   • Unsigned consent forms attached to the appointment
// Renders nothing when the booking is non-clinical (e.g. consult, facial).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, FileWarning } from "lucide-react";
import { Link } from "react-router-dom";

const GFE_CATEGORIES = new Set(["neurotoxin", "filler", "energy", "wellness", "injectable", "laser"]);

export function BookingGapBanner({
  appointmentId,
  clientEmail,
  serviceCategory,
}: {
  appointmentId: string;
  clientEmail: string;
  serviceCategory?: string | null;
}) {
  const [gfeOk, setGfeOk] = useState<boolean | null>(null);
  const [unsigned, setUnsigned] = useState(0);
  const needsGfe = !!serviceCategory && GFE_CATEGORIES.has(serviceCategory.toLowerCase());

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [{ data: g }, { data: rows }] = await Promise.all([
        supabase.from("gfe_records")
          .select("expires_at")
          .ilike("client_email", clientEmail)
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("appointment_consents")
          .select("consent_form_id, signed, consent_form:consent_forms!inner(id, version, is_optional, is_active)")
          .eq("appointment_id", appointmentId),
      ]);
      if (cancel) return;
      setGfeOk(!!g);

      const activeRequired = (rows ?? []).filter(
        (r: any) => r.consent_form?.is_active && !r.consent_form?.is_optional,
      );
      const unsignedHere = activeRequired.filter((r: any) => !r.signed);
      let stillMissing = unsignedHere.length;
      if (unsignedHere.length && clientEmail) {
        const { data: sigs } = await supabase
          .from("consent_signatures")
          .select("consent_form_id, decision, form_version, expires_at")
          .ilike("client_email", clientEmail)
          .in("consent_form_id", unsignedHere.map((r: any) => r.consent_form_id));
        const nowIso = new Date().toISOString();
        const satisfied = new Set(
          (sigs ?? [])
            .filter((s: any) => {
              const form = unsignedHere.find((r: any) => r.consent_form_id === s.consent_form_id)?.consent_form;
              return (
                s.decision === "consent" &&
                form && s.form_version === form.version &&
                (!s.expires_at || s.expires_at > nowIso)
              );
            })
            .map((s: any) => s.consent_form_id),
        );
        stillMissing = unsignedHere.filter((r: any) => !satisfied.has(r.consent_form_id)).length;
      }
      setUnsigned(stillMissing);
    })();
    return () => { cancel = true; };
  }, [appointmentId, clientEmail]);


  const showGfe = needsGfe && gfeOk === false;
  if (!showGfe && unsigned === 0) return null;

  return (
    <div className="space-y-2">
      {showGfe && (
        <div className="rounded-md border border-warning/30 bg-warning-soft dark:bg-warning-soft p-3 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-warning-soft-foreground mt-0.5 shrink-0" />
          <div className="text-sm flex-1">
            <div className="font-medium">Good Faith Exam missing or expired</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Booked for {serviceCategory} but no active GFE on file. Complete a GFE before treatment.
            </div>
          </div>
          <Link
            to={`/staff/clinical/gfe/new?email=${encodeURIComponent(clientEmail)}`}
            className="text-xs font-medium text-warning-soft-foreground dark:text-warning hover:underline whitespace-nowrap"
          >Conduct GFE →</Link>
        </div>
      )}
      {unsigned > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning-soft dark:bg-warning-soft p-3 flex items-start gap-2.5">
          <FileWarning className="h-4 w-4 text-warning-soft-foreground mt-0.5 shrink-0" />
          <div className="text-sm flex-1">
            <div className="font-medium">{unsigned} consent form{unsigned === 1 ? "" : "s"} not signed</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Capture signatures before starting the visit.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
