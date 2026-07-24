import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Send, MessageSquare, MessageSquareText } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";

export type ThreadMessage = {
  id: string;
  client_email: string;
  appointment_id: string | null;
  direction: "inbound" | "outbound";
  body: string;
  sender_role: string;
  created_at: string;
  read_by_staff_at: string | null;
  read_by_client_at: string | null;
};

export type SmsThreadProps = {
  /** Lowercased client email — the thread key. */
  clientEmail: string;
  /** Who is viewing/sending. */
  viewerRole: "client" | "staff";
  /** Limit thread to a specific appointment (otherwise shows the whole client history). */
  appointmentId?: string | null;
  /** Disable composer with a tooltip reason. */
  composerDisabledReason?: string | null;
  /** Optional: smaller bubble layout for embeds. */
  compact?: boolean;
};

function formatDay(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, MMM d");
}

export function SmsThread({
  clientEmail = "",
  viewerRole = "client",
  appointmentId = null,
  composerDisabledReason = null,
  compact = false,
}: SmsThreadProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [snippets, setSnippets] = useState<Array<{ id: string; label: string; body: string; category: string }>>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const emailKey = (clientEmail || "").toLowerCase();

  // Load snippets (staff only)
  useEffect(() => {
    if (viewerRole !== "staff") return;
    supabase
      .from("sms_snippets" as any)
      .select("id,label,body,category")
      .eq("is_active", true)
      .order("category")
      .order("sort_order")
      .then(({ data }) => setSnippets((data ?? []) as any));
  }, [viewerRole]);

  function insertSnippet(body: string) {
    const firstName = (messages[0]?.client_email || "").split("@")[0];
    const rendered = body.replace(/\{first_name\}/g, firstName || "there");
    setDraft((prev) => (prev ? prev + " " + rendered : rendered));
  }

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("sms_messages")
      .select("id, client_email, appointment_id, direction, body, sender_role, created_at, read_by_staff_at, read_by_client_at")
      .ilike("client_email", emailKey)
      .order("created_at", { ascending: true })
      .limit(500);
    if (appointmentId) q = q.eq("appointment_id", appointmentId);
    const { data, error } = await q;
    if (error) {
      console.error("load sms thread", error);
      toast.error("Could not load messages");
      setLoading(false);
      return;
    }
    setMessages((data ?? []) as ThreadMessage[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [emailKey, appointmentId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`sms_thread_${emailKey}_${appointmentId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sms_messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as ThreadMessage | undefined;
        if (!row) return;
        if (row.client_email?.toLowerCase() !== emailKey) return;
        if (appointmentId && row.appointment_id !== appointmentId) return;
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [emailKey, appointmentId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Mark unread as read (best-effort)
  useEffect(() => {
    if (messages.length === 0) return;
    const unread = messages.filter((m) =>
      viewerRole === "staff"
        ? m.direction === "inbound" && !m.read_by_staff_at
        : m.direction === "outbound" && m.sender_role === "staff" && !m.read_by_client_at,
    );
    if (unread.length === 0) return;
    const now = new Date().toISOString();
    const patch = viewerRole === "staff" ? { read_by_staff_at: now } : { read_by_client_at: now };
    supabase
      .from("sms_messages")
      .update(patch)
      .in("id", unread.map((m) => m.id))
      .then(({ error }) => { if (error) console.warn("mark read failed", error); });
  }, [messages, viewerRole]);

  const grouped = useMemo(() => {
    const byDay = new Map<string, ThreadMessage[]>();
    for (const m of messages) {
      const k = format(new Date(m.created_at), "yyyy-MM-dd");
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(m);
    }
    return Array.from(byDay.entries()).map(([day, msgs]) => ({ day, label: formatDay(new Date(day)), msgs }));
  }, [messages]);

  const canSend = draft.trim().length > 0 && !sending && !composerDisabledReason;

  const send = async () => {
    if (!canSend) return;
    const body = draft.trim();
    setSending(true);
    try {
      if (viewerRole === "client") {
        const { data, error } = await supabase.functions.invoke("client-send-sms", {
          body: { message: body, appointmentId: appointmentId ?? null },
        });
        if (error || (data as any)?.error) {
          toast.error((data as any)?.error || error?.message || "Could not send message");
          return;
        }
      } else {
        const fn = appointmentId ? "send-appointment-sms" : "staff-send-sms";
        const payload = appointmentId
          ? { appointmentId, message: body, overrideOptIn: true }
          : { clientEmail: emailKey, message: body };
        const { data, error } = await supabase.functions.invoke(fn, { body: payload });
        if (error || (data as any)?.error) {
          toast.error((data as any)?.error || error?.message || "Could not send SMS");
          return;
        }
        if ((data as any)?.skipped) toast.warning("Skipped — client has not opted in to SMS.");
      }
      setDraft("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Could not send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div
        ref={scrollerRef}
        className={`flex-1 min-h-[260px] ${compact ? "max-h-[340px]" : "max-h-[520px]"} overflow-y-auto rounded-xl border border-border bg-muted/20 p-4`}
      >
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10">
            <MessageSquare className="h-6 w-6 mb-2 opacity-60" />
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">
              {viewerRole === "client"
                ? "Send us a text — we'll reply by SMS."
                : "Replies the client sends to our number will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.day}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mb-2">{g.label}</div>
                <div className="space-y-2">
                  {g.msgs.map((m) => {
                    const fromClient = m.sender_role === "client";
                    const isViewer =
                      (viewerRole === "client" && fromClient) ||
                      (viewerRole === "staff" && m.sender_role === "staff");
                    return (
                      <div key={m.id} className={`flex ${isViewer ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm ${
                            isViewer
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card border border-border rounded-bl-sm"
                          }`}
                        >
                          <div>{m.body}</div>
                          <div
                            className={`mt-1 text-[10px] ${
                              isViewer ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            {m.sender_role === "client" ? "Client" : m.sender_role === "staff" ? "Staff" : "System"} ·{" "}
                            {format(new Date(m.created_at), "h:mm a")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 items-end">
        <Textarea
          rows={2}
          placeholder={
            composerDisabledReason
              ? composerDisabledReason
              : viewerRole === "client"
              ? "Type a message to the team…"
              : "Reply by SMS…"
          }
          value={draft}
          disabled={!!composerDisabledReason || sending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
          maxLength={320}
          className="resize-none"
        />
        <div className="flex flex-col gap-1 shrink-0">
          {viewerRole === "staff" && snippets.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" title="Insert snippet">
                  <MessageSquareText className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-1 max-h-72 overflow-y-auto" align="end">
                {snippets.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => insertSnippet(s.body)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-sm"
                  >
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.body}</div>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          <Button onClick={send} disabled={!canSend}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{draft.length}/320</span>
        <span>⌘/Ctrl + Enter to send</span>
      </div>
    </div>
  );
}
