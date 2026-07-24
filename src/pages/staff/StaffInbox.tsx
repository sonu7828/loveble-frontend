import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchApptServiceNames, combinedServiceLabel } from "@/lib/apptServices";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Check, X, Loader2, MapPin, Clock, User as UserIcon, Mail, Phone, ChevronRight, Bell, Inbox as InboxIcon, Keyboard } from "lucide-react";
import { toast } from "sonner";

interface Appt {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string;
  client_notes: string | null;
  is_new_client: boolean | null;
  service_id: string;
  staff_id: string;
  location_id: string;
  created_at: string;
}

interface Wait {
  id: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string;
  service_id: string;
  staff_id: string | null;
  location_id: string | null;
  desired_date_from: string;
  desired_date_to: string;
  notes: string | null;
  created_at: string;
}

type Tab = "pending" | "waitlist";

export default function StaffInbox() {
  const navigate = useNavigate();
  const { canSeeAll, staffId } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [appts, setAppts] = useState<Appt[]>([]);
  const [waits, setWaits] = useState<Wait[]>([]);
  const [meta, setMeta] = useState<Record<string, { service: string; staff: string; location: string }>>({});
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [denyFor, setDenyFor] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const denyRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let aq = supabase.from("appointments").select("*").eq("status", "pending").order("created_at", { ascending: true });
    if (!canSeeAll && staffId) aq = aq.eq("staff_id", staffId);
    const wq = supabase.from("waitlist_requests").select("*").eq("status", "open").order("created_at", { ascending: true });

    const [a, w] = await Promise.all([aq, wq]);
    setAppts((a.data ?? []) as Appt[]);
    setWaits((w.data ?? []) as Wait[]);

    const all = [...(a.data ?? []), ...(w.data ?? [])];
    const sids = [...new Set(all.map((x: any) => x.service_id).filter(Boolean))];
    const stids = [...new Set(all.map((x: any) => x.staff_id).filter(Boolean))];
    const lids = [...new Set(all.map((x: any) => x.location_id).filter(Boolean))];
    const apptIds = (a.data ?? []).map((x: any) => x.id);
    const [s, st, l, apsvMap] = await Promise.all([
      sids.length ? supabase.from("services").select("id, name").in("id", sids) : Promise.resolve({ data: [] as any[] }),
      stids.length ? supabase.from("staff_profiles").select("id, full_name").in("id", stids) : Promise.resolve({ data: [] as any[] }),
      lids.length ? supabase.from("locations").select("id, name").in("id", lids) : Promise.resolve({ data: [] as any[] }),
      fetchApptServiceNames(apptIds),
    ]);
    const m: typeof meta = {};
    all.forEach((x: any) => {
      const fallback = s.data?.find((y: any) => y.id === x.service_id)?.name ?? "—";
      m[x.id] = {
        service: combinedServiceLabel(x.id, apsvMap, fallback),
        staff: st.data?.find((y: any) => y.id === x.staff_id)?.full_name ?? "Any provider",
        location: l.data?.find((y: any) => y.id === x.location_id)?.name ?? "Any location",
      };
    });
    setMeta(m);
    setLocations((l.data ?? []).map((x: any) => ({ id: x.id, name: x.name })));
    setLoading(false);
  }, [canSeeAll, staffId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setFocusIdx(0); setDenyFor(null); }, [tab]);

  const act = useCallback(async (id: string, action: "approve" | "deny", reason?: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("staff-update-appointment", {
      body: { appointmentId: id, action, reason },
    });
    setBusyId(null);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Could not update");
      return;
    }
    toast.success(action === "approve" ? "Approved" : "Denied");
    setDenyFor(null);
    setDenyReason("");
    load();
  }, [load]);

  const dismissWait = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.from("waitlist_requests").update({ status: "cancelled" }).eq("id", id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Closed");
    load();
  };

  const dismissAllWaits = async () => {
    if (waits.length === 0) return;
    const { confirmDialog } = await import("@/components/ui/confirm");
    if (!(await confirmDialog({
      title: `Close all ${waits.length} waitlist requests?`,
      description: "Use this when you've handled everything outside the app (or none of these are workable). You can't undo this in bulk.",
      confirmLabel: "Close all",
    }))) return;
    const ids = waits.map(w => w.id);
    const { error } = await supabase.from("waitlist_requests").update({ status: "cancelled" }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`Closed ${ids.length} request${ids.length === 1 ? "" : "s"}`);
    load();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const list = tab === "pending" ? appts : waits;
      if (list.length === 0) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setFocusIdx((i) => Math.min(i + 1, list.length - 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setFocusIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") { const it: any = list[focusIdx]; if (it && tab === "pending") navigate(`/staff/appointments/${it.id}`); }
      else if (tab === "pending") {
        const it = appts[focusIdx];
        if (!it) return;
        if (e.key === "a") { e.preventDefault(); act(it.id, "approve"); }
        else if (e.key === "d") { e.preventDefault(); setDenyFor(it.id); setTimeout(() => denyRef.current?.focus(), 30); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, appts, waits, focusIdx, act, navigate]);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-3xl">Inbox</h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Keyboard className="h-3 w-3" />
            <span><kbd className="px-1 rounded bg-secondary text-[10px]">j</kbd>/<kbd className="px-1 rounded bg-secondary text-[10px]">k</kbd> navigate · <kbd className="px-1 rounded bg-secondary text-[10px]">a</kbd> approve · <kbd className="px-1 rounded bg-secondary text-[10px]">d</kbd> deny · <kbd className="px-1 rounded bg-secondary text-[10px]">Enter</kbd> open</span>
          </p>
        </div>
        <div className="flex gap-1.5 bg-secondary/40 rounded-full p-1 self-start sm:self-auto">
          <TabButton active={tab === "pending"} onClick={() => setTab("pending")} icon={InboxIcon} label="Pending bookings" count={appts.length} />
          <TabButton active={tab === "waitlist"} onClick={() => setTab("waitlist")} icon={Bell} label="Waitlist" count={waits.length} />
        </div>
      </header>

      {locations.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <FilterPill active={locationFilter === "all"} onClick={() => setLocationFilter("all")}>All locations</FilterPill>
          {locations.map(l => (
            <FilterPill key={l.id} active={locationFilter === l.id} onClick={() => setLocationFilter(l.id)}>{l.name}</FilterPill>
          ))}
          {locationFilter !== "all" && (
            <FilterPill active={false} onClick={() => setLocationFilter("all")}>Clear ✕</FilterPill>
          )}
        </div>
      )}

      {(() => {
        const filteredAppts = locationFilter === "all" ? appts : appts.filter(a => a.location_id === locationFilter);
        const filteredWaits = locationFilter === "all" ? waits : waits.filter(w => !w.location_id || w.location_id === locationFilter);
        return loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : tab === "pending" ? (
          filteredAppts.length === 0 ? <Empty text={locationFilter === "all" ? "No pending bookings. Inbox zero ✨" : "No pending bookings for this location."} /> : (
            <ol className="space-y-3">
              {filteredAppts.map((a, i) => (
                <ApptRow
                  key={a.id} a={a} m={meta[a.id]}
                  focused={i === focusIdx}
                  busy={busyId === a.id}
                  denying={denyFor === a.id}
                  denyReason={denyReason} setDenyReason={setDenyReason} denyRef={denyRef}
                  onApprove={() => act(a.id, "approve")}
                  onDenyClick={() => { setDenyFor(a.id); setTimeout(() => denyRef.current?.focus(), 30); }}
                  onDenyConfirm={() => act(a.id, "deny", denyReason)}
                  onDenyCancel={() => { setDenyFor(null); setDenyReason(""); }}
                  onOpen={() => navigate(`/staff/appointments/${a.id}`)}
                  onFocus={() => setFocusIdx(i)}
                />
              ))}
            </ol>
          )
        ) : filteredWaits.length === 0 ? <Empty text={locationFilter === "all" ? "No open waitlist requests." : "No waitlist requests for this location."} /> : (
          <>
            <div className="flex justify-end mb-3">
              <Button variant="outline" size="sm" className="rounded-full" onClick={dismissAllWaits}>
                <X className="h-3.5 w-3.5 mr-1.5" /> Close all ({filteredWaits.length})
              </Button>
            </div>
            <ol className="space-y-3">
              {filteredWaits.map((w, i) => (
                <WaitRow key={w.id} w={w} m={meta[w.id]} focused={i === focusIdx} busy={busyId === w.id} onClose={() => dismissWait(w.id)} onFocus={() => setFocusIdx(i)} />
              ))}
            </ol>
          </>
        );
      })()}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: any; label: string; count: number }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full transition flex items-center gap-1.5 ${active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-3 w-3" />{label}
      {count > 0 && <span className={`text-[10px] px-1.5 rounded-full ${active ? "bg-primary/15 text-primary" : "bg-secondary"}`}>{count}</span>}
    </button>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"}`}
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">{text}</div>;
}

function ApptRow(props: {
  a: Appt; m?: any; focused: boolean; busy: boolean; denying: boolean;
  denyReason: string; setDenyReason: (s: string) => void; denyRef: React.RefObject<HTMLInputElement>;
  onApprove: () => void; onDenyClick: () => void; onDenyConfirm: () => void; onDenyCancel: () => void;
  onOpen: () => void; onFocus: () => void;
}) {
  const { a, m, focused, busy, denying } = props;
  return (
    <li onMouseEnter={props.onFocus}>
      <div className={`rounded-2xl border bg-card p-5 transition ${focused ? "border-primary/60 shadow-sm" : "border-border hover:border-primary/30"}`}>
        <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={props.onOpen}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-serif text-lg">
              {m?.service ?? "Service"}
              {a.is_new_client && <span className="text-[10px] text-primary border border-primary/40 rounded-full px-1.5 py-0.5">NEW</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(a.start_at), "EEE, MMM d · h:mm a")}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m?.location}</span>
              <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{m?.staff}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm border-t border-border pt-4 mt-4">
          <div>
            <div className="font-medium">{a.client_first_name} {a.client_last_name}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Mail className="h-3 w-3" /><a href={`mailto:${a.client_email}`} className="hover:text-foreground">{a.client_email}</a></div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" /><a href={`tel:${a.client_phone}`} className="hover:text-foreground">{a.client_phone}</a></div>
          </div>
          {a.client_notes && <div className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">{a.client_notes}</div>}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          {!denying ? (
            <div className="flex gap-2">
              <Button onClick={props.onApprove} disabled={busy} size="sm" className="rounded-full">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Approve <span className="opacity-50 text-[10px] ml-1">a</span></>}
              </Button>
              <Button onClick={props.onDenyClick} disabled={busy} size="sm" variant="outline" className="rounded-full">
                <X className="h-3.5 w-3.5 mr-1" />Deny <span className="opacity-50 text-[10px] ml-1">d</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <input ref={props.denyRef} value={props.denyReason} onChange={(e) => props.setDenyReason(e.target.value)} placeholder="Reason (sent to client, optional)"
                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2" />
              <div className="flex gap-2">
                <Button onClick={props.onDenyConfirm} disabled={busy} size="sm" variant="destructive" className="rounded-full">Confirm deny</Button>
                <Button onClick={props.onDenyCancel} disabled={busy} size="sm" variant="ghost" className="rounded-full">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function WaitRow({ w, m, focused, busy, onClose, onFocus }: { w: Wait; m?: any; focused: boolean; busy: boolean; onClose: () => void; onFocus: () => void }) {
  return (
    <li onMouseEnter={onFocus}>
      <div className={`rounded-2xl border bg-card p-5 transition ${focused ? "border-primary/60 shadow-sm" : "border-border hover:border-primary/30"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-serif text-lg">{m?.service ?? "Service"}</div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(w.desired_date_from), "MMM d")} – {format(new Date(w.desired_date_to), "MMM d")}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m?.location}</span>
              <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{m?.staff}</span>
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm border-t border-border pt-4 mt-4">
          <div>
            <div className="font-medium">{w.client_first_name} {w.client_last_name}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Mail className="h-3 w-3" /><a href={`mailto:${w.client_email}`} className="hover:text-foreground">{w.client_email}</a></div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" /><a href={`tel:${w.client_phone}`} className="hover:text-foreground">{w.client_phone}</a></div>
          </div>
          {w.notes && <div className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">{w.notes}</div>}
        </div>
        <div className="mt-4 pt-4 border-t border-border flex gap-2">
          <Button onClick={onClose} disabled={busy} size="sm" variant="outline" className="rounded-full">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><X className="h-3.5 w-3.5 mr-1" />Close request</>}
          </Button>
        </div>
      </div>
    </li>
  );
}
