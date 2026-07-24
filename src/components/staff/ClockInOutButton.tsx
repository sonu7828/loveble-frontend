import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Clock, Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";

type Entry = { id: string; clock_in: string; clock_out: string | null };

function fmtElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

export function ClockInOutButton({ compact = false }: { compact?: boolean }) {
  const { staffId } = useAuth();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!staffId) { setLoading(false); return; }
    const { data } = await supabase
      .from("staff_time_entries")
      .select("id, clock_in, clock_out")
      .eq("staff_id", staffId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();
    setEntry(data as Entry | null);
    setLoading(false);
  }, [staffId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!entry) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [entry]);

  const clockIn = async () => {
    if (!staffId) return;
    setWorking(true);
    const { error } = await supabase.from("staff_time_entries").insert({ staff_id: staffId });
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success("Clocked in");
    load();
  };
  const clockOut = async () => {
    if (!entry) return;
    setWorking(true);
    const { error } = await supabase
      .from("staff_time_entries")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", entry.id);
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success("Clocked out");
    setEntry(null);
  };

  if (!staffId) return null;
  if (loading) return <div className="text-xs text-muted-foreground px-3 py-2 inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Time clock</div>;

  const elapsed = entry ? now - new Date(entry.clock_in).getTime() : 0;

  if (compact) {
    return entry ? (
      <Button size="sm" variant="outline" className="rounded-full" onClick={clockOut} disabled={working}>
        <Square className="h-3 w-3 mr-1.5" />Clock out · {fmtElapsed(elapsed)}
      </Button>
    ) : (
      <Button size="sm" className="rounded-full" onClick={clockIn} disabled={working}>
        <Play className="h-3 w-3 mr-1.5" />Clock in
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
        <Clock className="h-3 w-3" /> Time clock
      </div>
      {entry ? (
        <>
          <div className="text-sm font-medium tabular-nums mb-2">{fmtElapsed(elapsed)}</div>
          <Button size="sm" variant="outline" className="w-full" onClick={clockOut} disabled={working}>
            <Square className="h-3.5 w-3.5 mr-1.5" />Clock out
          </Button>
        </>
      ) : (
        <Button size="sm" className="w-full" onClick={clockIn} disabled={working}>
          <Play className="h-3.5 w-3.5 mr-1.5" />Clock in
        </Button>
      )}
    </div>
  );
}
