// Clinical inbox — simplified. Everything lives in the patient's chart.
// This page is just: find a patient, plus urgent alerts (cosign queue, expiring GFEs).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ShieldAlert, FileText, ShieldCheck, Search, Calendar as CalIcon, AlertTriangle, ClipboardPlus, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchIncompleteCharts, type IncompleteChart } from "@/lib/incompleteCharts";

export default function StaffClinical() {
  const { user, isClinicalStaff, isNP, isMedicalDirector, isAdmin, canSeeAll, staffId, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsCosign, setNeedsCosign] = useState<any[]>([]);
  const [expiringGfes, setExpiringGfes] = useState<any[]>([]);
  const [incomplete, setIncomplete] = useState<IncompleteChart[]>([]);
  const [incompleteError, setIncompleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || authLoading) return;
    (async () => {
      setLoading(true);
      setIncompleteError(null);
      try {
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 86400000).toISOString();
        const [cosRes, gexRes, incompleteRows] = await Promise.all([
          supabase.from("clinical_notes").select("*").eq("status", "signed").eq("requires_cosign", true).order("signed_at", { ascending: false }).limit(50),
          supabase.from("gfe_records").select("id, client_email, client_first_name, client_last_name, np_name, expires_at").gte("expires_at", now.toISOString()).lt("expires_at", in30).order("expires_at").limit(20),
          fetchIncompleteCharts({ canSeeAll, staffId }),
        ]);
        if (cosRes.error) console.error("[StaffClinical] cosign query error:", cosRes.error);
        if (gexRes.error) console.error("[StaffClinical] gfe query error:", gexRes.error);
        const cos = cosRes.data;
        const gex = gexRes.data;
        setNeedsCosign(cos ?? []);
        setExpiringGfes(gex ?? []);
        setIncomplete(incompleteRows);
      } catch (e) {
        console.error("[StaffClinical] load failed:", e);
        setIncompleteError(e instanceof Error ? e.message : "Incomplete charts could not be loaded.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, canSeeAll, staffId]);

  if (authLoading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isClinicalStaff && !canSeeAll) {
    return (
      <div className="max-w-md mx-auto p-10 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 mx-auto text-warning" />
        <p className="text-sm text-muted-foreground">Clinical staff role required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Clinical Documentation</div>
        <h1 className="text-2xl font-serif">Charts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every patient has one chart. GFE, chart notes, photos, and consents all live there.
        </p>
      </div>

      {/* Incomplete charts — first thing staff need to see */}
      {loading ? (
        <div className="rounded-lg border border-warning/30 bg-warning-soft/40 p-5 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-warning-soft-foreground" />
          <p className="text-sm text-muted-foreground">Loading incomplete charts…</p>
        </div>
      ) : incomplete.length > 0 ? (
        <Section title={`Incomplete charts (${incomplete.length})`} accent>
          <p className="text-[11px] text-muted-foreground -mt-1">
            All past appointments with missing chart notes or unsigned consents.
          </p>

          {incomplete.map((row) => {
            const a = row.appointment;
            const reasons: string[] = [];
            if (row.missingNote) reasons.push("Chart note");
            if (row.unsignedConsents > 0) reasons.push(`${row.unsignedConsents} unsigned consent${row.unsignedConsents > 1 ? "s" : ""}`);
            return (
              <div
                key={a.id}
                className="rounded-md border border-warning/30 bg-warning-soft/40 p-3 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className="h-4 w-4 text-warning-soft-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a.client_first_name} {a.client_last_name}{" "}
                        <span className="text-muted-foreground">— {reasons.join(" • ")}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.client_email}{a.staff_name ? ` • ${a.staff_name}` : ""} • {format(new Date(a.end_at), "PP")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {row.missingNote && (
                      <Button asChild size="sm" className="rounded-full">
                        <Link to={`/staff/clinical/notes/new?appointment=${a.id}`}>
                          <ClipboardPlus className="h-3.5 w-3.5 mr-1.5" />Complete chart
                        </Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <Link to={`/staff/appointments/${a.id}`}>
                        Open appointment<ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </Section>
      ) : incompleteError ? (
        <Section title="Incomplete charts" accent>
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Could not load incomplete charts: {incompleteError}
          </p>
        </Section>
      ) : (
        <Section title="Incomplete charts">
          <p className="rounded-md border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            No incomplete charts. 🎉
          </p>
        </Section>
      )}

      {/* Open a patient's chart */}
      <div className="rounded-lg border border-border bg-secondary/30 p-5 space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Open a patient chart</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = lookup.trim().toLowerCase();
            if (v) navigate(`/staff/clinical/clients/${encodeURIComponent(v)}`);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="Patient email…"
              type="email"
              className="pl-8"
            />
          </div>
          <Button type="submit" size="sm">Open chart</Button>
        </form>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link to="/staff/today"><CalIcon className="h-4 w-4 mr-2" />Today's schedule</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/staff/clients"><Search className="h-4 w-4 mr-2" />Browse all clients</Link>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Tip: every appointment has <span className="font-medium">Conduct GFE</span> and <span className="font-medium">Add chart note</span> buttons at the top — both save into the patient's chart.
          {isNP && <> NPs can sign a GFE anytime — it stays valid for 12 months.</>}
        </p>
      </div>

      {!loading && (
        <>
          {(isNP || isMedicalDirector || isAdmin) && needsCosign.length > 0 && (
            <Section title={`Awaiting co-signature (${needsCosign.length})`} accent>
              {needsCosign.map(n => <NoteRow key={n.id} n={n} />)}
            </Section>
          )}


          {expiringGfes.length > 0 && (
            <Section title="GFEs expiring soon">
              {expiringGfes.map(g => (
                <Link key={g.id} to={`/staff/clinical/clients/${encodeURIComponent(g.client_email)}`} className="block rounded-md border border-border p-3 hover:border-primary/40 transition">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{g.client_first_name} {g.client_last_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{g.client_email} • by {g.np_name}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">Expires {format(new Date(g.expires_at), "PP")}</span>
                  </div>
                </Link>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className={`text-xs uppercase tracking-widest ${accent ? "text-warning-soft-foreground" : "text-muted-foreground"}`}>{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function NoteRow({ n }: { n: any }) {
  const cls =
    n.status === "cosigned" || n.status === "locked" ? "bg-success-soft text-success-soft-foreground" :
    n.status === "signed" ? "bg-warning-soft text-warning-soft-foreground" :
    "bg-secondary text-muted-foreground";
  return (
    <Link to={`/staff/clinical/notes/${n.id}`} className="block rounded-md border border-border p-3 hover:border-primary/40 hover:bg-secondary/40 transition">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{n.client_first_name} {n.client_last_name} <span className="text-muted-foreground">— {n.service_name ?? n.category}</span></p>
            <p className="text-xs text-muted-foreground truncate">{n.provider_name} • {format(new Date(n.created_at), "PPP p")}</p>
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${cls}`}>{n.status}</span>
      </div>
    </Link>
  );
}
