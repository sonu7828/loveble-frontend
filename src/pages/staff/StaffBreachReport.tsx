import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

type Report = {
  id: string;
  reporter_name: string | null;
  discovered_at: string;
  occurred_at: string | null;
  description: string;
  phi_involved: string | null;
  individuals_affected: number | null;
  systems_involved: string | null;
  immediate_actions: string | null;
  status: string;
  created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  investigating: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  closed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  reported_to_hhs: "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200",
};

export default function StaffBreachReport() {
  usePageMeta({ title: "Report a possible breach" });
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    occurred_at: "",
    description: "",
    phi_involved: "",
    individuals_affected: "",
    systems_involved: "",
    immediate_actions: "",
  });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("breach_reports" as any)
      .select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows(((data as any) ?? []) as Report[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!form.description.trim()) {
      toast({ title: "Description required", description: "Describe what happened.", variant: "destructive" });
      return;
    }
    if (!user) return;
    setSaving(true);
    const payload: any = {
      reporter_user_id: user.id,
      reporter_name: user.user_metadata?.full_name ?? null,
      reporter_email: user.email ?? null,
      occurred_at: form.occurred_at || null,
      description: form.description.trim(),
      phi_involved: form.phi_involved || null,
      individuals_affected: form.individuals_affected ? parseInt(form.individuals_affected, 10) : null,
      systems_involved: form.systems_involved || null,
      immediate_actions: form.immediate_actions || null,
    };
    const { error } = await supabase.from("breach_reports" as any).insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Submit failed", description: error.message, variant: "destructive" }); return; }
    toast({
      title: "Report filed",
      description: "The Privacy Officer has been notified. The record is now immutable.",
    });
    setForm({ occurred_at: "", description: "", phi_involved: "", individuals_affected: "", systems_involved: "", immediate_actions: "" });
    load();
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("breach_reports" as any).update({ status }).eq("id", id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    load();
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl flex items-center gap-2">
          <ShieldAlert className="h-7 w-7 text-red-600" /> Report a possible breach
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          File a HIPAA breach or incident report (45 CFR §164.400–414). Submissions are timestamped and
          immutable — only status may be updated by the Privacy Officer.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>File in good faith. If unsure whether it's a breach, file anyway — the Privacy Officer will assess.</div>
        </div>
        <div>
          <Label>What happened? *</Label>
          <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the incident in your own words." />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>When did it occur?</Label>
            <Input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} />
          </div>
          <div>
            <Label>Approx. individuals affected</Label>
            <Input type="number" min={0} value={form.individuals_affected}
              onChange={(e) => setForm({ ...form, individuals_affected: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>PHI involved</Label>
          <Input value={form.phi_involved} onChange={(e) => setForm({ ...form, phi_involved: e.target.value })}
            placeholder="e.g. names, DOB, chart notes, photos" />
        </div>
        <div>
          <Label>Systems / vendors involved</Label>
          <Input value={form.systems_involved} onChange={(e) => setForm({ ...form, systems_involved: e.target.value })}
            placeholder="e.g. laptop, email, Brevo, Twilio" />
        </div>
        <div>
          <Label>Immediate actions taken</Label>
          <Textarea rows={3} value={form.immediate_actions} onChange={(e) => setForm({ ...form, immediate_actions: e.target.value })}
            placeholder="e.g. revoked access, changed password, contacted vendor" />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Submit report
          </Button>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-xl mb-3">
          {isAdmin ? "All reports" : "My submitted reports"}
        </h2>
        {loading ? (
          <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No reports yet.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      Filed {new Date(r.created_at).toLocaleString()} by {r.reporter_name || "staff"}
                    </div>
                    <div className="text-sm mt-1 whitespace-pre-wrap">{r.description}</div>
                  </div>
                  <Badge className={STATUS_STYLE[r.status]} variant="outline">{r.status.replace("_", " ")}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs text-muted-foreground">
                  {r.occurred_at && <div>Occurred: {new Date(r.occurred_at).toLocaleString()}</div>}
                  {r.individuals_affected != null && <div># affected: {r.individuals_affected}</div>}
                  {r.phi_involved && <div>PHI: {r.phi_involved}</div>}
                  {r.systems_involved && <div>Systems: {r.systems_involved}</div>}
                </div>
                {r.immediate_actions && (
                  <div className="text-xs text-muted-foreground mt-2"><b>Actions:</b> {r.immediate_actions}</div>
                )}
                {isAdmin && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {["open", "investigating", "closed", "reported_to_hhs"].map((s) => (
                      <Button key={s} size="sm" variant={r.status === s ? "default" : "outline"}
                        onClick={() => updateStatus(r.id, s)}>
                        {s.replace("_", " ")}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
