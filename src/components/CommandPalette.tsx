import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { searchClients, type ClientHit } from "@/lib/clientSearch";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Inbox, Calendar, Clock, Users, FileText, DollarSign, Plus, Bell, UserCircle2, CalendarPlus,
} from "lucide-react";

export function CommandPalette({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ clients: ClientHit[]; appts: any[] }>({ clients: [], appts: [] });
  const navigate = useNavigate();

  useEffect(() => {
    const inField = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // ⌘K — toggle palette
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // ⌘B — new booking
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setOpen(false);
        navigate("/staff/appointments/new");
        return;
      }
      // ⌘P — walk-in checkout (overrides browser print, intentional for front desk)
      if (mod && e.key.toLowerCase() === "p" && !e.shiftKey) {
        e.preventDefault();
        setOpen(false);
        navigate("/staff/checkout");
        return;
      }
      // ⌘F — find client (overrides browser find, intentional)
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setOpen(false);
        navigate("/staff/clients?focus=1");
        return;
      }
      // `/` opens palette when not typing in a field
      if (e.key === "/" && !mod && !e.altKey && !inField(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);


  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults({ clients: [], appts: [] }); return; }
    const q = query.trim();
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const [clients, appts] = await Promise.all([
        searchClients(q, 6),
        supabase.from("appointments").select("id, start_at, client_first_name, client_last_name, client_email")
          .or(`client_first_name.ilike.${like},client_last_name.ilike.${like},client_email.ilike.${like}`)
          .order("start_at", { ascending: false })
          .limit(6),
      ]);
      setResults({ clients, appts: appts.data ?? [] });
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  const go = (path: string) => { setOpen(false); setQuery(""); navigate(path); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search clients, appointments, or jump to…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {results.appts.length > 0 && (
          <CommandGroup heading="Appointments">
            {results.appts.map((a) => (
              <CommandItem key={a.id} value={`appt-${a.id}`} onSelect={() => go(`/staff/appointments/${a.id}`)}>
                <Calendar className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>{a.client_first_name} {a.client_last_name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.start_at).toLocaleString()}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.clients.length > 0 && (
          <CommandGroup heading="Clients">
            {results.clients.map((c, i) => (
              <CommandItem key={`client-${c.email ?? i}-${c.phone ?? ""}`} value={`client-${c.email ?? i}`} onSelect={() => go(`/staff/clients?q=${encodeURIComponent(c.email || c.last_name || "")}`)}>
                <UserCircle2 className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>{c.first_name} {c.last_name}</span>
                  <span className="text-xs text-muted-foreground">{c.email}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(results.clients.length > 0 || results.appts.length > 0) && <CommandSeparator />}

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => go("/staff/today")}><LayoutDashboard className="h-4 w-4" />Today</CommandItem>
          <CommandItem onSelect={() => go("/staff/inbox")}><Inbox className="h-4 w-4" />Inbox</CommandItem>
          <CommandItem onSelect={() => go("/staff/appointments/new")}>
            <Plus className="h-4 w-4" />New booking
            <kbd className="ml-auto text-[10px] text-muted-foreground">⌘B</kbd>
          </CommandItem>
          <CommandItem onSelect={() => go("/staff/clients?focus=1")}>
            <UserCircle2 className="h-4 w-4" />Find client
            <kbd className="ml-auto text-[10px] text-muted-foreground">⌘F</kbd>
          </CommandItem>
          <CommandItem onSelect={() => go("/staff/calendar")}><Calendar className="h-4 w-4" />Calendar</CommandItem>
          <CommandItem onSelect={() => go("/staff/checkout")}>
            <DollarSign className="h-4 w-4" />Walk-in checkout
            <kbd className="ml-auto text-[10px] text-muted-foreground">⌘P</kbd>
          </CommandItem>
          <CommandItem onSelect={() => go("/staff/messages")}><Inbox className="h-4 w-4" />Messages</CommandItem>
          <CommandItem onSelect={() => go("/staff/availability")}><Clock className="h-4 w-4" />My availability</CommandItem>
          <CommandItem onSelect={() => go("/staff/time-off")}><CalendarPlus className="h-4 w-4" />Time off</CommandItem>
          {isAdmin && <CommandItem onSelect={() => go("/staff/waitlist")}><Bell className="h-4 w-4" />Waitlist</CommandItem>}
          {isAdmin && <CommandItem onSelect={() => go("/staff/team")}><Users className="h-4 w-4" />Team</CommandItem>}
          {isAdmin && <CommandItem onSelect={() => go("/staff/services")}><DollarSign className="h-4 w-4" />Services & pricing</CommandItem>}
          {isAdmin && <CommandItem onSelect={() => go("/staff/consents")}><FileText className="h-4 w-4" />Consents</CommandItem>}
        </CommandGroup>

      </CommandList>
    </CommandDialog>
  );
}
