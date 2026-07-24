import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StaffAdverseEvents() {
  usePageMeta({ title: "Adverse Events · Staff" });
  const [ae, setAe] = useState<any[]>([]);
  const [vo, setVo] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [a, v] = await Promise.all([
        supabase.from("adverse_events").select("*").order("event_date", { ascending: false }).limit(200),
        supabase.from("vo_protocol_runs").select("*").order("started_at", { ascending: false }).limit(100),
      ]);
      setAe(a.data ?? []);
      setVo(v.data ?? []);
    })();
  }, []);

  const openAe = ae.filter(r => r.outcome === "ongoing" || r.outcome === "improving");
  const activeVo = vo.filter(r => r.status === "active");

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Adverse Events & Safety</h1>
        <p className="text-sm text-muted-foreground">Complication log and active vascular-occlusion protocols.</p>
      </div>

      {activeVo.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2"><CardTitle className="text-base text-destructive">🚨 Active VO protocols ({activeVo.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {activeVo.map(r => (
              <Link key={r.id} to={`/staff/clinical/vo/${r.id}`} className="block p-3 rounded-md border border-destructive/40 hover:bg-destructive/5">
                <div className="font-medium">{r.client_first_name} {r.client_last_name}</div>
                <div className="text-xs text-muted-foreground">
                  Started {new Date(r.started_at).toLocaleString()}
                  {r.product_suspected && ` · ${r.product_suspected}`}
                  {r.region && ` · ${r.region}`}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({openAe.length})</TabsTrigger>
          <TabsTrigger value="all">All ({ae.length})</TabsTrigger>
          <TabsTrigger value="vo">VO protocols ({vo.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open"><AeList rows={openAe} /></TabsContent>
        <TabsContent value="all"><AeList rows={ae} /></TabsContent>
        <TabsContent value="vo">
          <Card><CardContent className="p-0 divide-y divide-border">
            {vo.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">None.</div> : vo.map(r => (
              <Link key={r.id} to={`/staff/clinical/vo/${r.id}`} className="block p-3 hover:bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{r.client_first_name} {r.client_last_name}</div>
                  <Badge variant={r.status === "active" ? "destructive" : "secondary"}>{r.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString()}</div>
              </Link>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AeList({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">No events.</CardContent></Card>;
  return (
    <Card><CardContent className="p-0 divide-y divide-border">
      {rows.map(r => {
        const severe = r.severity === "severe" || r.severity === "life_threatening";
        return (
          <Link key={r.id} to={`/staff/clinical/clients/${encodeURIComponent(r.client_email)}`} className="block p-3 hover:bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {r.client_first_name} {r.client_last_name}
                <span className="text-muted-foreground font-normal"> · {String(r.event_type).replace(/_/g," ")}</span>
              </div>
              <Badge variant={severe ? "destructive" : "outline"}>{String(r.severity).replace(/_/g," ")}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {new Date(r.event_date).toLocaleString()}
              {r.body_region && ` · ${r.body_region}`}
              {r.product_involved && ` · ${r.product_involved}`}
              {r.outcome && ` · ${r.outcome}`}
            </div>
          </Link>
        );
      })}
    </CardContent></Card>
  );
}
