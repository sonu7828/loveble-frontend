import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Settings = {
  earn_dollars_per_point: number;
  point_value_cents: number;
  max_redemption_pct: number;
  inactivity_expiry_months: number;
  block_promo_combo: boolean;
  is_enabled: boolean;
};

type LedgerRow = {
  id: string;
  client_email: string;
  delta: number;
  reason: string;
  notes: string | null;
  created_at: string;
};

type BalanceRow = { client_email: string; balance: number; last_activity_at: string };

export default function AdminRewards() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);

  const load = async () => {
    setLoading(true);
    const [s, l, b] = await Promise.all([
      supabase.from("client_points_settings" as any).select("*").eq("id", true).maybeSingle(),
      supabase
        .from("client_points_ledger" as any)
        .select("id, client_email, delta, reason, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("client_points_balances" as any)
        .select("client_email, balance, last_activity_at")
        .order("balance", { ascending: false })
        .limit(25),
    ]);
    if (s.data) setSettings(s.data as any);
    if (l.data) setLedger(l.data as any);
    if (b.data) setBalances(b.data as any);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin) load();
  }, [authLoading, isAdmin]);

  if (authLoading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("client_points_settings" as any)
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq("id", true);
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved" });
  };

  const fmtPts = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <header className="flex items-center gap-3">
        <Star className="h-5 w-5 text-primary" />
        <div>
          <h1 className="font-serif text-2xl">Rewards & Loyalty</h1>
          <p className="text-sm text-muted-foreground">Clients earn points on service spend and redeem at checkout.</p>
        </div>
      </header>

      {/* Settings */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Program settings</h2>
          {settings && (
            <div className="flex items-center gap-2">
              <Label htmlFor="enabled" className="text-sm">Enabled</Label>
              <Switch id="enabled" checked={settings.is_enabled} onCheckedChange={(v) => setSettings({ ...settings, is_enabled: v })} />
            </div>
          )}
        </div>
        {loading || !settings ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Earn rate — dollars per 1 point" hint="Default: $10 = 1 pt">
                <Input type="number" min={1} value={settings.earn_dollars_per_point}
                  onChange={(e) => setSettings({ ...settings, earn_dollars_per_point: Number(e.target.value) || 1 })} />
              </Field>
              <Field label="Point value (cents)" hint="Default: 1 pt = 10¢ ($0.10)">
                <Input type="number" min={1} value={settings.point_value_cents}
                  onChange={(e) => setSettings({ ...settings, point_value_cents: Number(e.target.value) || 1 })} />
              </Field>
              <Field label="Max redemption (% of bill)" hint="Default: 50%">
                <Input type="number" min={1} max={100} value={settings.max_redemption_pct}
                  onChange={(e) => setSettings({ ...settings, max_redemption_pct: Number(e.target.value) || 50 })} />
              </Field>
              <Field label="Inactivity expiry (months)" hint="Points expire after this many months of no activity">
                <Input type="number" min={1} value={settings.inactivity_expiry_months}
                  onChange={(e) => setSettings({ ...settings, inactivity_expiry_months: Number(e.target.value) || 12 })} />
              </Field>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-3">
                <Switch checked={settings.block_promo_combo} onCheckedChange={(v) => setSettings({ ...settings, block_promo_combo: v })} />
                <div>
                  <div className="text-sm">Block combining with other promos / discount codes</div>
                  <div className="text-xs text-muted-foreground">Recommended on. Prevents stacking points with promo codes.</div>
                </div>
              </div>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
            </div>
          </>
        )}
      </section>

      {/* Top balances */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium mb-3">Top client balances</h2>
        {balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">No client balances yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="text-left py-2">Client</th><th className="text-right">Points</th><th className="text-right">Value</th><th className="text-right">Last activity</th></tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.client_email} className="border-t border-border">
                    <td className="py-2">{b.client_email}</td>
                    <td className="text-right">{b.balance}</td>
                    <td className="text-right">${((b.balance * (settings?.point_value_cents ?? 10)) / 100).toFixed(2)}</td>
                    <td className="text-right text-muted-foreground">{new Date(b.last_activity_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium mb-3">Recent activity</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="text-left py-2">When</th><th className="text-left">Client</th><th className="text-left">Reason</th><th className="text-right">Δ Points</th><th className="text-left">Notes</th></tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.client_email}</td>
                    <td className="capitalize">{r.reason.replace("_", " ")}</td>
                    <td className={`text-right font-medium ${r.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtPts(r.delta)}</td>
                    <td className="text-muted-foreground">{r.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

