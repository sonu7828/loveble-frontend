import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Send, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type IntakeStatus = "completed" | "sent" | "not_sent" | "failed";

type Row = {
  id: string;
  start_at: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string;
  service_name: string | null;
  staff_name: string | null;
  intake_sent_at: string | null;
  intake_completed_at: string | null;
  intake_last_sent_at: string | null;
  intake_send_count: number | null;
  last_error: string | null;
  status: IntakeStatus;
};

const STATUS_META: Record<IntakeStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "Completed", variant: "default" },
  sent: { label: "Sent · awaiting", variant: "secondary" },
  not_sent: { label: "Not sent", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function AdminIntakeDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<IntakeStatus | "all">("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id,start_at,client_first_name,client_last_name,client_email,intake_sent_at,intake_completed_at,intake_last_sent_at,intake_send_count,status,service_id,staff_id")
      .gte("start_at", new Date().toISOString())
      .eq("status", "approved")
      .order("start_at", { ascending: true })
      .limit(500);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const ids = (appts ?? []).map((a) => a.id);
    const svcIds = Array.from(new Set((appts ?? []).map((a) => a.service_id).filter(Boolean))) as string[];
    const staffIds = Array.from(new Set((appts ?? []).map((a) => a.staff_id).filter(Boolean))) as string[];
    const [svcRes, staffRes, errRes] = await Promise.all([
      svcIds.length ? supabase.from("services").select("id,name").in("id", svcIds) : Promise.resolve({ data: [] as any[] }),
      staffIds.length ? supabase.from("staff_profiles").select("id,full_name").in("id", staffIds) : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase
            .from("email_send_log")
            .select("recipient_email,status,error_message,created_at,metadata")
            .eq("template_name", "intake-link")
            .in("status", ["dlq", "failed", "bounced"])
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const svcMap = new Map((svcRes.data ?? []).map((s: any) => [s.id, s.name]));
    const staffMap = new Map((staffRes.data ?? []).map((s: any) => [s.id, s.full_name]));
    const errByEmail = new Map<string, string>();
    for (const e of (errRes.data ?? []) as any[]) {
      const em = String(e.recipient_email || "").toLowerCase();
      if (em && !errByEmail.has(em)) errByEmail.set(em, e.error_message || e.status);
    }

    const mapped: Row[] = (appts ?? []).map((a: any) => {
      const lastErr = errByEmail.get(String(a.client_email || "").toLowerCase()) ?? null;
      let status: IntakeStatus;
      if (a.intake_completed_at) status = "completed";
      else if (a.intake_sent_at) status = "sent";
      else if (lastErr && (a.intake_send_count ?? 0) > 0) status = "failed";
      else status = "not_sent";
      return {
        id: a.id,
        start_at: a.start_at,
        client_first_name: a.client_first_name,
        client_last_name: a.client_last_name,
        client_email: a.client_email,
        service_name: svcMap.get(a.service_id) ?? null,
        staff_name: staffMap.get(a.staff_id) ?? null,
        intake_sent_at: a.intake_sent_at,
        intake_completed_at: a.intake_completed_at,
        intake_last_sent_at: a.intake_last_sent_at,
        intake_send_count: a.intake_send_count,
        last_error: status === "failed" ? lastErr : null,
        status,
      };
    });
    setRows(mapped);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<IntakeStatus | "all", number> = { all: rows.length, completed: 0, sent: 0, not_sent: 0, failed: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!ql) return true;
      const name = `${r.client_first_name ?? ""} ${r.client_last_name ?? ""}`.toLowerCase();
      return name.includes(ql) || r.client_email.toLowerCase().includes(ql) || (r.service_name ?? "").toLowerCase().includes(ql);
    });
  }, [rows, filter, q]);

  async function sendIntake(appointmentId: string, mode: "force" | "resend") {
    setBusyId(appointmentId);
    try {
      const { data, error } = await supabase.functions.invoke("send-intake-links", {
        body: { appointment_id: appointmentId, mode },
      });
      if (error) throw error;
      toast.success(mode === "force" ? "Intake link sent" : "Reminder sent");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setBusyId(null);
    }
  }

  async function bulkResend() {
    const targets = rows.filter((r) => r.status === "not_sent" || r.status === "failed" || r.status === "sent");
    if (!targets.length) { toast.info("Nothing to resend"); return; }
    if (!confirm(`Send intake to ${targets.length} client(s)?`)) return;
    let ok = 0, fail = 0;
    for (const r of targets) {
      try {
        const { error } = await supabase.functions.invoke("send-intake-links", {
          body: { appointment_id: r.id, mode: r.status === "sent" ? "resend" : "force" },
        });
        if (error) throw error;
        ok++;
      } catch { fail++; }
    }
    toast.success(`Sent ${ok}${fail ? `, failed ${fail}` : ""}`);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Intake Status</h1>
          <p className="text-sm text-muted-foreground">Patient intake forms for all upcoming approved appointments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={bulkResend} disabled={loading || rows.length === 0}>
            <Send className="h-4 w-4 mr-2" /> Resend all pending
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["all", "completed", "sent", "not_sent", "failed"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`text-left rounded-lg border p-3 transition ${filter === k ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {k === "all" ? "All upcoming" : STATUS_META[k as IntakeStatus].label}
            </div>
            <div className="text-2xl font-semibold mt-1">{counts[k]}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Appointments</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search client, email, service"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No appointments match.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sent</TableHead>
                  <TableHead>Sends</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(r.start_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell>
                        <Link to={`/staff/appointments/${r.id}`} className="hover:underline">
                          <div className="font-medium">{r.client_first_name} {r.client_last_name}</div>
                          <div className="text-xs text-muted-foreground">{r.client_email}</div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{r.service_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.staff_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        {r.last_error ? (
                          <div className="text-xs text-destructive mt-1 max-w-[240px] truncate" title={r.last_error}>{r.last_error}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {r.intake_last_sent_at ? format(new Date(r.intake_last_sent_at), "MMM d, h:mm a") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{r.intake_send_count ?? 0}</TableCell>
                      <TableCell className="text-right">
                        {r.status === "completed" ? (
                          <span className="text-xs text-muted-foreground">Done</span>
                        ) : (
                          <Button
                            size="sm"
                            variant={r.status === "not_sent" || r.status === "failed" ? "default" : "outline"}
                            disabled={busyId === r.id}
                            onClick={() => sendIntake(r.id, r.status === "not_sent" ? "force" : r.status === "failed" ? "force" : "resend")}
                          >
                            {busyId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-1" />
                                {r.status === "not_sent" ? "Send" : r.status === "failed" ? "Retry" : "Resend"}
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

