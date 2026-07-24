import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Row = {
  product: string;
  lifetime_units: number;
  units_last_12mo: number;
  last_visit_at: string | null;
  visit_count: number;
};

export function LifetimeToxCard({ clientEmail }: { clientEmail: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientEmail) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("client_tox_lifetime")
        .select("product, lifetime_units, units_last_12mo, last_visit_at, visit_count")
        .eq("client_email", clientEmail.toLowerCase())
        .order("lifetime_units", { ascending: false });
      setRows(((data as unknown) as Row[]) ?? []);
      setLoading(false);
    })();
  }, [clientEmail]);

  if (loading) return null;
  if (rows.length === 0) return null;

  const totalLifetime = rows.reduce((s, r) => s + Number(r.lifetime_units || 0), 0);
  const total12mo = rows.reduce((s, r) => s + Number(r.units_last_12mo || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Neurotoxin lifetime</span>
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {Math.round(totalLifetime)}u total · {Math.round(total12mo)}u in last 12 mo
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(r => (
          <div key={r.product} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{r.product}</Badge>
              <span className="text-xs text-muted-foreground">{r.visit_count} visits</span>
            </div>
            <div className="text-right">
              <div className="tabular-nums font-medium">{Math.round(Number(r.lifetime_units))}u</div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {Math.round(Number(r.units_last_12mo))}u / 12mo
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
