import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { SmsThread } from "@/components/messaging/SmsThread";

export function SmsCard({ appointmentId, optedIn: optedInProp, phone, clientEmail }: {
  appointmentId: string;
  optedIn: boolean;
  phone: string | null;
  clientEmail?: string | null;
}) {
  const [optedIn, setOptedIn] = useState(optedInProp);
  const [togglingOptIn, setTogglingOptIn] = useState(false);
  const [scope, setScope] = useState<"appointment" | "all">("appointment");

  useEffect(() => { setOptedIn(optedInProp); }, [optedInProp]);

  const toggleOptIn = async (next: boolean) => {
    setTogglingOptIn(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("appointments")
        .update({ sms_opt_in: next, sms_opt_in_at: next ? now : null })
        .eq("id", appointmentId);
      if (error) throw error;
      if (clientEmail) {
        await supabase
          .from("client_profiles")
          .update({ sms_opt_in: next, sms_opt_in_at: next ? now : null })
          .eq("email", clientEmail.toLowerCase());
      }
      setOptedIn(next);
      toast.success(next ? "Client opted in to SMS" : "Client opted out of SMS");
    } catch (e: any) {
      toast.error(e?.message || "Could not update opt-in");
    } finally {
      setTogglingOptIn(false);
    }
  };

  const disabledReason = !phone
    ? "No phone number on file"
    : !clientEmail
    ? "No client email on file"
    : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 mb-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <MessageSquare className="h-3 w-3" />SMS conversation
        </h2>
        <div className="flex gap-1 rounded-full border border-border p-0.5 text-xs">
          <button
            onClick={() => setScope("appointment")}
            className={`px-2.5 py-1 rounded-full transition ${scope === "appointment" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            This appt
          </button>
          <button
            onClick={() => setScope("all")}
            className={`px-2.5 py-1 rounded-full transition ${scope === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Full history
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-lg bg-muted/40">
        <div className="text-xs">
          <div className="font-medium">SMS opt-in</div>
          <div className="text-muted-foreground">
            {optedIn
              ? "Client receives confirmation + reminders."
              : "Automated confirmation and reminders are skipped."}
          </div>
        </div>
        <Switch
          checked={optedIn}
          disabled={togglingOptIn || !phone}
          onCheckedChange={toggleOptIn}
          aria-label="Toggle SMS opt-in"
        />
      </div>

      {disabledReason ? (
        <p className="text-sm text-muted-foreground">{disabledReason}.</p>
      ) : (
        <SmsThread
          clientEmail={clientEmail!}
          viewerRole="staff"
          appointmentId={scope === "appointment" ? appointmentId : null}
          composerDisabledReason={scope === "all" ? "Switch to 'This appt' to reply via SMS." : null}
          compact
        />
      )}
    </section>
  );
}
