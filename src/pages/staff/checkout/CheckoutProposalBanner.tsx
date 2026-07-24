import { useEffect, useState } from "react";
import { Check, X, User2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmt, type LineItem } from "./shared";

type Proposal = {
  id: string;
  created_by_name: string | null;
  items: any[];
  suggested_discount_reason: string | null;
  suggested_discount_pct: number | null;
  suggested_discount_amount_cents: number | null;
  note: string | null;
};

type Props = {
  appointmentId: string | null | undefined;
  onAccept: (items: LineItem[], discount: {
    reason: string | null;
    pct: number | null;
    amountCents: number | null;
  }) => void;
};

export function CheckoutProposalBanner({ appointmentId, onAccept }: Props) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("checkout_proposals" as any)
        .select("*")
        .eq("appointment_id", appointmentId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setProposal((data as any) ?? null);
    })();
    return () => { cancelled = true; };
  }, [appointmentId]);

  if (!proposal) return null;

  const subtotal = (proposal.items || []).reduce(
    (s: number, it: any) => s + (Number(it.unit_price_cents ?? 0) * Number(it.quantity ?? 0)),
    0,
  );
  const discAmt = proposal.suggested_discount_amount_cents ?? 0;
  const discPctCents = proposal.suggested_discount_pct
    ? Math.round(subtotal * (Number(proposal.suggested_discount_pct) / 100))
    : 0;
  const totalDisc = discAmt + discPctCents;
  const net = Math.max(0, subtotal - totalDisc);

  const acceptProposal = async () => {
    setWorking(true);
    const items: LineItem[] = (proposal.items || []).map((it: any) => ({
      kind: it.kind,
      reference_id: it.reference_id ?? null,
      label: it.label,
      quantity: Number(it.quantity ?? 1),
      unit_price_cents: Number(it.unit_price_cents ?? 0),
      line_total_cents: Number(it.unit_price_cents ?? 0) * Number(it.quantity ?? 0),
      metadata: { ...(it.metadata ?? {}), from_chart: true },
      tippable: it.tippable !== false,
      taxable: !!it.taxable,
    }));
    onAccept(items, {
      reason: proposal.suggested_discount_reason,
      pct: proposal.suggested_discount_pct ? Number(proposal.suggested_discount_pct) : null,
      amountCents: proposal.suggested_discount_amount_cents ?? null,
    });
    await supabase
      .from("checkout_proposals" as any)
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", proposal.id);
    setProposal(null);
    setWorking(false);
  };

  const dismiss = async () => {
    setWorking(true);
    await supabase
      .from("checkout_proposals" as any)
      .update({ status: "dismissed" })
      .eq("id", proposal.id);
    setProposal(null);
    setWorking(false);
  };

  return (
    <div className="rounded-2xl border-2 border-success/40 bg-success-soft p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-success/20 p-2 mt-0.5">
          <User2 className="h-4 w-4 text-success-soft-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-success-soft-foreground/80">
            Ready from {proposal.created_by_name ?? "provider"}
          </div>
          <ul className="mt-1 space-y-0.5 text-sm text-success-soft-foreground">
            {(proposal.items || []).map((it: any, i: number) => (
              <li key={i}>
                • {it.label} — {fmt(Number(it.unit_price_cents ?? 0) * Number(it.quantity ?? 0))}
              </li>
            ))}
          </ul>
          <div className="mt-2 text-sm text-success-soft-foreground">
            Subtotal <span className="tabular-nums">{fmt(subtotal)}</span>
            {totalDisc > 0 && (
              <>
                {" · "}Suggested discount{proposal.suggested_discount_reason ? ` (${proposal.suggested_discount_reason})` : ""}
                {" "}<span className="tabular-nums">−{fmt(totalDisc)}</span>
                {" → "}<span className="font-semibold tabular-nums">{fmt(net)}</span>
              </>
            )}
          </div>
          {proposal.note && (
            <div className="mt-1 text-xs italic text-success-soft-foreground/80">
              “{proposal.note}”
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={acceptProposal} disabled={working} className="bg-success hover:bg-success">
              <Check className="h-4 w-4 mr-1.5" /> Accept &amp; load cart
            </Button>
            <Button size="sm" variant="outline" onClick={dismiss} disabled={working}>
              <X className="h-4 w-4 mr-1.5" /> Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
