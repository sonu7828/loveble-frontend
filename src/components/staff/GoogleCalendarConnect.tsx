import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar as CalendarIcon, CheckCircle2, Unlink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  staffId: string | null;
}

interface OAuthRow {
  google_email: string;
  connected_at: string;
}

export default function GoogleCalendarConnect({ staffId }: Props) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [row, setRow] = useState<OAuthRow | null>(null);

  const load = async () => {
    if (!staffId) { setLoading(false); return; }
    const { data } = await supabase
      .from("staff_google_oauth")
      .select("google_email, connected_at")
      .eq("staff_id", staffId)
      .maybeSingle();
    setRow(data as OAuthRow | null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [staffId]);

  const connect = async () => {
    if (!staffId) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth-start", {
        body: { return_url: window.location.href },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("No authorize URL returned");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message ?? "Could not start Google connect");
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!staffId) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("staff_google_oauth")
        .delete()
        .eq("staff_id", staffId);
      if (error) throw error;
      setRow(null);
      toast.success("Google Calendar disconnected");
    } catch (e: any) {
      toast.error(e.message ?? "Could not disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <CalendarIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium">Google Calendar</h3>
          <p className="text-sm text-muted-foreground">
            Connect your Google Calendar so events on it automatically block booking slots.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : row ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-success-soft-foreground shrink-0" />
            <span className="truncate">Connected as <strong>{row.google_email}</strong></span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={connect} disabled={connecting}>
              {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}Reconnect
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={disconnect} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Unlink className="h-3.5 w-3.5 mr-1.5" />}
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={connect} disabled={connecting || !staffId} className="rounded-full">
          {connecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Connect Google Calendar
        </Button>
      )}
    </div>
  );
}
