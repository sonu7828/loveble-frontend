import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Receipt, ExternalLink } from "lucide-react";
import { format } from "date-fns";

import { getClientSession } from "@/hooks/useClientAuth";

interface Sale {
  id: string;
  paid_at: string | null;
  created_at: string;
  total_cents: number;
  receipt_url: string | null;
  status: string;
}

export default function MyReceiptsCard() {
  const [rows, setRows] = useState<Sale[] | null>(null);
  useEffect(() => {
    (async () => {
      const session = await getClientSession();
      if (!session?.user?.email) { setRows([]); return; }
      const { data } = await supabase
        .from("sales")
        .select("id, paid_at, created_at, total_cents, receipt_url, status")
        .ilike("client_email", session.user.email)
        .in("status", ["paid", "partially_refunded", "refunded"])
        .order("paid_at", { ascending: false, nullsFirst: false })
        .limit(50);
      setRows((data as any) ?? []);
    })();
  }, []);

  if (rows === null) {
    return (
      <section className="mb-10">
        <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">Receipts</h2>
        <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </section>
    );
  }
  if (rows.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">Receipts</h2>
      <div className="rounded-2xl border border-border bg-card p-2">
        <ul className="divide-y divide-border">
          {rows.map((s) => (
            <li key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono">${(s.total_cents / 100).toFixed(2)}</span>
                  {s.status !== "paid" && (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5">
                      {s.status.replace("_", " ")}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {format(new Date(s.paid_at ?? s.created_at), "MMM d, yyyy")}
                </div>
              </div>
              {s.receipt_url ? (
                <a href={s.receipt_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  View receipt <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-[11px] text-muted-foreground">No receipt link</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
