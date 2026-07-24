import { useState } from "react";
import { Loader2, RefreshCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fmt, functionErrorMessage } from "./shared";

type Props = {
  saleId: string | null;
  totalCents: number;
  onCheckNow: () => void;
  onCancelled?: () => void;
};

export function PaymentMonitorScreen({ saleId, totalCents, onCheckNow, onCancelled }: Props) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!saleId) return;
    if (!confirm("Cancel this payment and pick a different method?\n\nIf the card has already been charged, the sale will be marked paid instead.")) return;
    setCancelling(true);
    const { data, error } = await supabase.functions.invoke("pos-cancel-payment", { body: { saleId } });
    setCancelling(false);
    if (error || data?.error) {
      toast.error(data?.error || await functionErrorMessage(error, "Could not cancel payment"));
      return;
    }
    if (data?.status === "paid") {
      toast.success(data.note || "Payment already completed");
    } else {
      toast.success("Payment cancelled — pick a different method");
    }
    onCancelled?.();
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-3xl border border-border bg-card p-10 shadow-sm">
        <div className="mx-auto mb-5 h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
        <h1 className="font-serif text-3xl mb-2">Confirming payment</h1>
        <div className="text-2xl font-mono tabular-nums mb-2">{fmt(totalCents)}</div>
        <p className="text-sm text-muted-foreground mb-6">Do not charge again. This screen will close automatically once the payment is complete.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="outline" className="rounded-full" onClick={async () => {
            onCheckNow();
            if (saleId) await supabase.functions.invoke("pos-confirm-payment", { body: { saleId } }).catch(() => {});
          }}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Check now
          </Button>
          <Button
            variant="ghost"
            className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={cancelling}
            onClick={handleCancel}
          >
            <X className="h-4 w-4 mr-2" /> {cancelling ? "Cancelling…" : "Cancel — pick a different method"}
          </Button>
        </div>
      </div>
    </div>
  );
}
