import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  clientSearch: string;
  setClientSearch: (v: string) => void;
  clientSearching: boolean;
  clientResults: any[];
  pickClient: (c: any) => void;
  walkInLocations: any[];
  walkInLocationId: string;
  setWalkInLocationId: (v: string) => void;
  walkInFirstName: string;
  setWalkInFirstName: (v: string) => void;
  walkInLastName: string;
  setWalkInLastName: (v: string) => void;
  walkInEmail: string;
  setWalkInEmail: (v: string) => void;
  walkInPhone: string;
  setWalkInPhone: (v: string) => void;
  walkInStarting: boolean;
  startWalkInSale: () => void;
};

export function WalkInSetupScreen(p: Props) {
  return (
    <div className="max-w-xl mx-auto p-4 md:p-8">
      <Link to="/staff/today" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="font-serif text-3xl mb-2">Front Desk Checkout</h1>
      <p className="text-sm text-muted-foreground mb-6">Search for an existing client or enter new client details.</p>
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="relative">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Search clients</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Name, email, or phone" value={p.clientSearch} onChange={(e) => p.setClientSearch(e.target.value)} />
          </div>
          {(p.clientSearching || p.clientResults.length > 0) && (
            <div className="absolute z-10 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
              {p.clientSearching && <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Searching…</div>}
              {!p.clientSearching && p.clientResults.length === 0 && <div className="p-3 text-xs text-muted-foreground">No matches</div>}
              {p.clientResults.map((c, i) => (
                <button key={i} type="button" onClick={() => p.pickClient(c)} className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border last:border-0">
                  <div className="text-sm font-medium">{c.first_name} {c.last_name}</div>
                  <div className="text-xs text-muted-foreground">{c.email || "—"}{c.phone ? ` · ${c.phone}` : ""}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Location</Label>
          <Select value={p.walkInLocationId} onValueChange={p.setWalkInLocationId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select location" /></SelectTrigger>
            <SelectContent>
              {p.walkInLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">First name</Label>
            <Input className="mt-1" value={p.walkInFirstName} onChange={(e) => p.setWalkInFirstName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Last name</Label>
            <Input className="mt-1" value={p.walkInLastName} onChange={(e) => p.setWalkInLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email (optional)</Label>
          <Input className="mt-1" type="email" value={p.walkInEmail} onChange={(e) => p.setWalkInEmail(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone (optional)</Label>
          <Input className="mt-1" value={p.walkInPhone} onChange={(e) => p.setWalkInPhone(e.target.value)} />
        </div>
        <Button className="w-full" onClick={p.startWalkInSale} disabled={p.walkInStarting}>
          {p.walkInStarting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Starting…</> : "Start Checkout"}
        </Button>
      </section>
    </div>
  );
}
