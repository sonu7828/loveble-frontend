// Injector-side action: bundle what was charted (units, product, price) into a
// checkout_proposals row so the receptionist sees a "Ready from Kiem" banner
// with the exact items and a suggested discount when they open Checkout.
import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ProposalItem = {
  kind: "service" | "unit_service" | "product" | "package" | "service_addon" | "custom";
  reference_id?: string | null;
  label: string;
  quantity: number;
  unit_price_cents: number;
  metadata?: Record<string, any>;
  tippable?: boolean;
  taxable?: boolean;
};

type Props = {
  appointmentId: string | null;
  clientEmail: string | null;
  items: ProposalItem[];
  disabled?: boolean;
  label?: string;
  variant?: "default" | "outline" | "secondary";
};

const REASONS = ["", "Friend", "Review", "Healthcare worker", "New client", "Birthday", "Referral", "Other"];

export function SendToCheckoutButton({
  appointmentId, clientEmail, items, disabled, label = "Send to checkout", variant = "default",
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pct, setPct] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((s, it) => s + it.unit_price_cents * it.quantity, 0);
  const disable = disabled || !appointmentId || items.length === 0;

  const send = async () => {
    if (!appointmentId) { toast.error("No appointment selected"); return; }
    if (items.length === 0) { toast.error("Nothing to send — add units or a service first"); return; }
    setSaving(true);

    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id ?? null;
    let name: string | null = null;
    if (uid) {
      const { data: sp } = await supabase
        .from("staff_profiles")
        .select("full_name")
        .eq("user_id", uid)
        .maybeSingle();
      name = (sp as any)?.full_name ?? null;
    }

    // Dismiss any existing pending proposal so the unique index doesn't conflict.
    await supabase
      .from("checkout_proposals" as any)
      .update({ status: "dismissed" })
      .eq("appointment_id", appointmentId)
      .eq("status", "pending");

    const pctNum = pct ? Number(pct) : null;
    const amtCents = amount ? Math.round(Number(amount) * 100) : null;

    const { error } = await supabase.from("checkout_proposals" as any).insert({
      appointment_id: appointmentId,
      client_email: clientEmail?.toLowerCase() ?? null,
      created_by: uid,
      created_by_name: name,
      items: items.map((it) => ({
        kind: it.kind,
        reference_id: it.reference_id ?? null,
        label: it.label,
        quantity: it.quantity,
        unit_price_cents: it.unit_price_cents,
        metadata: it.metadata ?? {},
        tippable: it.tippable !== false,
        taxable: !!it.taxable,
      })),
      suggested_discount_reason: reason || null,
      suggested_discount_pct: pctNum,
      suggested_discount_amount_cents: amtCents,
      note: note.trim() || null,
      status: "pending",
    });

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sent to checkout — receptionist will see it when they open the sale");
    setOpen(false);
    setReason(""); setPct(""); setAmount(""); setNote("");
  };

  return (
    <>
      <Button variant={variant} disabled={disable} onClick={() => setOpen(true)}>
        <Send className="h-4 w-4 mr-2" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to checkout</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Cart the receptionist will see
              </div>
              <ul className="space-y-1 text-sm">
                {items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{it.label} × {it.quantity}</span>
                    <span className="tabular-nums">${((it.unit_price_cents * it.quantity) / 100).toFixed(2)}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-border pt-1 mt-1 font-medium">
                  <span>Subtotal</span>
                  <span className="tabular-nums">${(subtotal / 100).toFixed(2)}</span>
                </li>
              </ul>
            </div>
            <div>
              <Label className="text-xs">Suggested discount reason (optional)</Label>
              <Select value={reason || "__none"} onValueChange={(v) => setReason(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No discount" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {REASONS.filter(Boolean).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Discount %</Label>
                <Input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="e.g. 10" />
              </div>
              <div>
                <Label className="text-xs">Or $ off</Label>
                <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 25" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Note to receptionist (optional)</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Charge card on file — she's in a hurry" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={send} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : <>Send</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
