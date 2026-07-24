import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Archive } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

type Preset = {
  id: string;
  device_name: string;
  treatment_type: string;
  fitzpatrick: string | null;
  depth_mm: number | null;
  energy: number | null;
  energy_unit: string | null;
  passes: number | null;
  pulse_ms: number | null;
  pulse_hz: number | null;
  spot_size_mm: number | null;
  cooling: string | null;
  notes: string | null;
  is_archived: boolean;
};

const TREATMENT_TYPES = ["Laser", "RF", "RF Microneedling", "Microneedling", "IPL", "HIFU", "Ultrasound", "Other"];
const FITZPATRICK = ["I", "II", "III", "IV", "V", "VI"];
const ENERGY_UNITS = ["J/cm²", "mJ", "W", "%"];

const empty: Partial<Preset> = { treatment_type: "Laser", energy_unit: "J/cm²" };

export default function AdminDevicePresets() {
  usePageMeta({ title: "Device Presets · Staff" });
  const [rows, setRows] = useState<Preset[]>([]);
  const [editing, setEditing] = useState<Partial<Preset> | null>(null);

  async function load() {
    const { data } = await supabase
      .from("device_presets")
      .select("*")
      .order("device_name");
    setRows((data as Preset[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing?.device_name || !editing?.treatment_type) {
      toast.error("Device name and treatment type are required");
      return;
    }
    const payload: any = { ...editing };
    delete payload.id;
    const res = editing.id
      ? await supabase.from("device_presets").update(payload).eq("id", editing.id)
      : await supabase.from("device_presets").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Preset saved");
    setEditing(null);
    load();
  }

  async function archive(id: string) {
    await supabase.from("device_presets").update({ is_archived: true }).eq("id", id);
    toast.success("Archived");
    load();
  }

  const active = rows.filter(r => !r.is_archived);

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Device Presets</h1>
          <p className="text-sm text-muted-foreground">Reusable laser / RF / microneedling settings per device and Fitzpatrick type.</p>
        </div>
        <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(empty)}><Plus className="h-4 w-4 mr-1" /> New preset</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing?.id ? "Edit preset" : "New preset"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Device name"><Input value={editing?.device_name ?? ""} onChange={e => setEditing(p => ({ ...p, device_name: e.target.value }))} placeholder="e.g. Moxi 1927nm" /></Field>
              <Field label="Treatment type">
                <Select value={editing?.treatment_type ?? "Laser"} onValueChange={v => setEditing(p => ({ ...p, treatment_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TREATMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Fitzpatrick">
                <Select value={editing?.fitzpatrick ?? "any"} onValueChange={v => setEditing(p => ({ ...p, fitzpatrick: v === "any" ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {FITZPATRICK.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Depth (mm)"><NumberInput value={editing?.depth_mm} onChange={v => setEditing(p => ({ ...p, depth_mm: v }))} /></Field>
              <Field label="Energy"><NumberInput value={editing?.energy} onChange={v => setEditing(p => ({ ...p, energy: v }))} /></Field>
              <Field label="Energy unit">
                <Select value={editing?.energy_unit ?? "J/cm²"} onValueChange={v => setEditing(p => ({ ...p, energy_unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENERGY_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Passes"><NumberInput value={editing?.passes} onChange={v => setEditing(p => ({ ...p, passes: v }))} /></Field>
              <Field label="Pulse (ms)"><NumberInput value={editing?.pulse_ms} onChange={v => setEditing(p => ({ ...p, pulse_ms: v }))} /></Field>
              <Field label="Pulse rate (Hz)"><NumberInput value={editing?.pulse_hz} onChange={v => setEditing(p => ({ ...p, pulse_hz: v }))} /></Field>
              <Field label="Spot size (mm)"><NumberInput value={editing?.spot_size_mm} onChange={v => setEditing(p => ({ ...p, spot_size_mm: v }))} /></Field>
              <Field label="Cooling" className="col-span-2"><Input value={editing?.cooling ?? ""} onChange={e => setEditing(p => ({ ...p, cooling: e.target.value }))} placeholder="e.g. Contact cooling 5°C, Zimmer level 4" /></Field>
              <Field label="Notes" className="col-span-2"><Textarea rows={2} value={editing?.notes ?? ""} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} /></Field>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>Save preset</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Active presets ({active.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {active.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No presets yet. Create one to standardize device settings.</div>
          ) : (
            <div className="divide-y divide-border">
              {active.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.device_name} <span className="text-xs text-muted-foreground font-normal">· {r.treatment_type}{r.fitzpatrick ? ` · Fitz ${r.fitzpatrick}` : ""}</span></div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[
                        r.energy != null && `${r.energy}${r.energy_unit ?? ""}`,
                        r.depth_mm != null && `${r.depth_mm}mm`,
                        r.passes != null && `${r.passes} passes`,
                        r.pulse_ms != null && `${r.pulse_ms}ms`,
                        r.spot_size_mm != null && `${r.spot_size_mm}mm spot`,
                        r.cooling,
                      ].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => archive(r.id)}><Archive className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function NumberInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return <Input type="number" inputMode="decimal" step="any" value={value ?? ""} onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
}

