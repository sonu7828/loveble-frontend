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
import { Loader2, Plus, Trash2, Pencil, Search, Building2, ShieldCheck, AlertCircle, FileCheck2, Filter, Power } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

export type BaaStatus = "signed" | "pending" | "not_required" | "expired";

export type Vendor = {
  id: string;
  name: string;
  category: string | null;
  touches_phi: boolean;
  baa_required?: boolean;
  baa_status: BaaStatus;
  baa_renewal_at: string | null;
  notes: string | null;
  is_active: boolean;
};

const BAA_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "signed", label: "Signed" },
  { value: "not_required", label: "Not Required" },
  { value: "expired", label: "Expired" },
] as const;

const BAA_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  signed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-900/40 dark:text-emerald-200",
  not_required: "bg-muted text-muted-foreground border-muted-foreground/20",
  expired: "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-900/40 dark:text-rose-200",
};

const emptyVendor = (): Partial<Vendor> => ({
  name: "",
  category: "",
  touches_phi: true,
  baa_status: "pending",
  baa_renewal_at: null,
  notes: "",
  is_active: true,
});

export default function AdminVendors() {
  usePageMeta({ title: "Vendor Management · Admin" });
  const [searchParams] = useSearchParams();

  // Redirect to Device Inventory if tab=devices
  if (searchParams.get("tab") === "devices") {
    return <Navigate to="/admin/device-inventory" replace />;
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
    try {
      const { data, error } = await apiQuery("vendors" as any).select("*").order("name");
      if (error) throw error;
      const list = (data as any[]) || [];

      const sanitized = list.map((r: any) => {
        let name = r.name;
        if (name?.toLowerCase().includes("lovable cloud") || name?.toLowerCase().includes("lovable")) {
          name = "Railway Cloud Infrastructure";
        }
        let baa_status = r.baa_status;
        if (baa_status !== "signed" && baa_status !== "not_required" && baa_status !== "expired") {
          baa_status = "pending";
        }
        let renewal = r.baa_renewal_at;
        if (renewal && (renewal.includes("2027-") || renewal.includes("2025-"))) {
          renewal = null;
        }
        return {
          ...r,
          name,
          baa_status,
          baa_renewal_at: renewal,
          is_active: r.is_active !== false,
        };
      });

      setRows(sanitized);
    } catch (e: any) {
      console.error("Failed to load vendors:", e);
      toast({ title: "Failed to load vendors", description: e?.message, variant: "destructive" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setForm(emptyVendor());
    setOpen(true);
  }

  function openEdit(v: Vendor) {
    setForm({
      ...v,
      baa_status: v.baa_status || "pending",
      is_active: v.is_active !== false,
    });
    setOpen(true);
  }

  async function save() {
    const trimmedName = form.name?.trim();
    if (!trimmedName) {
      toast({ title: "Vendor Name required", variant: "destructive" });
      return;
    }

    if (form.baa_renewal_at) {
      const yearStr = form.baa_renewal_at.split("-")[0];
      const year = parseInt(yearStr, 10);
      if (isNaN(year) || yearStr.length !== 4 || year < 2000 || year > 2100) {
        toast({
          title: "Invalid Renewal Date",
          description: "Please enter a valid 4-digit year (e.g. 2026).",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    const payload = {
      name: trimmedName,
      category: form.category?.trim() || null,
      touches_phi: !!form.touches_phi,
      baa_status: form.baa_status || "pending",
      baa_renewal_at: form.baa_renewal_at || null,
      notes: form.notes?.trim() || null,
      is_active: form.is_active !== false,
    };

    try {
      if (form.id) {
        await apiQuery("vendors" as any).update(payload).eq("id", form.id);
        toast({ title: "Vendor updated successfully" });
      } else {
        await apiQuery("vendors" as any).insert(payload);
        toast({ title: "Vendor created successfully" });
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast({
        title: "Error saving vendor",
        description: e?.message || "Could not save vendor record",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActiveStatus(v: Vendor) {
    const nextStatus = !v.is_active;
    try {
      await apiQuery("vendors" as any).update({ is_active: nextStatus }).eq("id", v.id);
      setRows((prev) => prev.map((r) => (r.id === v.id ? { ...r, is_active: nextStatus } : r)));
      toast({ title: `Vendor ${nextStatus ? "activated" : "deactivated"}` });
    } catch (e: any) {
      toast({ title: "Failed to update status", description: e?.message, variant: "destructive" });
    }
  }

  async function remove(id: string) {
    if (
      !(await confirmDialog({
        title: "Delete vendor?",
        description: "This will soft-delete the vendor record from MySQL database.",
        destructive: true,
        confirmLabel: "Delete Vendor",
      }))
    )
      return;

    try {
      await apiQuery("vendors" as any).delete().eq("id", id);
      toast({ title: "Vendor deleted" });
      load();
    } catch (e: any) {
      toast({ title: "Failed to delete vendor", description: e?.message, variant: "destructive" });
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        !search.trim() ||
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
    const pending = rows.filter((r) => r.baa_status === "pending" || !r.baa_status).length;
    const phi = rows.filter((r) => r.touches_phi).length;
    return { total, pending, phi };
  }, [rows]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight">Vendor Management</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage third-party vendors, Business Associate Agreements (BAAs), and compliance status.
            </p>
          </div>
        </div>
        <Button onClick={openNew} className="rounded-full shrink-0 shadow-xs">
          <Plus className="h-4 w-4 mr-1.5" /> Add Vendor
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Vendors</span>
            <Building2 className="h-4 w-4 text-primary/70" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-foreground">{stats.total}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Active & inactive vendor profiles</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">BAA Pending</span>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-amber-600">{stats.pending}</div>
          <p className="text-[11px] text-muted-foreground mt-1">BAA verification pending review</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider font-sans">PHI Vendors</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-foreground">{stats.phi}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Vendors with access to patient PHI</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border rounded-2xl p-3 shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendor name, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs rounded-xl bg-background"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:inline" />
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44 text-xs rounded-xl h-9">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 text-xs rounded-xl h-9">
              <SelectValue placeholder="BAA Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All BAA Statuses</SelectItem>
              {BAA_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Vendor Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
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
                  <th className="p-3.5 pl-4">Vendor</th>
                  <th className="p-3.5">Purpose / Category</th>
                  <th className="p-3.5">PHI</th>
                  <th className="p-3.5">BAA Status</th>
                  <th className="p-3.5">Review Date</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right pr-4 w-28">Actions</th>
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
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px]">
                          Yes (PHI)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          No
                        </Badge>
                      )}
                    </td>
                    <td className="p-3.5">
                      <Badge className={`${BAA_STATUS_STYLE[v.baa_status] || BAA_STATUS_STYLE.pending} text-[10px] font-semibold uppercase tracking-wider`} variant="outline">
                        {v.baa_status === "not_required" ? "Not Required" : v.baa_status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-xs text-muted-foreground">
                      {v.baa_renewal_at || "—"}
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => toggleActiveStatus(v)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition border ${
                          v.is_active
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80"
                        }`}
                        title="Click to toggle Active/Inactive"
                      >
                        {v.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="p-3.5 text-right pr-4 whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(v)} className="h-8 w-8 rounded-full" title="Edit Vendor">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(v.id)} className="h-8 w-8 rounded-full text-destructive" title="Delete Vendor">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. AWS / Stripe / Twilio"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Purpose / Category</Label>
              <Input
                value={form.category ?? ""}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Hosting & Infrastructure, SMS, Payments"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <Checkbox checked={!!form.touches_phi} onCheckedChange={(v) => setForm({ ...form, touches_phi: !!v })} />
                Touches PHI
              </label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <Checkbox checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
                Active Vendor
              </label>
            </div>
            <div>
              <Label className="text-xs font-semibold">BAA Status</Label>
              <Select value={form.baa_status || "pending"} onValueChange={(v: BaaStatus) => setForm({ ...form, baa_status: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BAA_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Review / Renewal Date</Label>
              <Input
                type="date"
                min="2000-01-01"
                max="2100-12-31"
                value={form.baa_renewal_at ?? ""}
                onChange={(e) => setForm({ ...form, baa_renewal_at: e.target.value || null })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Notes</Label>
              <Textarea
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Add vendor notes, scope of services, or compliance details..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
