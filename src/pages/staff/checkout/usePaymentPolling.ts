import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks the sale row while a card payment is in progress.
 * Primary mechanism: Supabase Realtime push on the sale row.
 * Safety net: a slow 15s poll that nudges pos-confirm-payment in case the
 * webhook/server never fires.
 */
export function usePaymentPolling(args: {
  saleId: string | null;
  sale: any;
  paymentMonitorActive: boolean;
  setSale: (updater: (prev: any) => any) => void;
  setPaymentMonitorActive: (v: boolean) => void;
}) {
  const { saleId, sale, paymentMonitorActive, setSale, setPaymentMonitorActive } = args;

  useEffect(() => {
    if (!saleId) return;
    if (!paymentMonitorActive && sale?.status !== "pending_payment") return;

    let cancelled = false;

    const applySale = (nextSale: any) => {
      if (cancelled || !nextSale) return;
      setSale((prev: any) => {
        if (prev?.status !== "paid" && nextSale.status === "paid") {
          toast.success(nextSale.client_email
            ? `Payment collected — receipt sent to ${nextSale.client_email}`
            : "Payment collected");
        }
        return nextSale;
      });
      if (nextSale.status === "paid") {
        setPaymentMonitorActive(false);
      } else if (nextSale.status === "draft" || nextSale.reader_action_status === "failed") {
        setPaymentMonitorActive(false);
        toast.error(nextSale.notes || "Payment did not go through. Please try again.");
      }
    };

    // Realtime subscription — push updates the moment the webhook lands.
    const channel = supabase
      .channel(`sale-${saleId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sales", filter: `id=eq.${saleId}` },
        (payload) => applySale(payload.new as any),
      )
      .subscribe();

    // Safety net: ask the backend to reconcile every 15s in case the webhook
    // never arrives (terminal offline, network blip, etc.). Delay the first
    // call so realtime push has a chance to land first and we don't hammer
    // pos-confirm-payment the instant the cashier starts a charge.
    const reconcile = async () => {
      const { data: confirmed } = await supabase.functions
        .invoke("pos-confirm-payment", { body: { saleId } })
        .catch(() => ({ data: null } as any));
      const { data: s } = await supabase.from("sales").select("*").eq("id", saleId).maybeSingle();
      if (!s) return;
      applySale(confirmed?.status === "paid"
        ? { ...s, status: "paid", paid_at: s.paid_at ?? new Date().toISOString() }
        : s);
    };
    const firstT = setTimeout(reconcile, 8000);
    const t = setInterval(reconcile, 15000);

    return () => {
      cancelled = true;
      clearTimeout(firstT);
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [saleId, sale?.status, paymentMonitorActive, setSale, setPaymentMonitorActive]);
}
