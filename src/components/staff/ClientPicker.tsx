import { useEffect, useRef, useState } from "react";
import { Search, X, User, Loader2, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchClients, type ClientHit } from "@/lib/clientSearch";

export interface ClientPick {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob?: string;
}

interface Props {
  value: ClientPick;
  onChange: (v: ClientPick) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  /** If true, always shows the search field even after a client is picked. */
  alwaysShowSearch?: boolean;
}

/**
 * Unified Combobox: Single input box that works as a Dropdown list and real-time Search.
 */
export function ClientPicker({
  value,
  onChange,
  className = "",
  label = "Client",
  placeholder = "Search or select client from list…",
  alwaysShowSearch = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientHit[]>([]);
  const [allClients, setAllClients] = useState<ClientHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<boolean>(!!value.email || !!value.firstName);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  const refreshClients = async () => {
    setLoading(true);
    try {
      const hits = await searchClients("", 50);
      setAllClients(hits);
    } catch {
      setAllClients([]);
    } finally {
      setLoading(false);
    }
  };

  // Load existing clients list for dropdown
  useEffect(() => {
    refreshClients();
  }, []);

  // Filter clients on query change
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const hits = await searchClients(query, 25);
        setResults(hits);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pick = (m: ClientHit) => {
    onChange({
      firstName: m.first_name ?? "",
      lastName: m.last_name ?? "",
      email: m.email ?? "",
      phone: m.phone ?? "",
      dob: m.dob ?? "",
    });
    setPicked(true);
    setOpen(false);
    setQuery("");
  };

  const clear = () => {
    onChange({ firstName: "", lastName: "", email: "", phone: "", dob: "" });
    setPicked(false);
    setQuery("");
  };

  // List of clients to display in dropdown (filtered results if typing, otherwise all clients)
  const displayList = query.trim() ? results : allClients;

  if (picked && (value.email || value.firstName) && !alwaysShowSearch) {
    return (
      <div className={`rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start justify-between gap-3 ${className}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4 text-primary" />
            {value.firstName} {value.lastName}
          </div>
          <div className="text-xs text-muted-foreground mt-1 truncate">{value.email}</div>
          {value.phone && <div className="text-xs text-muted-foreground">{value.phone}</div>}
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-md bg-background border border-border shadow-2xs font-medium transition-colors"
        >
          <X className="h-3.5 w-3.5 text-destructive" /> Change client
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>}
      
      {/* Unified Single Combobox Input */}
      <div className="relative mt-1.5 cursor-pointer">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); if (allClients.length === 0) refreshClients(); }}
          onClick={() => { setOpen(true); if (allClients.length === 0) refreshClients(); }}
          placeholder={placeholder}
          className="pl-9 pr-9 h-11 text-sm bg-background"
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <button
            type="button"
            onClick={() => { setOpen(!open); if (!open && allClients.length === 0) refreshClients(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* Floating Single Dropdown List (Shows on Click & Filters on Type) */}
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {loading && displayList.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading clients…
            </div>
          ) : displayList.length > 0 ? (
            displayList.map((m, idx) => (
              <button
                key={`${m.email ?? ""}-${m.phone ?? ""}-${m.first_name ?? ""}-${idx}`}
                type="button"
                onClick={() => pick(m)}
                className="w-full px-3.5 py-2.5 text-left hover:bg-accent flex items-center justify-between gap-2 border-b border-border/50 last:border-0 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.first_name || "Unnamed"} {m.last_name || "Client"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.email || "—"}{m.phone ? ` · ${m.phone}` : ""}
                  </div>
                </div>
                {m.visits > 0 && (
                  <div className="text-[10px] text-muted-foreground shrink-0">{m.visits} visit{m.visits === 1 ? "" : "s"}</div>
                )}
              </button>
            ))
          ) : (
            <div className="p-3 text-xs text-muted-foreground text-center">
              {query.trim() ? `No matching client found for "${query}".` : "No clients found."}
            </div>
          )}

          <button
            type="button"
            onClick={() => { setPicked(false); setOpen(false); }}
            className="w-full px-3.5 py-2.5 text-xs text-primary hover:bg-accent border-t border-border font-semibold text-center"
          >
            + Add as new client (enter details below)
          </button>
        </div>
      )}
    </div>
  );
}
