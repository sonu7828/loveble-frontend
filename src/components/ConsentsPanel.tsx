import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileCheck2, FileX2, Download, RefreshCw, AlertCircle, Mail, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

interface SigRow {
  id: string;
  consent_form_id: string;
  signed_full_name: string;
  signature_png: string | null;
  signed_at: string;
  decision: string;
  form_version: number;
  expires_at?: string | null;
  appointment_id?: string | null;
  consent_forms?: { title: string; slug: string; version?: number };
}

interface AssignedRow {
  consent_form_id: string;
  signed: boolean;
  consent_forms: { id: string; title: string; slug: string; is_optional: boolean; is_active: boolean; is_universal: boolean; version: number };
}

interface UnifiedConsent {
  form_id: string;
  title: string;
  is_optional: boolean;
  is_universal: boolean;
  signed: boolean;
  procedures: string[];
  signature?: SigRow;
  priorSignature?: SigRow; // satisfied by signature from a different appointment
  validUntil?: string | null;
}

interface Props {
  appointmentId: string;
  initialPdfUrl?: string | null;
}

export function ConsentsPanel({ appointmentId, initialPdfUrl }: Props) {
  const [items, setItems] = useState<UnifiedConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialPdfUrl ?? null);
  const [regen, setRegen] = useState(false);
  const [emailLog, setEmailLog] = useState<any[]>([]);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1) Booked services for procedure-mapping labels
      const { data: apsv } = await supabase
        .from("appointment_services")
        .select("service_id, services(name)")
        .eq("appointment_id", appointmentId);
      const services = (apsv ?? []).map((r: any) => ({ id: r.service_id, name: r.services?.name ?? "" }));
      const serviceIds = services.map((s) => s.id);
      const nameById = new Map(services.map((s) => [s.id, s.name]));

      // Also resolve the client_email so we can look up prior signatures from other appointments
      const { data: apptRow } = await supabase
        .from("appointments")
        .select("client_email")
        .eq("id", appointmentId)
        .maybeSingle();
      const clientEmail = (apptRow?.client_email ?? "").toLowerCase();

      const [assignedRes, sigRes, scRes] = await Promise.all([
        supabase
          .from("appointment_consents")
          .select("consent_form_id, signed, consent_forms!inner(id, title, slug, is_optional, is_active, is_universal, version)")
          .eq("appointment_id", appointmentId),
        supabase
          .from("consent_signatures")
          .select("id, consent_form_id, signed_full_name, signature_png, signed_at, decision, form_version, expires_at, appointment_id, consent_forms!inner(title, slug)")
          .eq("appointment_id", appointmentId)
          .order("signed_at", { ascending: true }),
        serviceIds.length
          ? supabase.from("service_consents").select("service_id, consent_form_id").in("service_id", serviceIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const assigned = (assignedRes.data ?? []) as AssignedRow[];
      const sigs = (sigRes.data ?? []) as SigRow[];
      const sigByForm = new Map<string, SigRow>();
      for (const s of sigs) {
        if (!sigByForm.has(s.consent_form_id)) sigByForm.set(s.consent_form_id, s);
      }

      // Pull prior signatures (any appointment) for forms not signed in this one
      const missingFromAppt = assigned
        .filter((a) => !sigByForm.has(a.consent_form_id))
        .map((a) => a.consent_form_id);
      const priorByForm = new Map<string, SigRow>();
      if (clientEmail && missingFromAppt.length) {
        const { data: prior } = await supabase
          .from("consent_signatures")
          .select("id, consent_form_id, signed_full_name, signature_png, signed_at, decision, form_version, expires_at, appointment_id")
          .eq("client_email", clientEmail)
          .in("consent_form_id", missingFromAppt)
          .neq("appointment_id", appointmentId)
          .order("signed_at", { ascending: false });
        const nowMs = Date.now();
        const versionByForm = new Map(assigned.map((a) => [a.consent_form_id, a.consent_forms?.version]));
        for (const s of (prior ?? []) as SigRow[]) {
          if (s.decision !== "consent") continue;
          if (s.form_version !== versionByForm.get(s.consent_form_id)) continue;
          if (s.expires_at && new Date(s.expires_at).getTime() <= nowMs) continue;
          if (!priorByForm.has(s.consent_form_id)) priorByForm.set(s.consent_form_id, s);
        }
      }

      const procMap = new Map<string, Set<string>>();
      for (const r of scRes.data ?? []) {
        const set = procMap.get((r as any).consent_form_id) ?? new Set<string>();
        const nm = nameById.get((r as any).service_id);
        if (nm) set.add(nm);
        procMap.set((r as any).consent_form_id, set);
      }
      const allNames = services.map((s) => s.name).filter(Boolean);

      // Build the unified list from assigned. Also include any signature whose form isn't in assigned (defensive).
      const seen = new Set<string>();
      const unified: UnifiedConsent[] = [];
      for (const a of assigned) {
        if (!a.consent_forms?.is_active) continue;
        const cf = a.consent_forms;
        seen.add(cf.id);
        const sig = sigByForm.get(cf.id);
        const prior = !sig ? priorByForm.get(cf.id) : undefined;
        unified.push({
          form_id: cf.id,
          title: cf.title,
          is_optional: !!cf.is_optional,
          is_universal: !!cf.is_universal,
          signed: !!a.signed || !!sig || !!prior,
          procedures: cf.is_universal ? allNames : Array.from(procMap.get(cf.id) ?? []),
          signature: sig,
          priorSignature: prior,
          validUntil: (sig?.expires_at ?? prior?.expires_at) ?? null,
        });
      }
      for (const s of sigs) {
        if (seen.has(s.consent_form_id)) continue;
        unified.push({
          form_id: s.consent_form_id,
          title: s.consent_forms?.title ?? "Consent form",
          is_optional: false,
          is_universal: false,
          signed: true,
          procedures: [],
          signature: s,
          validUntil: s.expires_at ?? null,
        });
      }
      unified.sort((a, b) =>
        Number(a.signed) - Number(b.signed) ||
        Number(a.is_optional) - Number(b.is_optional) ||
        a.title.localeCompare(b.title),
      );
      setItems(unified);

      // Email send log for this appointment
      const { data: logRows } = await supabase
        .from("consent_email_log")
        .select("id, recipient_email, template_name, source, status, error_message, reminder_number, forms_count, created_at")
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: false })
        .limit(50);
      // Dedupe by idempotency_key+status by collapsing per-form rows from the same send
      const grouped = new Map<string, any>();
      for (const r of logRows ?? []) {
        const key = `${r.created_at}|${r.source}|${r.status}`;
        if (!grouped.has(key)) grouped.set(key, r);
      }
      setEmailLog(Array.from(grouped.values()));

      setLoading(false);
    })();
  }, [appointmentId]);

  const regenerate = async () => {
    setRegen(true);
    const { data, error } = await supabase.functions.invoke("generate-consent-pdf", {
      body: { appointmentId },
    });
    setRegen(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Could not generate PDF");
      return;
    }
    setPdfUrl(data.url);
    toast.success("PDF regenerated");
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading consents…</div>;
  }
  if (!items.length) {
    return <div className="text-xs text-muted-foreground">No consent forms assigned to this appointment yet.</div>;
  }

  const signedCount = items.filter((i) => i.signed).length;
  const pendingRequired = items.filter((i) => !i.signed && !i.is_optional);
  const pendingOptional = items.filter((i) => !i.signed && i.is_optional);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
            Consents · {signedCount}/{items.length} signed
          </h3>
          {pendingRequired.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning-soft text-warning-soft-foreground">
              <AlertCircle className="h-3 w-3" />{pendingRequired.length} awaiting signature
            </span>
          )}
          {pendingOptional.length > 0 && pendingRequired.length === 0 && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {pendingOptional.length} optional pending
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {pdfUrl && (
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <a href={pdfUrl} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5 mr-1" />PDF</a>
            </Button>
          )}
          <Button onClick={regenerate} disabled={regen} size="sm" variant="ghost" className="rounded-full">
            {regen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5 mr-1" />Regenerate</>}
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        {items.map((c) => {
          const declined = c.signature?.decision === "decline";
          return (
            <div
              key={c.form_id}
              className={`rounded-xl border p-3 ${
                c.signed
                  ? "border-border bg-card"
                  : c.is_optional
                    ? "border-border bg-secondary/30"
                    : "border-warning/30 bg-warning-soft/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    {c.signed
                      ? (declined
                          ? <FileX2 className="h-3.5 w-3.5 text-warning-soft-foreground shrink-0" />
                          : <FileCheck2 className="h-3.5 w-3.5 text-success-soft-foreground shrink-0" />)
                      : <AlertCircle className="h-3.5 w-3.5 text-warning-soft-foreground shrink-0" />}
                    <span className="truncate">{c.title}</span>
                    {c.is_optional && (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5">Optional</span>
                    )}
                    {c.signature && (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">v{c.signature.form_version}</span>
                    )}
                  </div>
                  {c.procedures.length > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {c.is_universal ? "Required for all procedures" : `For: ${c.procedures.join(", ")}`}
                    </div>
                  )}
                  {c.signature ? (
                    <div className="text-xs text-muted-foreground mt-1">
                      {declined ? "DECLINED · " : ""}
                      {c.signature.signed_full_name} · {format(new Date(c.signature.signed_at), "MMM d, yyyy h:mm a")}
                      {c.validUntil && (
                        <span> · valid through {format(new Date(c.validUntil), "MMM d, yyyy")}</span>
                      )}
                    </div>
                  ) : c.priorSignature ? (
                    <div className="text-xs text-success-soft-foreground mt-1">
                      Auto-satisfied · signed {format(new Date(c.priorSignature.signed_at), "MMM d, yyyy")} (v{c.priorSignature.form_version})
                      {c.priorSignature.expires_at && (
                        <span> · valid through {format(new Date(c.priorSignature.expires_at), "MMM d, yyyy")}</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-warning-soft-foreground mt-1">
                      {c.is_optional ? "Awaiting client decision" : "Awaiting client signature"}
                    </div>
                  )}
                </div>
                {c.signature?.signature_png && (
                  <img
                    src={c.signature.signature_png}
                    alt="Signature"
                    className="h-12 w-32 object-contain bg-background rounded border border-border shrink-0"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-3">
        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            Email delivery log · {emailLog.length}
          </span>
          <span className="text-[10px] normal-case tracking-normal">{showLog ? "Hide" : "Show"}</span>
        </button>
        {showLog && (
          emailLog.length === 0 ? (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
              <MailX className="h-3.5 w-3.5" />
              No consent emails have been sent for this appointment yet.
            </div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {emailLog.map((r) => (
                <li key={r.id} className="text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                    r.status === "sent" ? "bg-success" : r.status === "failed" ? "bg-destructive" : "bg-warning"
                  }`} />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {format(new Date(r.created_at), "MMM d, h:mm a")}
                  </span>
                  <span className="text-foreground">{r.template_name}</span>
                  <span className="text-muted-foreground">→ {r.recipient_email}</span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {r.source}{r.reminder_number ? ` #${r.reminder_number}` : ""}
                  </span>
                  {r.status !== "sent" && (
                    <span className="text-[11px] text-destructive-soft-foreground">{r.status}{r.error_message ? `: ${r.error_message}` : ""}</span>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}
