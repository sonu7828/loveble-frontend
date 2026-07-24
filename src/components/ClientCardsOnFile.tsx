import { confirmDialog } from "@/components/ui/confirm";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, Plus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CardOnFile, type CardOnFileHandle } from "@/components/CardOnFile";

type SavedCard = {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  cardholder_name: string | null;
  created_at: string;
  is_default: boolean;
};

interface Props {
  email: string;
  defaultName?: string;
  defaultPhone?: string;
}

export function ClientCardsOnFile({ email, defaultName = "", defaultPhone = "" }: Props) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [consent, setConsent] = useState(false);
  const cardRef = useRef<CardOnFileHandle>(null);

  useEffect(() => { setName(defaultName); }, [defaultName]);
  useEffect(() => { setPhone(defaultPhone); }, [defaultPhone]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_payment_methods")
      .select("id, brand, last4, exp_month, exp_year, cardholder_name, created_at, is_default")
      .ilike("client_email", email)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setCards((data ?? []) as SavedCard[]);
    setLoading(false);
  };
  useEffect(() => { if (email) load(); }, [email]);

  const handleAdd = async () => {
    if (!name.trim()) { toast.error("Cardholder name required"); return; }
    if (!consent) { toast.error("Please confirm the client has authorized saving this card"); return; }
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const result = await cardRef.current.collect({ email, name: name.trim(), phone: phone.trim() });
      const { data, error } = await supabase.functions.invoke("payments-save-client-card", {
        body: {
          email,
          customerId: result.customerId,
          paymentMethodId: result.paymentMethodId,
          cardholderName: name.trim(),
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Save failed");
      toast.success("Card saved on file");
      setAddOpen(false);
      setConsent(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save card");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: string, label: string) => {
    if (!(await confirmDialog({ title: `Remove ${label}?`, description: "The card will be detached from Stripe.", destructive: true, confirmLabel: "Remove card" }))) return;
    const { data, error } = await supabase.functions.invoke("payments-detach-client-card", { body: { id } });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Could not remove card");
      return;
    }
    toast.success("Card removed");
    load();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Cards on file</h3>
        </div>
        <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add card
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
      ) : cards.length === 0 ? (
        <p className="text-xs text-muted-foreground">No saved cards. Add one to secure no-show fees and speed up checkout.</p>
      ) : (
        <ul className="divide-y divide-border">
          {cards.map(c => {
            const label = `${(c.brand ?? "Card").toUpperCase()} •••• ${c.last4 ?? "????"}`;
            return (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <div className="text-sm">
                  <div className="font-medium">{label}{c.is_default && <span className="ml-2 text-[10px] uppercase tracking-wider text-success-soft-foreground">Default</span>}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.cardholder_name ?? "—"} · Exp {String(c.exp_month ?? "?").padStart(2, "0")}/{String(c.exp_year ?? "??").slice(-2)}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive-soft-foreground hover:text-destructive-soft-foreground" onClick={() => handleRemove(c.id, label)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={addOpen} onOpenChange={(v) => { if (!busy) setAddOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add card on file</DialogTitle>
            <DialogDescription>
              Securely save a card for {email}. The card will not be charged now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cardholder name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name on card" />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Card details</Label>
              <div className="mt-1">
                <CardOnFile ref={cardRef} ready={true} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-success-soft-foreground" />
                Client authorization (read aloud to client)
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                "I authorize Radiantilyk Aesthetic to securely store my card on file. I understand my card
                will <strong className="text-foreground">not</strong> be charged at the time of booking. It will
                only be charged for services I receive, or for a <strong className="text-foreground">$200 no-show fee</strong> if
                I cancel with less than 48 hours notice or do not show for my appointment. I may request removal
                of my card at any time."
              </p>
              <label className="flex items-start gap-2 pt-1 cursor-pointer">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-snug">
                  I confirm the client has verbally authorized saving this card under the terms above.
                </span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleAdd} disabled={busy || !consent} className="rounded-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
