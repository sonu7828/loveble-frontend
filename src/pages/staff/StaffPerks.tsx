import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2, Gift, Cake, Sparkles, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Settings = {
  id?: number;
  perks_birthday_enabled: boolean;
  perks_birthday_amount_cents: number;
  perks_birthday_validity_days: number;
  perks_anniversary_enabled: boolean;
  perks_anniversary_amount_cents: number;
  perks_anniversary_validity_days: number;
};

type Grant = {
  id: string;
  client_email: string;
  perk_kind: string;
  perk_year: number;
  amount_cents: number;
  email_sent_at: string | null;
  created_at: string;
};

export default function StaffPerks() {
  const { isAdmin, loading } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setBusy(true);
    const [s, g] = await Promise.all([
      supabase.from("app_settings").select("id, perks_birthday_enabled, perks_birthday_amount_cents, perks_birthday_validity_days, perks_anniversary_enabled, perks_anniversary_amount_cents, perks_anniversary_validity_days").limit(1).maybeSingle(),
      supabase.from("perk_grants").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (s.data) setSettings(s.data as Settings);
    if (g.data) setGrants(g.data as Grant[]);
    setBusy(false);
  };

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) { setBusy(false); return; }
    load();
  }, [loading, isAdmin]);

  if (loading) return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").update({
      perks_birthday_enabled: settings.perks_birthday_enabled,
      perks_birthday_amount_cents: settings.perks_birthday_amount_cents,
      perks_birthday_validity_days: settings.perks_birthday_validity_days,
      perks_anniversary_enabled: settings.perks_anniversary_enabled,
      perks_anniversary_amount_cents: settings.perks_anniversary_amount_cents,
      perks_anniversary_validity_days: settings.perks_anniversary_validity_days,
    }).eq("id", settings.id!);
    if (error) toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    else toast({ title: "Saved" });
    setSaving(false);
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-perks");
      if (error) throw error;
      const granted = (data as any)?.granted?.length ?? 0;
      toast({ title: "Perks run complete", description: `${granted} new voucher(s) issued.` });
      await load();
    } catch (e: any) {
      toast({ title: "Run failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
    setRunning(false);
  };

  if (busy || !settings) return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" />
            Birthday & anniversary perks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automatically issue a comp voucher and email clients on their birthday and their 1-year first-visit anniversary.
          </p>
        </div>
        <Button variant="outline" onClick={runNow} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Run now
        </Button>
      </header>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <PerkCard
          icon={<Cake className="h-5 w-5 text-destructive-soft-foreground" />}
          title="Birthday gift"
          enabled={settings.perks_birthday_enabled}
          amount={settings.perks_birthday_amount_cents}
          validity={settings.perks_birthday_validity_days}
          onChange={(patch) => setSettings({ ...settings, ...patch })}
          enabledKey="perks_birthday_enabled"
          amountKey="perks_birthday_amount_cents"
          validityKey="perks_birthday_validity_days"
        />
        <PerkCard
          icon={<Sparkles className="h-5 w-5 text-warning-soft-foreground" />}
          title="1-year anniversary"
          enabled={settings.perks_anniversary_enabled}
          amount={settings.perks_anniversary_amount_cents}
          validity={settings.perks_anniversary_validity_days}
          onChange={(patch) => setSettings({ ...settings, ...patch })}
          enabledKey="perks_anniversary_enabled"
          amountKey="perks_anniversary_amount_cents"
          validityKey="perks_anniversary_validity_days"
        />
      </div>

      <div className="flex justify-end mb-8">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save settings
        </Button>
      </div>

      <h2 className="text-lg font-medium mb-3">Recent issuances</h2>
      {grants.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No vouchers issued yet.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {grants.map(g => (
            <div key={g.id} className="p-3 flex items-center gap-3 text-sm">
              <span className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded ${g.perk_kind === "birthday" ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-warning-soft text-warning-soft-foreground"}`}>
                {g.perk_kind}
              </span>
              <span className="font-medium flex-1 truncate">{g.client_email}</span>
              <span className="text-muted-foreground">${(g.amount_cents / 100).toFixed(0)}</span>
              <span className="text-xs text-muted-foreground">{format(new Date(g.created_at), "MMM d")}</span>
              <span className={`text-xs ${g.email_sent_at ? "text-success-soft-foreground" : "text-muted-foreground"}`}>
                {g.email_sent_at ? "✓ emailed" : "pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PerkCard(props: {
  icon: React.ReactNode;
  title: string;
  enabled: boolean;
  amount: number;
  validity: number;
  enabledKey: string;
  amountKey: string;
  validityKey: string;
  onChange: (p: Record<string, any>) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-medium">{props.icon}{props.title}</div>
        <Switch
          checked={props.enabled}
          onCheckedChange={(v) => props.onChange({ [props.enabledKey]: v })}
        />
      </div>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Voucher amount ($)</Label>
          <Input
            type="number"
            min={1}
            value={props.amount / 100}
            onChange={(e) => props.onChange({ [props.amountKey]: Math.round(Number(e.target.value || 0) * 100) })}
          />
        </div>
        <div>
          <Label className="text-xs">Valid for (days)</Label>
          <Input
            type="number"
            min={1}
            value={props.validity}
            onChange={(e) => props.onChange({ [props.validityKey]: Number(e.target.value || 0) })}
          />
        </div>
      </div>
    </div>
  );
}
