import { useEffect, useRef, useState } from "react";
import { Search, X, User, Loader2 } from "lucide-react";
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
 * Canonical client search + picker. Backed by `searchClients()` so every
 * surface (booking, checkout, new appointment, palette) shares one query path.
 */
export function ClientPicker({
  value,
  onChange,
  className = "",
  label = "Client",
  placeholder = "Search name, email, or phone…",
  alwaysShowSearch = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<boolean>(!!value.email);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      const hits = await searchClients(query, 8);
      setResults(hits);
      setLoading(false);
      setOpen(true);
    }, 200);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query]);

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

  if (picked && value.email && !alwaysShowSearch) {
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
        <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0">
          <X className="h-3 w-3" /> Change
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {label && <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>}
      <div className="relative mt-1.5">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-9 h-12"
          autoComplete="off"
        />
        {loading && <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {results.map((m) => (
            <button
              key={`${m.email ?? ""}-${m.phone ?? ""}-${m.first_name ?? ""}`}
              type="button"
              onClick={() => pick(m)}
              className="w-full px-3 py-2.5 text-left hover:bg-accent flex items-center justify-between gap-2 border-b border-border/50 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{m.first_name} {m.last_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {m.email || "—"}{m.phone ? ` · ${m.phone}` : ""}
                </div>
              </div>
              {m.visits > 0 && (
                <div className="text-[10px] text-muted-foreground shrink-0">{m.visits} visit{m.visits === 1 ? "" : "s"}</div>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setPicked(false); setOpen(false); }}
            className="w-full px-3 py-2 text-xs text-primary hover:bg-accent border-t border-border"
          >
            + New client (enter manually)
          </button>
        </div>
      )}
      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-border bg-popover p-3 text-xs text-muted-foreground space-y-2">
          <div>No match found for "{query}".</div>
          <button
            type="button"
            onClick={() => {
              const q = query.trim();
              const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
              const isPhone = /^[\d\s+()-]{7,}$/.test(q);
              const next: ClientPick = {
                firstName: value.firstName,
                lastName: value.lastName,
                email: value.email,
                phone: value.phone,
                dob: value.dob,
              };
              if (isEmail && !next.email) next.email = q.toLowerCase();
              else if (isPhone && !next.phone) next.phone = q;
              else if (!next.firstName) {
                const parts = q.split(/\s+/);
                next.firstName = parts[0] ?? "";
                if (parts.length > 1) next.lastName = parts.slice(1).join(" ");
              }
              onChange(next);
              setOpen(false);
              setQuery("");
            }}
            className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:opacity-90"
          >
            + Add as new client
          </button>
        </div>
      )}
    </div>
  );
}
