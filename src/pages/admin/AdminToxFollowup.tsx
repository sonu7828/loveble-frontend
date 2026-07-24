import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Send, MessageCircle, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Row = {
  id: string;
  end_at: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string;
  client_phone: string | null;
  service_name: string | null;
  staff_name: string | null;
  sent_at: string | null;
  responded: boolean;
  daxxify: boolean;
};

type Filter = "all" | "pending" | "sent" | "responded";

export default function AdminToxFollowup() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    // Neurotoxin category
    const { data: cat } = await supabase.from("service_categories").select("id").eq("slug", "neurotoxins").maybeSingle();
    if (!cat?.id) { setRows([]); setLoading(false); return; }

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const until = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(); // 5–30 days ago window

    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id,end_at,client_first_name,client_last_name,client_email,client_phone,day7_tox_sms_sent_at,service_id,staff_id,status")
      .eq("status", "completed")
      .gte("end_at", since)
      .lt("end_at", until)
      .order("end_at", { ascending: false })
      .limit(400);

    if (error) { toast.error(error.message); setLoading(false); return; }

    const svcIds = Array.from(new Set((appts ?? []).map((a: any) => a.service_id).filter(Boolean))) as string[];
    const staffIds = Array.from(new Set((appts ?? []).map((a: any) => a.staff_id).filter(Boolean))) as string[];
    const emails = Array.from(new Set((appts ?? []).map((a: any) => String(a.client_email || "").toLowerCase()).filter(Boolean)));

    const [svcRes, staffRes, replyRes] = await Promise.all([
      svcIds.length ? supabase.from("services").select("id,name,category_id").in("id", svcIds) : Promise.resolve({ data: [] as any[] }),
      staffIds.length ? supabase.from("staff_profiles").select("id,full_name").in("id", staffIds) : Promise.resolve({ data: [] as any[] }),
      emails.length ? supabase.from("sms_messages").select("client_email,created_at,direction").in("client_email", emails).eq("direction", "inbound").gte("created_at", since) : Promise.resolve({ data: [] as any[] }),
    ]);

    const svcMap = new Map((svcRes.data ?? []).map((s: any) => [s.id, s]));
    const staffMap = new Map((staffRes.data ?? []).map((s: any) => [s.id, s.full_name]));
    const replyByEmail = new Map<string, string>();
    for (const r of (replyRes.data ?? []) as any[]) {
      const em = String(r.client_email).toLowerCase();
      if (!replyByEmail.has(em)) replyByEmail.set(em, r.created_at);
    }

    const mapped: Row[] = (appts ?? [])
      .map((a: any) => {
        const svc = svcMap.get(a.service_id) as any;
        if (!svc || svc.category_id !== cat.id) return null;
        const sentAt = a.day7_tox_sms_sent_at as string | null;
        const replyAt = replyByEmail.get(String(a.client_email).toLowerCase()) ?? null;
        return {
          id: a.id,
          end_at: a.end_at,
          client_first_name: a.client_first_name,
          client_last_name: a.client_last_name,
          client_email: a.client_email,
          client_phone: a.client_phone,
          service_name: svc.name ?? null,
          staff_name: staffMap.get(a.staff_id) ?? null,
          sent_at: sentAt,
          responded: !!(sentAt && replyAt && new Date(replyAt) >= new Date(sentAt)),
          daxxify: /dax/i.test(svc.name ?? ""),
        } as Row;
      })
      .filter(Boolean) as Row[];

    setRows(mapped);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, sent: 0, responded: 0 };
    for (const r of rows) {
      if (r.responded) c.responded++;
      else if (r.sent_at) c.sent++;
      else c.pending++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (filter === "pending") return !r.sent_at;
    if (filter === "sent") return !!r.sent_at && !r.responded;
    if (filter === "responded") return r.responded;
    return true;
  }), [rows, filter]);

  async function sendNow(r: Row) {
    if (!r.client_phone) { toast.error("No phone on file"); return; }
    setBusyId(r.id);
    try {
      const finalDays = r.daxxify ? 21 : 14;
      const productLabel = r.daxxify ? "Daxxify" : "Botox";
      const body =
        `Hi ${r.client_first_name ?? ""}, it's Radiantilyk — just checking in on your ${r.service_name ?? "treatment"}! ` +
        `By now your ${productLabel} should be kicking in nicely. Final results show around day ${finalDays}. ` +
        `Let me know if you have any questions!`;
      const { error } = await supabase.functions.invoke("send-sms-via-ghl", {
        body: { appointmentId: r.id, template: "day7-tox-checkin-manual", body, skipOptInCheck: true },
      });
      if (error) throw error;
      await supabase.from("appointments").update({ day7_tox_sms_sent_at: new Date().toISOString() } as any).eq("id", r.id);
      toast.success("Sent");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setBusyId(null);
    }
  }

  async function runCron() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-day7-tox-checkins");
      if (error) throw error;
      toast.success(`Cron run: ${(data as any)?.sent ?? 0} sent, ${(data as any)?.skipped ?? 0} skipped`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Cron failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Sparkles className="h-6 w-6" /> Tox Day-7 Follow-up</h1>
          <p className="text-sm text-muted-foreground">Neurotoxin check-ins (Botox day 14, Daxxify day 21).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runCron} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Run cron now
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["all", "pending", "sent", "responded"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`text-left rounded-lg border p-3 transition ${filter === k ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div>
            <div className="text-2xl font-semibold mt-1">{counts[k]}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Last 30 days</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No appointments match.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Completed</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm whitespace-nowrap">{format(new Date(r.end_at), "MMM d, h:mm a")}</TableCell>
                    <TableCell>
                      <Link to={`/staff/appointments/${r.id}`} className="hover:underline">
                        <div className="font-medium">{r.client_first_name} {r.client_last_name}</div>
                        <div className="text-xs text-muted-foreground">{r.client_email}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{r.service_name}</TableCell>
                    <TableCell className="text-sm">{r.staff_name ?? "—"}</TableCell>
                    <TableCell>
                      {r.responded ? (
                        <Badge variant="default" className="bg-emerald-600"><MessageCircle className="h-3 w-3 mr-1" /> Replied</Badge>
                      ) : r.sent_at ? (
                        <Badge variant="secondary">Sent {format(new Date(r.sent_at), "MMM d")}</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={r.sent_at ? "outline" : "default"} disabled={busyId === r.id || !r.client_phone} onClick={() => sendNow(r)}>
                        {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" />{r.sent_at ? "Resend" : "Send"}</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

