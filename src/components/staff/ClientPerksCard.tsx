// Staff-only tag editor: mark a client as Healthcare worker or Friend so the
// checkout Eligibility strip auto-suggests the right discount.
import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Props = { clientEmail: string };

type Perks = { is_healthcare_worker: boolean; is_friend: boolean };

export function ClientPerksCard({ clientEmail }: Props) {
  const email = clientEmail.toLowerCase();
  const [perks, setPerks] = useState<Perks>({ is_healthcare_worker: false, is_friend: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("client_perks" as any)
        .select("is_healthcare_worker, is_friend")
        .eq("client_email", email)
        .maybeSingle();
      if (!cancelled) {
        const row = (data as any) || {};
        setPerks({
          is_healthcare_worker: !!row.is_healthcare_worker,
          is_friend: !!row.is_friend,
        });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [email]);

  const toggle = async (key: keyof Perks, value: boolean) => {
    const prev = perks;
    setPerks({ ...perks, [key]: value });
    setSaving(key);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("client_perks" as any)
      .upsert(
        {
          client_email: email,
          ...perks,
          [key]: value,
          updated_by: userRes.user?.id ?? null,
        },
        { onConflict: "client_email" },
      );
    setSaving(null);
    if (error) {
      setPerks(prev);
      toast.error(error.message);
    } else {
      toast.success(value ? "Perk added" : "Perk removed");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Perks & tags
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Tag this client so their discount auto-suggests at checkout — no need to remember at the register.
      </p>
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          <PerkRow
            id="hcw"
            label="Healthcare worker"
            hint="Auto-suggests 15% off (adjustable in POS settings)"
            checked={perks.is_healthcare_worker}
            saving={saving === "is_healthcare_worker"}
            onChange={(v) => toggle("is_healthcare_worker", v)}
          />
          <PerkRow
            id="friend"
            label="Friend"
            hint="Auto-suggests 10% off (adjustable in POS settings)"
            checked={perks.is_friend}
            saving={saving === "is_friend"}
            onChange={(v) => toggle("is_friend", v)}
          />
        </div>
      )}
    </div>
  );
}

function PerkRow({
  id, label, hint, checked, saving, onChange,
}: { id: string; label: string; hint: string; checked: boolean; saving: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</Label>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <div className="flex items-center gap-2">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={saving} />
      </div>
    </div>
  );
}
