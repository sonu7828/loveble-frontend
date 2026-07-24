import { confirmDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Smartphone, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function AdminTerminalSettings() {
  const { isAdmin } = useAuth();
  const [readers, setReaders] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: locs }, { data: readerRows, error: readerError }] = await Promise.all([
      supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
      supabase.from("terminal_readers").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    ]);
    const locationRows = locs ?? [];
    const locationNames = Object.fromEntries(locationRows.map((l: any) => [l.id, l.name]));
    setLocations(locationRows);
    if (readerError) {
      toast.error(`Could not load paired readers: ${readerError.message}`);
      setReaders([]);
    } else {
      setReaders((readerRows ?? []).map((reader: any) => ({
        ...reader,
        location_name: locationNames[reader.location_id] ?? "Unknown location",
      })));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const register = async () => {
    if (!locationId || !code || !label) { toast.error("Fill in all fields"); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("terminal-register-reader", {
      body: { locationId, registrationCode: code.trim(), label: label.trim() },
    });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error || error?.message); return; }
    toast.success("Reader paired!"); setCode(""); setLabel(""); load();
  };

  const removeReader = async (id: string) => {
    if (!(await confirmDialog({ title: "Remove this reader?", destructive: true, confirmLabel: "Remove" }))) return;
    await supabase.from("terminal_readers").update({ is_active: false }).eq("id", id);
    load();
  };

  if (!isAdmin) return <div className="p-8 text-sm text-muted-foreground">Admin only.</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="font-serif text-3xl mb-1">Terminal Readers</h1>
      <p className="text-sm text-muted-foreground mb-6">Pair Stripe Reader S700/S710 devices to a location. After pairing, every checkout at that location can send the total to the reader.</p>

      <section className="rounded-2xl border border-border bg-card p-5 mb-6">
        <h2 className="text-sm font-medium mb-4 flex items-center gap-2"><Smartphone className="h-4 w-4" /> Register a new reader</h2>
        <ol className="text-xs text-muted-foreground space-y-1 mb-4 list-decimal list-inside">
          <li>Power on the S710. Tap the gear icon → "Generate registration code".</li>
          <li>Enter the 3-word code below (e.g. apple-banana-cherry).</li>
          <li>Give it a label like "San Jose Front Desk".</li>
        </ol>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="Pick…" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Registration code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="apple-banana-cherry" />
          </div>
          <div>
            <Label className="text-xs">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Front Desk" />
          </div>
        </div>
        <Button className="mt-4" onClick={register} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Pair reader</Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium">Paired readers</h2>
          <Button size="sm" variant="ghost" onClick={load}><RefreshCcw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : readers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No readers yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {readers.filter((r) => r.is_active).map((r) => (
              <li key={r.id} className="py-3 flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{r.label} <span className="text-xs text-muted-foreground">· {r.location_name}</span></div>
                  <div className="text-xs text-muted-foreground">{r.device_type} · {r.serial_number} · status: {r.status}</div>
                </div>
                <button className="text-muted-foreground hover:text-destructive p-1" onClick={() => removeReader(r.id)}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

