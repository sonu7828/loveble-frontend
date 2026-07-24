// Pre-op countdown card — surfaces upcoming appointments within 7 days, loads
// the service's pre-op instructions markdown, parses bullet items, and lets
// the client tick them off. Progress syncs to `preop_checklist_progress` so
// the provider sees the same checkmarks in the chart at intake.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getClientSession } from "@/hooks/useClientAuth";
import { differenceInCalendarDays, format } from "date-fns";
import { CalendarClock, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ApptLite = { id: string; start_at: string; service_id: string };
type Item = { key: string; text: string };

function parseChecklist(markdown: string | null | undefined): Item[] {
  if (!markdown) return [];
  const items: Item[] = [];
  const lines = markdown.split(/\r?\n/);
  for (const raw of lines) {
    const m = raw.match(/^\s*[-*]\s+(?:\[[ xX]\]\s+)?(.+?)\s*$/);
    if (!m) continue;
    const text = m[1].replace(/[*_`]/g, "").trim();
    if (text.length < 3) continue;
    // Stable hash for item identity across sessions.
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    const key = `${text.length}_${Math.abs(h).toString(36)}`;
    items.push({ key, text });
  }
  return items;
}

function windowLabel(days: number): string | null {
  if (days < 0) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 3) return `In ${days} days · 3-day prep window`;
  if (days <= 7) return `In ${days} days · 1-week prep window`;
  return null;
}

export function PreOpCountdownCard() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [appts, setAppts] = useState<ApptLite[]>([]);
  const [byAppt, setByAppt] = useState<Record<string, { service: string; items: Item[]; checked: Record<string, boolean> }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const session = await getClientSession();
        const e = session?.user?.email?.toLowerCase();
        if (!e) return;
        setEmail(e);

        const horizon = new Date(); horizon.setDate(horizon.getDate() + 7);
        const { data: ap } = await supabase
          .from("appointments")
          .select("id, start_at, service_id")
          .ilike("client_email", e)
          .in("status", ["pending", "approved"])
          .gte("start_at", new Date().toISOString())
          .lte("start_at", horizon.toISOString())
          .order("start_at");
        const appts = (ap ?? []) as ApptLite[];
        if (!appts.length) {
          if (!cancel) setAppts([]);
          return;
        }

        const serviceIds = Array.from(new Set(appts.map(a => a.service_id).filter(Boolean)));
        const [{ data: services }, { data: preops }, { data: progress }] = await Promise.all([
          supabase.from("services").select("id, name").in("id", serviceIds),
          supabase.from("service_pre_op_instructions" as any).select("service_id, body_markdown").in("service_id", serviceIds),
          supabase.from("preop_checklist_progress" as any).select("appointment_id, item_key, checked_at").in("appointment_id", appts.map(a => a.id)),
        ]);
        const svcName = new Map<string, string>((services ?? []).map((s: any) => [s.id, s.name]));
        const md = new Map<string, string>((preops ?? []).map((p: any) => [p.service_id, p.body_markdown ?? ""]));
        const checkedMap: Record<string, Record<string, boolean>> = {};
        for (const p of (progress ?? []) as any[]) {
          checkedMap[p.appointment_id] = checkedMap[p.appointment_id] ?? {};
          if (p.checked_at) checkedMap[p.appointment_id][p.item_key] = true;
        }

        const map: Record<string, { service: string; items: Item[]; checked: Record<string, boolean> }> = {};
        for (const a of appts) {
          const items = parseChecklist(md.get(a.service_id) ?? "");
          map[a.id] = {
            service: svcName.get(a.service_id) ?? "Appointment",
            items,
            checked: checkedMap[a.id] ?? {},
          };
        }
        if (!cancel) { setAppts(appts); setByAppt(map); }
      } catch (err) {
        console.warn("PreOp load error:", err);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  async function toggle(apptId: string, item: Item) {
    const cur = byAppt[apptId];
    if (!cur) return;
    const isChecked = !cur.checked[item.key];
    setSaving(`${apptId}:${item.key}`);
    setByAppt(s => ({ ...s, [apptId]: { ...cur, checked: { ...cur.checked, [item.key]: isChecked } } }));
    const { error } = await supabase
      .from("preop_checklist_progress")
      .upsert({
        appointment_id: apptId,
        client_email: email,
        item_key: item.key,
        item_text: item.text,
        checked_at: isChecked ? new Date().toISOString() : null,
      }, { onConflict: "appointment_id,item_key" });
    setSaving(null);
    if (error) {
      toast.error("Could not save");
      setByAppt(s => ({ ...s, [apptId]: { ...cur, checked: { ...cur.checked, [item.key]: !isChecked } } }));
    }
  }

  const visible = useMemo(() => appts.filter(a => {
    const items = byAppt[a.id]?.items.length ?? 0;
    return items > 0 && differenceInCalendarDays(new Date(a.start_at), new Date()) <= 7;
  }), [appts, byAppt]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pre-op…
      </div>
    );
  }
  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-lg">Get ready for your visit</h3>
      </div>
      {visible.map(a => {
        const d = differenceInCalendarDays(new Date(a.start_at), new Date());
        const label = windowLabel(d);
        const block = byAppt[a.id]!;
        const total = block.items.length;
        const done = block.items.filter(i => block.checked[i.key]).length;
        return (
          <div key={a.id} className="space-y-2">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div className="text-sm">
                <span className="font-medium">{block.service}</span>
                <span className="text-muted-foreground"> · {format(new Date(a.start_at), "EEE MMM d, p")}</span>
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {label} · {done}/{total} done
              </div>
            </div>
            <ul className="space-y-1.5">
              {block.items.map(item => {
                const checked = !!block.checked[item.key];
                const busy = saving === `${a.id}:${item.key}`;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => toggle(a.id, item)}
                      disabled={busy}
                      className="w-full flex items-start gap-2 text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted transition"
                    >
                      {busy
                        ? <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-muted-foreground" />
                        : checked
                          ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                          : <Circle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
                      <span className={checked ? "line-through text-muted-foreground" : ""}>{item.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground">Your checkmarks sync to your provider's chart at check-in.</p>
    </div>
  );
}

