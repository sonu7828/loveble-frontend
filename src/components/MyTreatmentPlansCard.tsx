import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Loader2 } from "lucide-react";
import { format } from "date-fns";

type Plan = {
  id: string;
  name: string;
  total_sessions: number;
  sessions_used: number;
  status: string;
  expires_at: string | null;
};

export function MyTreatmentPlansCard() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("client_treatment_plans")
        .select("id,name,total_sessions,sessions_used,status,expires_at")
        .order("purchased_at", { ascending: false });
      setPlans((data ?? []) as Plan[]);
      setLoading(false);
    })();
  }, []);

  const active = plans.filter((p) => p.status === "active");
  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 mb-4">
        <div className="flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
      </section>
    );
  }
  if (active.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 mb-4">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
        <Package className="h-3 w-3" /> My treatment plans
      </h2>
      <div className="space-y-3">
        {active.map((p) => {
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
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Sessions are redeemed in-clinic at checkout.
      </p>
    </section>
  );
}
