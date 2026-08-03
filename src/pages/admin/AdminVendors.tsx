import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
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
import { Loader2, Plus, Trash2, Pencil, Search, Building2, ShieldCheck, AlertCircle, FileCheck2, Filter } from "lucide-react";
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
  none: "bg-muted text-muted-foreground border-muted-foreground/30",
  requested: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-900/40 dark:text-amber-200",
  signed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-900/40 dark:text-emerald-200",
  declined: "bg-red-500/10 text-red-600 border-red-500/30 dark:bg-red-900/40 dark:text-red-200",
  expired: "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-900/40 dark:text-rose-200",
  not_applicable: "bg-muted text-muted-foreground border-muted-foreground/20",
};

const DEFAULT_DEMO_VENDORS: Vendor[] = [
  { id: "v-1", name: "AWS Cloud Infrastructure", category: "Hosting & Infrastructure", touches_phi: true, baa_required: true, baa_status: "signed", baa_renewal_at: "2027-01-15", notes: "AWS HIPAA Business Associate Addendum active." },
  { id: "v-2", name: "Stripe Payments", category: "Payment Gateway", touches_phi: false, baa_required: false, baa_status: "not_applicable", baa_renewal_at: null, notes: "Processes card tokens only. PCI-DSS Compliant." },
  { id: "v-3", name: "Twilio Programmable SMS", category: "Telehealth & Messaging", touches_phi: true, baa_required: true, baa_status: "signed", baa_renewal_at: "2026-11-30", notes: "Encrypted patient appointment reminder notifications." },
  { id: "v-4", name: "Quest Diagnostics Lab", category: "Laboratory & Pathology", touches_phi: true, baa_required: true, baa_status: "requested", baa_renewal_at: "2026-09-01", notes: "Pending updated BAA signature for new lab interface." },
  { id: "v-5", name: "Allergan Aesthetics Supply", category: "Medical & Injectable Supplies", touches_phi: false, baa_required: false, baa_status: "not_applicable", baa_renewal_at: null, notes: "Botox Cosmetic & Juvederm direct distributor." },
  { id: "v-6", name: "Galderma Aesthetics", category: "Medical & Injectable Supplies", touches_phi: false, baa_required: false, baa_status: "not_applicable", baa_renewal_at: null, notes: "Dysport & Restylane direct vendor." },
  { id: "v-7", name: "Google Workspace / Meet", category: "Email & Telehealth Video", touches_phi: true, baa_required: true, baa_status: "signed", baa_renewal_at: "2026-12-01", notes: "HIPAA BAA accepted for Google Workspace Enterprise." }
];

const emptyVendor = (): Partial<Vendor> => ({
  name: "", category: "", touches_phi: true, baa_required: true, baa_status: "none",
  notes: "", baa_renewal_at: null,
});

export default function AdminVendors() {
  usePageMeta({ title: "Vendor Management · Admin" });
  const [searchParams] = useSearchParams();

  // If user hits /staff/vendors?tab=devices, redirect to dedicated Device Inventory page!
  if (searchParams.get("tab") === "devices") {
    return <Navigate to="/staff/device-presets" replace />;
  }

  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Vendor>>(emptyVendor());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    let remoteVendors: Vendor[] = [];
    try {
      const { data, error } = await apiQuery("vendors" as any).select("*").order("name");
      if (!error && data) remoteVendors = (data as any) as Vendor[];
    } catch (e) { }

    const storedLocalRaw = localStorage.getItem("rka_demo_vendors");
    const localDemoVendors: Vendor[] = storedLocalRaw ? JSON.parse(storedLocalRaw) : DEFAULT_DEMO_VENDORS;
    const deletedVendorIds: string[] = JSON.parse(localStorage.getItem("rka_deleted_vendor_ids") || "[]");

    const combined = [...localDemoVendors, ...remoteVendors].filter(
      (v) => v && v.id && v.name && !deletedVendorIds.includes(v.id)
    );

    // Strict deduplication by vendor ID and normalized vendor name
    const vendorMap = new Map<string, Vendor>();
    const normNameMap = new Map<string, Vendor>();

    combined.forEach((v) => {
      const normName = v.name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

      if (!vendorMap.has(v.id) && !normNameMap.has(normName)) {
        vendorMap.set(v.id, v);
        normNameMap.set(normName, v);
      }
    });

    const finalList = Array.from(vendorMap.values());
    localStorage.setItem("rka_demo_vendors", JSON.stringify(finalList));
    setRows(finalList);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(emptyVendor()); setOpen(true); }
  function openEdit(v: Vendor) { setForm(v); setOpen(true); }

  async function save() {
    const trimmedName = form.name?.trim();
    if (!trimmedName) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }

    const normName = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Prevent adding vendor with duplicate name
    const duplicate = rows.find((r) => {
      if (form.id && r.id === form.id) return false;
      const rNorm = r.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return rNorm === normName;
    });

    if (duplicate) {
      toast({
        title: "Vendor already exists",
        description: `A vendor named "${duplicate.name}" is already in your records. Please edit the existing vendor instead of creating a duplicate.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload: any = {
      name: trimmedName,
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
      const updated = local.map((v) => (v.id === form.id ? { ...v, ...payload } : v));
      localStorage.setItem("rka_demo_vendors", JSON.stringify(updated));
    } else {
      const newId = `vendor-${Date.now()}`;
      const newVendor = { id: newId, ...payload };
      try { await apiQuery("vendors" as any).insert(newVendor); } catch (e) { }
      const local: Vendor[] = JSON.parse(localStorage.getItem("rka_demo_vendors") || "[]");
      local.push(newVendor);
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
  const overdue = (d: string | null) => d ? new Date(d) < new Date() : false;

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.category) set.add(r.category); });
    return Array.from(set);
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = !search.trim() ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.category && r.category.toLowerCase().includes(search.toLowerCase())) ||
        (r.notes && r.notes.toLowerCase().includes(search.toLowerCase()));
      const matchCat = categoryFilter === "all" || r.category === categoryFilter;
      const matchStatus = statusFilter === "all" || r.baa_status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    });
  }, [rows, search, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const signed = rows.filter(r => r.baa_status === "signed").length;
    const phi = rows.filter(r => r.touches_phi).length;
    const actionRequired = rows.filter(r => r.baa_required && (r.baa_status === "requested" || r.baa_status === "expired" || r.baa_status === "none" || overdue(r.baa_renewal_at))).length;
    return { total, signed, phi, actionRequired };
  }, [rows]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight">Vendor Management</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Track third-party vendors, Business Associate Agreements (BAAs), and HIPAA compliance status.
              </p>
            </div>
          </div>
        </div>
        <Button onClick={openNew} className="rounded-full shrink-0 shadow-xs">
          <Plus className="h-4 w-4 mr-1.5" /> Add Vendor
        </Button>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Vendors</span>
            <Building2 className="h-4 w-4 text-primary/70" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-foreground">{stats.total}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Active supplier profiles</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">BAAs Signed</span>
            <FileCheck2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-emerald-600">{stats.signed}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Compliant executed BAAs</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider font-sans">Touches PHI</span>
            <ShieldCheck className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-foreground">{stats.phi}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Vendors accessing patient data</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Action Needed</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-rose-600">{stats.actionRequired}</div>
          <p className="text-[11px] text-muted-foreground mt-1">BAA requested, expired or missing</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border rounded-2xl p-3 shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendor name, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-xs rounded-xl bg-background"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:inline" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-44 text-xs rounded-xl h-9">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 text-xs rounded-xl h-9">
              <SelectValue placeholder="BAA Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All BAA Statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Vendor Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground bg-card">
          No vendors found matching your criteria.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="p-3.5 pl-4">Vendor Name & Notes</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Touches PHI</th>
                  <th className="p-3.5">BAA Compliance</th>
                  <th className="p-3.5">Renewal Date</th>
                  <th className="p-3.5 text-right pr-4 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition">
                    <td className="p-3.5 pl-4">
                      <div className="font-medium text-foreground">{v.name}</div>
                      {v.notes && <div className="text-xs text-muted-foreground truncate max-w-md mt-0.5">{v.notes}</div>}
                    </td>
                    <td className="p-3.5 text-xs text-muted-foreground font-medium">{v.category || "—"}</td>
                    <td className="p-3.5">
                      {v.touches_phi ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px]">Yes (PHI)</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">No</Badge>
                      )}
                    </td>
                    <td className="p-3.5">
                      <Badge className={`${STATUS_STYLE[v.baa_status] || "bg-muted"} text-[10px] font-semibold uppercase tracking-wider`} variant="outline">
                        {v.baa_status.replace("_", " ")}
                      </Badge>
                      {!v.baa_required && <div className="text-[10px] text-muted-foreground mt-0.5">Not Required</div>}
                    </td>
                    <td className="p-3.5 text-xs">
                      {v.baa_renewal_at ? (
                        <span className={overdue(v.baa_renewal_at) ? "text-red-600 font-semibold flex items-center gap-1" :
                          renewalSoon(v.baa_renewal_at) ? "text-amber-600 font-semibold" : "text-muted-foreground"}>
                          {v.baa_renewal_at}
                          {overdue(v.baa_renewal_at) && <span className="text-[10px] bg-red-100 dark:bg-red-950 text-red-600 px-1.5 py-0.2 rounded-md">Overdue</span>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3.5 text-right pr-4 whitespace-nowrap">
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

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>{form.id ? "Edit Vendor" : "Add New Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
            <div>
              <Label className="text-xs font-semibold">Vendor Name *</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. AWS / Sciton / Quest" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Category</Label>
              <Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Telehealth, Infrastructure, Medical Supplies" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <Checkbox checked={!!form.touches_phi} onCheckedChange={(v) => setForm({ ...form, touches_phi: !!v })} />
                Touches PHI
              </label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <Checkbox checked={!!form.baa_required} onCheckedChange={(v) => setForm({ ...form, baa_required: !!v })} />
                BAA Required
              </label>
            </div>
            <div>
              <Label className="text-xs font-semibold">BAA Status</Label>
              <Select value={form.baa_status} onValueChange={(v) => setForm({ ...form, baa_status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Renewal Date</Label>
              <Input type="date" value={form.baa_renewal_at ?? ""} onChange={(e) => setForm({ ...form, baa_renewal_at: e.target.value || null })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Notes</Label>
              <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Add vendor details, contract terms, or contact information..." className="mt-1" />
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Save Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
