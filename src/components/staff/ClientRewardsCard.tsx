import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";

type LedgerRow = {
  id: string;
  delta: number;
  reason: string;
  notes: string | null;
  created_at: string;
};

type Settings = {
  is_enabled: boolean;
  point_value_cents: number;
  earn_dollars_per_point: number;
};

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const REASON_LABEL: Record<string, string> = {
  earned: "Earned",
  redeemed: "Redeemed",
  admin_adjust: "Adjustment",
  refund_reversal: "Refund reversal",
  expired: "Expired",
};

export function ClientRewardsCard({ clientEmail }: { clientEmail: string }) {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const email = clientEmail.toLowerCase().trim();
      const [bal, led, s] = await Promise.all([
        supabase.rpc("get_points_balance", { _client_email: email }),
        supabase.from("client_points_ledger" as any)
          .select("id, delta, reason, notes, created_at")
          .ilike("client_email", email)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("client_points_settings" as any).select("*").eq("id", true).maybeSingle(),
      ]);
      if (cancelled) return;
      setBalance(Number(bal.data ?? 0));
      setLedger(((led.data ?? []) as any) as LedgerRow[]);
      setSettings((s.data as any) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientEmail]);

  const enabled = settings?.is_enabled ?? true;
  const pointCents = settings?.point_value_cents ?? 1;
  const balanceValue = balance * pointCents;
  const visible = showAll ? ledger : ledger.slice(0, 5);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Rewards points</h3>
        </div>
        {!enabled && (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Program off</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-2xl font-serif">{balance.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">pts · {fmt(balanceValue)} value</span>
          </div>

          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No points activity yet. Points are earned automatically when a sale is marked paid.</p>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Activity</div>
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {visible.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs">{REASON_LABEL[r.reason] ?? r.reason}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {format(new Date(r.created_at), "PP")}{r.notes ? ` · ${r.notes}` : ""}
                      </div>
                    </div>
                    <div className={`tabular-nums text-sm font-medium ${r.delta >= 0 ? "text-success-soft-foreground" : "text-destructive"}`}>
                      {r.delta >= 0 ? "+" : ""}{r.delta.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              {ledger.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAll(v => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground mt-1"
                >
                  {showAll ? "Show less" : `Show all ${ledger.length}`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
