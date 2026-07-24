import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Camera, ArrowLeft } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

type Run = {
  id: string;
  client_email: string;
  client_first_name: string | null;
  client_last_name: string | null;
  onset_at: string | null;
  started_at: string;
  resolved_at: string | null;
  status: string;
  product_suspected: string | null;
  region: string | null;
  notes: string | null;
};
type Step = {
  id: string;
  step_key: string;
  step_label: string;
  due_offset_minutes: number;
  completed_at: string | null;
  notes: string | null;
  sort_order: number;
};

function elapsed(from: string) {
  const ms = Date.now() - new Date(from).getTime();
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function VoProtocolRun() {
  usePageMeta({ title: "VO Protocol · Staff" });
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [tick, setTick] = useState(0);

  async function load() {
    if (!runId) return;
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase.from("vo_protocol_runs").select("*").eq("id", runId).maybeSingle(),
      supabase.from("vo_protocol_steps").select("*").eq("run_id", runId).order("sort_order"),
    ]);
    setRun(r as Run | null);
    setSteps((s as Step[]) ?? []);
  }
  useEffect(() => { load(); }, [runId]);
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(i);
  }, []);

  const onsetAt = run?.onset_at ?? run?.started_at;
  const live = onsetAt && !run?.resolved_at;

  async function toggleStep(s: Step, done: boolean) {
    const patch: any = done
      ? { completed_at: new Date().toISOString() }
      : { completed_at: null };
    await supabase.from("vo_protocol_steps").update(patch).eq("id", s.id);
    load();
  }
  async function updateNotes(s: Step, notes: string) {
    await supabase.from("vo_protocol_steps").update({ notes }).eq("id", s.id);
    setSteps(prev => prev.map(p => p.id === s.id ? { ...p, notes } : p));
  }

  async function resolve() {
    if (!run) return;
    await supabase.from("vo_protocol_runs").update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    }).eq("id", run.id);
    if ((run as any).ae_id) {
      await supabase.from("adverse_events").update({
        outcome: "resolved",
        resolved_at: new Date().toISOString(),
      }).eq("id", (run as any).ae_id);
    }
    toast.success("VO protocol resolved");
    load();
  }

  const minutesSinceOnset = useMemo(() => {
    if (!onsetAt) return 0;
    return Math.floor((Date.now() - new Date(onsetAt).getTime()) / 60000);
  }, [onsetAt, tick]);

  if (!run) return <div className="container mx-auto p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>

      <Card className={live ? "border-destructive" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>VO Protocol — {run.client_first_name} {run.client_last_name}</span>
            <Badge variant={live ? "destructive" : "secondary"}>{run.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-2xl font-mono tabular-nums">
            <Clock className="h-5 w-5" />
            {onsetAt ? elapsed(onsetAt) : "—"}
            <span className="text-xs font-sans text-muted-foreground ml-2">since onset</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {run.product_suspected && <>Product: {run.product_suspected} · </>}
            {run.region && <>Region: {run.region} · </>}
            Started {new Date(run.started_at).toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Protocol checklist</CardTitle></CardHeader>
        <CardContent className="p-0 divide-y divide-border">
          {steps.map(s => {
            const due = s.due_offset_minutes <= minutesSinceOnset;
            const overdue = due && !s.completed_at;
            return (
              <div key={s.id} className={`p-3 space-y-2 ${overdue ? "bg-destructive/5" : ""}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={!!s.completed_at} onCheckedChange={(c) => toggleStep(s, !!c)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <span>{s.step_label}</span>
                      <Badge variant="outline" className="text-[10px]">@ {s.due_offset_minutes}m</Badge>
                      {overdue && <Badge variant="destructive" className="text-[10px]">overdue</Badge>}
                      {s.completed_at && <span className="text-[10px] text-muted-foreground">✓ {new Date(s.completed_at).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                </label>
                <Textarea
                  rows={1}
                  value={s.notes ?? ""}
                  onChange={e => setSteps(prev => prev.map(p => p.id === s.id ? { ...p, notes: e.target.value } : p))}
                  onBlur={e => updateNotes(s, e.target.value)}
                  placeholder="Step notes (dose, observation, response)…"
                  className="text-xs"
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4" />Photo cadence</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <div>Capture photos at <b>0, 15, 30, 60 min, then hourly</b> until reperfusion. Upload via the client's clinical photos page.</div>
          <Button size="sm" variant="outline" onClick={() => navigate(`/staff/clinical/clients/${encodeURIComponent(run.client_email)}`)}>
            Open client chart
          </Button>
        </CardContent>
      </Card>

      {live && (
        <div className="flex justify-end">
          <Button variant="default" onClick={resolve}>Mark resolved</Button>
        </div>
      )}
    </div>
  );
}
