import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, Search, PenSquare, CalendarPlus, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format, formatDistanceToNow } from "date-fns";
import { SmsThread } from "@/components/messaging/SmsThread";
import { toast } from "sonner";

type Row = {
  id: string;
  client_email: string;
  body: string;
  direction: "inbound" | "outbound";
  sender_role: string;
  created_at: string;
  read_by_staff_at: string | null;
};

type ThreadSummary = {
  clientEmail: string;
  name: string;
  lastBody: string;
  lastAt: string;
  lastDirection: "inbound" | "outbound";
  unread: number;
};

export default function StaffMessages() {
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, { first_name: string; last_name: string; phone?: string | null }>>({});
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: msgs }, { data: profs }] = await Promise.all([
      supabase
        .from("sms_messages")
        .select("id, client_email, body, direction, sender_role, created_at, read_by_staff_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("client_profiles").select("email, first_name, last_name, phone"),
    ]);

    const pmap: Record<string, { first_name: string; last_name: string; phone?: string | null }> = {};
    for (const p of (profs ?? []) as any[]) {
      pmap[String(p.email).toLowerCase()] = { first_name: p.first_name ?? "", last_name: p.last_name ?? "", phone: p.phone ?? null };
    }
    setProfiles(pmap);

    const byEmail = new Map<string, ThreadSummary>();
    for (const m of (msgs ?? []) as Row[]) {
      const key = m.client_email.toLowerCase();
      const existing = byEmail.get(key);
      const isUnread = m.direction === "inbound" && !m.read_by_staff_at;
      if (!existing) {
        const p = pmap[key];
        byEmail.set(key, {
          clientEmail: key,
          name: p ? `${p.first_name} ${p.last_name}`.trim() || key : key,
          lastBody: m.body,
          lastAt: m.created_at,
          lastDirection: m.direction,
          unread: isUnread ? 1 : 0,
        });
      } else if (isUnread) {
        existing.unread += 1;
      }
    }
    const list = Array.from(byEmail.values()).sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));
    setThreads(list);
    if (!selected && list[0]) setSelected(list[0].clientEmail);
    setLoading(false);
  };

  // Keep a ref to the latest `load` so the realtime subscription always
  // calls the current closure (no stale state from initial mount).
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // realtime: debounce list refresh so a burst of events triggers one reload
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const ch = supabase
      .channel("staff_messages_inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "sms_messages" }, () => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => { loadRef.current(); }, 600);
      })
      .subscribe();
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, []);

  const totalUnread = useMemo(() => threads.reduce((sum, t) => sum + t.unread, 0), [threads]);
  const markAllRead = async () => {
    if (totalUnread === 0) return;
    const { error } = await supabase
      .from("sms_messages")
      .update({ read_by_staff_at: new Date().toISOString() })
      .is("read_by_staff_at", null)
      .eq("direction", "inbound");
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${totalUnread} message${totalUnread === 1 ? "" : "s"} as read`);
    setThreads(prev => prev.map(t => ({ ...t, unread: 0 })));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.clientEmail.includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.lastBody.toLowerCase().includes(q),
    );
  }, [threads, search]);

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl flex items-center gap-2">
            <MessageSquare className="h-5 w-5 shrink-0" /> Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Text clients directly. Replies go to their phone.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:shrink-0">
          {totalUnread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" /> Mark all read ({totalUnread})
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/staff/appointments/new"><CalendarPlus className="h-4 w-4 mr-2" /> Book</Link>
          </Button>
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <PenSquare className="h-4 w-4 mr-2" /> New message
          </Button>
        </div>
      </header>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        profiles={profiles}
        onStart={(email) => {
          setSelected(email);
          setComposeOpen(false);
          if (!threads.some((t) => t.clientEmail === email)) {
            const p = profiles[email];
            setThreads((prev) => [
              {
                clientEmail: email,
                name: p ? `${p.first_name} ${p.last_name}`.trim() || email : email,
                lastBody: "(new conversation)",
                lastAt: new Date().toISOString(),
                lastDirection: "outbound",
                unread: 0,
              },
              ...prev,
            ]);
          }
        }}
      />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] min-h-0">
        {/* Threads list */}
        <aside className="border-r border-border bg-card/30 flex flex-col min-h-0">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages…"
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No conversations yet.
              </div>
            ) : (
              <ul>
                {filtered.map((t) => {
                  const active = selected === t.clientEmail;
                  return (
                    <li key={t.clientEmail}>
                      <button
                        onClick={() => setSelected(t.clientEmail)}
                        className={`w-full text-left px-4 py-3 border-b border-border/50 transition ${
                          active ? "bg-primary/10" : "hover:bg-secondary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`text-sm truncate ${t.unread > 0 ? "font-semibold" : "font-medium"}`}>
                            {t.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(t.lastAt), { addSuffix: false })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs truncate flex-1 ${t.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                            {t.lastDirection === "outbound" ? "You: " : ""}
                            {t.lastBody}
                          </span>
                          {t.unread > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                              {t.unread}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread pane */}
        <section className="flex flex-col min-h-0">
          {selected ? (
            <ThreadPane
              clientEmail={selected}
              name={profiles[selected]?.first_name
                ? `${profiles[selected].first_name} ${profiles[selected].last_name}`.trim()
                : selected}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadPane({ clientEmail, name }: { clientEmail: string; name: string }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 p-6">
      <div className="mb-4">
        <div className="font-serif text-xl">{name}</div>
        <div className="text-xs text-muted-foreground">{clientEmail}</div>
      </div>
      <div className="flex-1 min-h-0">
        <SmsThread clientEmail={clientEmail} viewerRole="staff" />
      </div>
    </div>
  );
}

function ComposeDialog({
  open,
  onOpenChange,
  profiles,
  onStart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profiles: Record<string, { first_name: string; last_name: string; phone?: string | null }>;
  onStart: (clientEmail: string) => void;
}) {
  const [q, setQ] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setQ(""); setMessage(""); setPicked(null); }
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = Object.entries(profiles).map(([email, p]) => ({
      email,
      name: `${p.first_name} ${p.last_name}`.trim() || email,
      phone: p.phone || "",
    }));
    const filtered = needle
      ? all.filter((r) =>
          r.email.includes(needle) ||
          r.name.toLowerCase().includes(needle) ||
          r.phone.toLowerCase().includes(needle),
        )
      : all;
    return filtered.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50);
  }, [q, profiles]);

  const send = async () => {
    if (!picked || !message.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("staff-send-sms", {
        body: { clientEmail: picked, message: message.trim() },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Could not send SMS");
        return;
      }
      toast.success("Message sent");
      onStart(picked);
    } catch (e: any) {
      toast.error(e?.message || "Could not send SMS");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Pick a client and send them a text.</DialogDescription>
        </DialogHeader>

        {!picked ? (
          <>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email, or phone…"
                className="pl-8"
              />
            </div>
            <div className="max-h-72 overflow-y-auto -mx-2 border-t border-border mt-2">
              {results.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">No matching clients.</div>
              ) : (
                <ul>
                  {results.map((r) => (
                    <li key={r.email}>
                      <button
                        onClick={() => setPicked(r.email)}
                        className="w-full text-left px-4 py-2 hover:bg-secondary/40 border-b border-border/40"
                      >
                        <div className="text-sm font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.email}{r.phone ? ` · ${r.phone}` : ""}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-md border border-border p-3 bg-muted/30">
              <div className="text-sm font-medium">
                {profiles[picked] ? `${profiles[picked].first_name} ${profiles[picked].last_name}`.trim() || picked : picked}
              </div>
              <div className="text-xs text-muted-foreground">
                {picked}{profiles[picked]?.phone ? ` · ${profiles[picked]?.phone}` : ""}
              </div>
              <button
                className="text-xs text-primary mt-1 hover:underline"
                onClick={() => setPicked(null)}
              >
                Change client
              </button>
            </div>
            <textarea
              rows={4}
              maxLength={320}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">{message.length}/320</span>
              <Button onClick={send} disabled={sending || !message.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send SMS
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
