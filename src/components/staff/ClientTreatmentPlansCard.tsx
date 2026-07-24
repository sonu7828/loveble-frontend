import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { confirmDialog } from "@/components/ui/confirm";

type Plan = {
  id: string;
  name: string;
  total_sessions: number;
  sessions_used: number;
  status: string;
  purchased_at: string;
  expires_at: string | null;
  price_cents: number;
};

type Template = { id: string; name: string; total_sessions: number; price_cents: number; validity_days: number | null };

export function ClientTreatmentPlansCard({ clientEmail }: { clientEmail: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tplId, setTplId] = useState("");
  const [notes, setNotes] = useState("");
  const [expiresDays, setExpiresDays] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const selectedTpl = templates.find(t => t.id === tplId);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: t }] = await Promise.all([
      (supabase as any).from("client_treatment_plans")
        .select("id,name,total_sessions,sessions_used,status,purchased_at,expires_at,price_cents")
        .eq("client_email", clientEmail.toLowerCase()).order("purchased_at", { ascending: false }),
      (supabase as any).from("treatment_plan_templates").select("id,name,total_sessions,price_cents,validity_days").eq("is_active", true).order("name"),
    ]);
    setPlans(p ?? []);
    setTemplates(t ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [clientEmail]);

  const openSell = () => {
    setTplId(""); setNotes(""); setExpiresDays(""); setOpen(true);
  };

  const sell = async () => {
    if (!tplId) return;
    setBusy(true);
    const { data: newId, error } = await (supabase as any).rpc("purchase_treatment_plan", {
      _template_id: tplId, _client_email: clientEmail, _notes: notes || null,
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    const overrideDays = expiresDays.trim() ? parseInt(expiresDays, 10) : null;
    if (newId && overrideDays !== null && Number.isFinite(overrideDays) && overrideDays >= 0) {
      const newExpiry = overrideDays === 0
        ? null
        : new Date(Date.now() + overrideDays * 86400000).toISOString();
      const { error: upErr } = await (supabase as any)
        .from("client_treatment_plans")
        .update({ expires_at: newExpiry })
        .eq("id", newId);
      if (upErr) { setBusy(false); return toast.error(upErr.message); }
    }
    setBusy(false);
    toast.success("Plan added");
    setOpen(false); load();
  };

  const redeem = async (id: string) => {
    if (!(await confirmDialog({ title: "Redeem one session?", confirmLabel: "Redeem" }))) return;
    const { error } = await (supabase as any).rpc("redeem_treatment_plan_session", { _plan_id: id });
    if (error) return toast.error(error.message);
    toast.success("Session redeemed"); load();
  };

  const refund = async (id: string) => {
    const reason = window.prompt("Refund reason? (optional)") ?? null;
    const { error } = await (supabase as any).rpc("refund_treatment_plan", { _plan_id: id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Refunded"); load();
  };

  const active = plans.filter(p => p.status === "active");
  const past = plans.filter(p => p.status !== "active");

  return (
    <section className="rounded-2xl border border-border bg-card p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Package className="h-3 w-3"/>Treatment plans
        </h2>
        <Button size="sm" variant="ghost" onClick={openSell}>
          <Plus className="h-4 w-4 mr-1"/>Sell plan
        </Button>
      </div>

      {loading ? (
        <div className="py-4 flex justify-center"><Loader2 className="animate-spin h-4 w-4"/></div>
      ) : plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plans purchased.</p>
      ) : (
        <div className="space-y-2">
          {active.map(p => {
            const remaining = p.total_sessions - p.sessions_used;
            const pct = (p.sessions_used / p.total_sessions) * 100;
            return (
              <div key={p.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {remaining} of {p.total_sessions} sessions remaining
                      {p.expires_at && ` · expires ${format(new Date(p.expires_at), "MMM d, yyyy")}`}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => redeem(p.id)} disabled={remaining<=0}>
                      Redeem
                    </Button>
                    {p.sessions_used === 0 && (
                      <Button size="sm" variant="ghost" onClick={() => refund(p.id)}>Refund</Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }}/>
                </div>
              </div>
            );
          })}
          {past.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">{past.length} past plan{past.length>1?"s":""}</summary>
              <div className="mt-2 space-y-1">
                {past.map(p => (
                  <div key={p.id} className="flex justify-between py-1 border-b border-border/50">
                    <span>{p.name}</span>
                    <span className="capitalize flex items-center gap-1">
                      {p.status === "completed" && <CheckCircle2 className="h-3 w-3"/>}
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sell treatment plan</DialogTitle></DialogHeader>
          {templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No plan templates yet. Create one first (e.g. "3-Session Laser, $900, valid 365 days").
              </p>
              <Button asChild size="sm">
                <Link to="/staff/treatment-plans" onClick={() => setOpen(false)}>
                  <Plus className="h-4 w-4 mr-1"/> Create plan templates
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Plan</Label>
                <Select value={tplId} onValueChange={setTplId}>
                  <SelectTrigger><SelectValue placeholder="Choose plan…"/></SelectTrigger>
                  <SelectContent>
                    {templates.map(t=>(
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} — {t.total_sessions}× · ${(t.price_cents/100).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valid for (days)</Label>
                <Input
                  inputMode="numeric"
                  placeholder={
                    selectedTpl?.validity_days != null
                      ? `Default: ${selectedTpl.validity_days} days`
                      : "Default: no expiry"
                  }
                  value={expiresDays}
                  onChange={(e)=>setExpiresDays(e.target.value.replace(/[^0-9]/g,""))}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Leave blank to use the template default. Enter <span className="font-medium">0</span> for no expiry.
                </p>
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea placeholder="Internal notes" value={notes} onChange={(e)=>setNotes(e.target.value)}/>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button>
            {templates.length > 0 && (
              <Button onClick={sell} disabled={!tplId || busy}>{busy?"Saving…":"Add plan"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
