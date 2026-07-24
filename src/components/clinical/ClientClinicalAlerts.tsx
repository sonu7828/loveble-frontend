// Sticky clinical alerts banner for a single client.
// Pulls allergies / meds / pregnancy from latest GFE + latest intake submission,
// plus unresolved adverse events and VO suspected runs, and renders critical
// flags providers must see before starting any visit.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeInteractionAlerts, type SafetyAlert } from "@/lib/interactionAlerts";
import { AlertTriangle, AlertCircle, Info, ShieldAlert, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AllergyMedQuickEdit } from "./AllergyMedQuickEdit";


interface Props {
  clientEmail: string;
  /** Optional: tailor med-interaction alerts to the service being booked/charted. */
  category?: "neurotoxin" | "filler" | "energy" | "wellness" | null;
  serviceName?: string | null;
  /** When true, sticks to the top of the scroll container. */
  sticky?: boolean;
}

export function ClientClinicalAlerts({ clientEmail, category = null, serviceName = null, sticky = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [aeCount, setAeCount] = useState(0);
  const [openAEs, setOpenAEs] = useState<any[]>([]);
  const [voCount, setVoCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [lastIntakeAt, setLastIntakeAt] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    const email = (clientEmail || "").toLowerCase().trim();
    if (!email) { setLoading(false); return; }
    setLoading(true);


    const [{ data: g }, { data: i }, { data: ae }, { data: vo }] = await Promise.all([
      supabase.from("gfe_records")
        .select("allergies, allergies_other, current_medications, current_medications_other, pregnancy_status, medical_history, medical_history_other, signed_at")
        .ilike("client_email", email).order("signed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("client_intake_submissions")
        .select("allergies, allergies_other, current_medications, current_medications_other, pregnancy_status, medical_history, medical_history_other, changes_meds, changes_allergies, changes_history, changes_pregnancy, recent_illness_or_event, submitted_at")
        .ilike("client_email", email).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("adverse_events")
        .select("id, event_type, severity, body_region, product_involved, event_date, resolved_at, outcome")
        .ilike("client_email", email).order("event_date", { ascending: false }),
      supabase.from("vo_protocol_runs")
        .select("id, status")
        .ilike("client_email", email).limit(20),
    ]);

    const allergies = [
      ...((g as any)?.allergies ?? []),
      ((g as any)?.allergies_other ?? ""),
      ...((i as any)?.allergies ?? []),
      ((i as any)?.allergies_other ?? ""),
    ].filter(Boolean) as string[];
    const meds = [
      ...((g as any)?.current_medications ?? []),
      ((g as any)?.current_medications_other ?? ""),
      ...((i as any)?.current_medications ?? []),
      ((i as any)?.current_medications_other ?? ""),
      ((i as any)?.recent_illness_or_event ?? ""),
    ].filter(Boolean) as string[];

    const computed = computeInteractionAlerts({ category, serviceName, meds, allergies });

    const pregnancy = ((i as any)?.pregnancy_status ?? (g as any)?.pregnancy_status ?? "").toString().toLowerCase().trim();
    // Whitelist: only flag when status is explicitly one of the concerning options.
    // Anything else (including "Not pregnant", "Not applicable", blank) is ignored.
    const concerningPregnancy =
      pregnancy === "pregnant" ||
      pregnancy === "breastfeeding" ||
      pregnancy === "trying to conceive" ||
      /\b(currently pregnant|actively breastfeed|actively nursing|lactating)\b/.test(pregnancy);
    if (concerningPregnancy && !computed.some(a => /pregnan/i.test(a.message))) {
      computed.unshift({ severity: "critical", message: `Pregnancy status on file: "${pregnancy}". Confirm before any injectable or laser.` });
    }


    if ((i as any)?.changes_meds || (i as any)?.changes_allergies || (i as any)?.changes_history || (i as any)?.changes_pregnancy) {
      const which = [
        (i as any)?.changes_meds && "medications",
        (i as any)?.changes_allergies && "allergies",
        (i as any)?.changes_history && "medical history",
        (i as any)?.changes_pregnancy && "pregnancy status",
      ].filter(Boolean).join(", ");
      computed.unshift({ severity: "warning", message: `Patient reported recent changes on pre-visit check-in: ${which}. Review before treating.` });
    }

    if (!g) {
      computed.unshift({ severity: "warning", message: "No GFE on file for this patient yet." });
    }

    const aes = (ae ?? []) as any[];
    const open = aes.filter(x => !x.resolved_at);
    setOpenAEs(open);
    setAeCount(aes.length);
    const openVo = (vo ?? []).filter((x: any) => x.status && x.status !== "resolved" && x.status !== "cancelled");
    setVoCount(openVo.length);

    if (open.length > 0) {
      computed.unshift({
        severity: "critical",
        message: `${open.length} unresolved adverse event${open.length === 1 ? "" : "s"} on chart — review history before re-treating.`,
      });
    }
    if (openVo.length > 0) {
      computed.unshift({
        severity: "critical",
        message: `Active vascular occlusion protocol run on file — confirm resolution before any further filler.`,
      });
    }

    setLastIntakeAt((i as any)?.submitted_at ?? null);
    setAlerts(computed);
    setLoading(false);
  }, [clientEmail, category, serviceName]);

  useEffect(() => { load(); }, [load, reloadKey]);


  if (loading || alerts.length === 0) return null;

  const critical = alerts.filter(a => a.severity === "critical").length;
  const warning = alerts.filter(a => a.severity === "warning").length;
  const tone = critical > 0 ? "destructive" : warning > 0 ? "warning" : "muted";
  const wrapTone =
    tone === "destructive" ? "border-destructive/40 bg-destructive/5" :
    tone === "warning" ? "border-warning/40 bg-warning-soft" :
    "border-border bg-secondary/40";

  return (
    <div className={`${sticky ? "sticky top-0 z-20 -mx-6 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80" : ""}`}>
      <div className={`rounded-xl border ${wrapTone} p-3`}>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className="flex-1 flex items-center justify-between gap-2 text-left"
            aria-expanded={!collapsed}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className={`h-4 w-4 ${critical > 0 ? "text-destructive" : "text-warning-soft-foreground"}`} />
              Clinical alerts
              <span className="text-xs font-normal text-muted-foreground">
                {critical > 0 && `${critical} critical`}
                {critical > 0 && warning > 0 && " · "}
                {warning > 0 && `${warning} warning${warning === 1 ? "" : "s"}`}
              </span>
            </div>
            {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
            className="text-[11px] font-medium inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 hover:bg-muted transition-colors shrink-0"
            title="Quick-edit allergies & medications"
          >
            <Pencil className="h-3 w-3" /> Update
          </button>
        </div>

        {!collapsed && (
          <div className="mt-2 space-y-2">
            <ul className="space-y-1.5">
              {alerts.map((a, idx) => {
                const Icon = a.severity === "critical" ? AlertCircle : a.severity === "warning" ? AlertTriangle : Info;
                const t =
                  a.severity === "critical" ? "text-destructive" :
                  a.severity === "warning" ? "text-warning-soft-foreground dark:text-warning" :
                  "text-muted-foreground";
                return (
                  <li key={idx} className={`flex items-start gap-2 text-sm ${t}`}>
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{a.message}</span>
                  </li>
                );
              })}
            </ul>
            <div className="text-[11px] text-muted-foreground border-t border-border/60 pt-2 flex flex-wrap gap-x-3 gap-y-1">
              {lastIntakeAt && <span>Intake updated {formatDistanceToNow(new Date(lastIntakeAt), { addSuffix: true })}</span>}
              {aeCount > 0 && <span>{aeCount} prior adverse event{aeCount === 1 ? "" : "s"} ({openAEs.length} open)</span>}
              {voCount > 0 && <span className="text-destructive">VO protocol active</span>}
            </div>
          </div>
        )}
      </div>
      <AllergyMedQuickEdit
        open={editOpen}
        onOpenChange={setEditOpen}
        clientEmail={clientEmail}
        onSaved={() => setReloadKey(k => k + 1)}
      />
    </div>
  );
}

