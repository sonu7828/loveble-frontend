import { useEffect, useState } from "react";
import { apiQuery } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { confirmDialog } from "@/components/ui/confirm";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

type Vendor = {
  id: string;
  name: string;
  category: string | null;
  touches_phi: boolean;
  baa_required: boolean;
  baa_status: string;
  baa_renewal_at: string | null;
  notes: string | null;
};

const STATUSES = ["none", "requested", "signed", "declined", "expired", "not_applicable"] as const;

const STATUS_STYLE: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  requested: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  signed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  declined: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  expired: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  not_applicable: "bg-muted text-muted-foreground",
};

const emptyVendor = (): Partial<Vendor> => ({
  name: "", category: "", touches_phi: true, baa_required: true, baa_status: "none",
  notes: "", baa_renewal_at: null,
});

export default function AdminVendors() {
  usePageMeta({ title: "Vendor Management" });

  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Vendor>>(emptyVendor());
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    let remoteVendors: Vendor[] = [];
    try {
      const { data, error } = await apiQuery("vendors" as any).select("*").order("name");
      if (!error && data) remoteVendors = (data as any) as Vendor[];
    } catch (e) { }

    const localDemoVendors: Vendor[] = JSON.parse(localStorage.getItem("rka_demo_vendors") || "[]");
    const deletedVendorIds: string[] = JSON.parse(localStorage.getItem("rka_deleted_vendor_ids") || "[]");
    const mergedList = [...remoteVendors];

    for (const loc of localDemoVendors) {
      if (deletedVendorIds.includes(loc.id)) continue;
      if (!mergedList.some((x) => x.id === loc.id)) {
        mergedList.push(loc);
      }
    }

    const finalList = mergedList.filter(v => !deletedVendorIds.includes(v.id));
    setRows(finalList);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(emptyVendor()); setOpen(true); }
  function openEdit(v: Vendor) { setForm(v); setOpen(true); }

  async function save() {
    if (!form.name?.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      name: form.name!.trim(),
      category: form.category || null,
      touches_phi: !!form.touches_phi,
      baa_required: !!form.baa_required,
      baa_status: form.baa_status || "none",
      baa_renewal_at: form.baa_renewal_at || null,
      notes: form.notes || null,
    };

    if (form.id) {
      try { await apiQuery("vendors" as any).update(payload).eq("id", form.id); } catch (e) { }
      const local: Vendor[] = JSON.parse(localStorage.getItem("rka_demo_vendors") || "[]");
      localStorage.setItem("rka_demo_vendors", JSON.stringify(local.map(v => v.id === form.id ? { ...v, ...payload } : v)));
    } else {
      try { await apiQuery("vendors" as any).insert(payload); } catch (e) { }
      const local: Vendor[] = JSON.parse(localStorage.getItem("rka_demo_vendors") || "[]");
      local.push({ id: `vendor-${Date.now()}`, ...payload });
      localStorage.setItem("rka_demo_vendors", JSON.stringify(local));
    }

    setSaving(false);
    setOpen(false);
    toast({ title: "Vendor saved successfully" });
    load();
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: "Delete vendor?", description: "This will remove the vendor from your records. This action cannot be undone.", destructive: true, confirmLabel: "Delete Vendor" }))) return;
    try { await apiQuery("vendors" as any).delete().eq("id", id); } catch (e) { }
    const local: Vendor[] = JSON.parse(localStorage.getItem("rka_demo_vendors") || "[]");
    localStorage.setItem("rka_demo_vendors", JSON.stringify(local.filter(v => v.id !== id)));

    const deletedIds: string[] = JSON.parse(localStorage.getItem("rka_deleted_vendor_ids") || "[]");
    if (!deletedIds.includes(id)) deletedIds.push(id);
    localStorage.setItem("rka_deleted_vendor_ids", JSON.stringify(deletedIds));

    toast({ title: "Vendor deleted" });
    load();
  }

  const renewalSoon = (d: string | null) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  };
  const overdue = (d: string | null) => d && new Date(d) < new Date();

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="font-serif text-3xl mb-1">Vendor Management</h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground flex-1">
            Track vendors and Business Associate Agreements.
          </p>
          <Button onClick={openNew} className="rounded-full shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> Add vendor
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground bg-card">
          No vendors yet — add your first one.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="p-3.5">Vendor Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Touches PHI</th>
                  <th className="p-3.5">BAA Status</th>
                  <th className="p-3.5">Renewal Date</th>
                  <th className="p-3.5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition">
                    <td className="p-3.5 font-medium text-foreground">{v.name}</td>
                    <td className="p-3.5 text-muted-foreground">{v.category || "—"}</td>
                    <td className="p-3.5">
                      {v.touches_phi ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Yes (PHI)</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">No</Badge>
                      )}
                    </td>
                    <td className="p-3.5">
                      <Badge className={STATUS_STYLE[v.baa_status] || "bg-muted"} variant="outline">
                        {v.baa_status.replace("_", " ")}
                      </Badge>
                      {!v.baa_required && <div className="text-[10px] text-muted-foreground mt-0.5">not required</div>}
                    </td>
                    <td className="p-3.5">
                      {v.baa_renewal_at ? (
                        <span className={overdue(v.baa_renewal_at) ? "text-red-600 font-medium" :
                          renewalSoon(v.baa_renewal_at) ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                          {v.baa_renewal_at}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(v)} className="h-8 w-8 rounded-full"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(v.id)} className="h-8 w-8 rounded-full text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>{form.id ? "Edit Vendor" : "Add New Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <Label>Vendor Name *</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acuity Scheduling" className="mt-1" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Scheduling, Email Marketing" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={!!form.touches_phi} onCheckedChange={(v) => setForm({ ...form, touches_phi: !!v })} />
                Touches PHI
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={!!form.baa_required} onCheckedChange={(v) => setForm({ ...form, baa_required: !!v })} />
                BAA Required
              </label>
            </div>
            <div>
              <Label>BAA Status</Label>
              <Select value={form.baa_status} onValueChange={(v) => setForm({ ...form, baa_status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Renewal Date</Label>
              <Input type="date" value={form.baa_renewal_at ?? ""} onChange={(e) => setForm({ ...form, baa_renewal_at: e.target.value || null })} className="mt-1" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
