import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  description: string | null;
  service_id: string | null;
  total_sessions: number;
  price_cents: number;
  validity_days: number | null;
  is_active: boolean;
};

type Service = { id: string; name: string };

export default function AdminTreatmentPlans() {
  const [items, setItems] = useState<Template[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: s }] = await Promise.all([
      (supabase as any).from("treatment_plan_templates").select("*").order("name"),
      supabase.from("services").select("id,name").eq("is_active", true).order("name"),
    ]);
    setItems(t ?? []);
    setServices(s ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing({ id: "", name: "", description: "", service_id: null, total_sessions: 3, price_cents: 0, validity_days: 365, is_active: true });
    setOpen(true);
  };
  const openEdit = (t: Template) => { setEditing({ ...t }); setOpen(true); };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name required");
    const payload = {
      name: editing.name.trim(),
      description: editing.description || null,
      service_id: editing.service_id || null,
      total_sessions: editing.total_sessions,
      price_cents: editing.price_cents,
      validity_days: editing.validity_days,
      is_active: editing.is_active,
    };
    const q = editing.id
      ? (supabase as any).from("treatment_plan_templates").update(payload).eq("id", editing.id)
      : (supabase as any).from("treatment_plan_templates").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
    load();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Package className="h-6 w-6"/>Treatment plans</h1>
          <p className="text-sm text-muted-foreground">Multi-session packages (e.g. 3-session laser).</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2"/>New plan</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin"/></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No plans yet.</div>
      ) : (
        <div className="grid gap-3">
          {items.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {t.name}
                  {!t.is_active && <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {t.total_sessions} sessions · ${(t.price_cents/100).toFixed(2)}
                  {t.validity_days ? ` · valid ${t.validity_days}d` : " · no expiry"}
                </div>
                {t.description && <div className="text-xs text-muted-foreground mt-1">{t.description}</div>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4"/></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} treatment plan</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={editing.name} onChange={(e)=>setEditing({...editing, name:e.target.value})} placeholder="3-Session Laser Hair Removal"/>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editing.description ?? ""} onChange={(e)=>setEditing({...editing, description:e.target.value})}/>
              </div>
              <div>
                <Label>Service (optional)</Label>
                <Select value={editing.service_id ?? "none"} onValueChange={(v)=>setEditing({...editing, service_id: v==="none"?null:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {services.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Sessions</Label>
                  <Input type="number" min={1} value={editing.total_sessions} onChange={(e)=>setEditing({...editing, total_sessions: Math.max(1, parseInt(e.target.value||"1"))})}/>
                </div>
                <div>
                  <Label>Price ($)</Label>
                  <Input type="number" min={0} step="0.01" value={(editing.price_cents/100).toFixed(2)} onChange={(e)=>setEditing({...editing, price_cents: Math.round(parseFloat(e.target.value||"0")*100)})}/>
                </div>
                <div>
                  <Label>Valid (days)</Label>
                  <Input type="number" min={0} value={editing.validity_days ?? ""} placeholder="∞" onChange={(e)=>setEditing({...editing, validity_days: e.target.value ? parseInt(e.target.value) : null})}/>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <div className="text-sm font-medium">Active</div>
                <Switch checked={editing.is_active} onCheckedChange={(v)=>setEditing({...editing, is_active:v})}/>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

