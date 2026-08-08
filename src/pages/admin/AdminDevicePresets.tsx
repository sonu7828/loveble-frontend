import { useEffect, useState, useMemo } from "react";
import { apiQuery } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";
import {
  Laptop, Plus, Pencil, Search, Wrench, AlertTriangle,
  CheckCircle2, Clock, Sparkles, Trash2, ChevronRight
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

type AestheticDevice = {
  id: string;
  name: string;
  model: string;
  serial_number: string;
  manufacturer: string;
  modality: string;
  room_assignment: string;
  status: "active" | "maintenance_due" | "in_service" | "calibrating" | "out_of_order";
  pulse_count: number | null;
  pulse_limit: number | null;
  last_serviced_at: string | null;
  next_service_due: string | null;
  notes: string | null;
  is_archived: boolean;
};

type Preset = {
  id: string;
  device_id?: string | null;
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

type MaintenanceRecord = {
  id: string;
  device_name: string;
  service_date: string;
  technician: string;
  service_type: string;
  notes: string;
  cost: number | null;
};

const MODALITIES = [
  "Laser",
  "RF Microneedling",
  "IPL / BBL",
  "Ultrasound / HIFU",
  "Body Contouring",
  "Hydro-Dermabrasion",
  "Diagnostic Camera",
  "Other"
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: "Active", color: "text-emerald-600", icon: CheckCircle2 },
  maintenance_due: { label: "Maintenance Due", color: "text-amber-600", icon: AlertTriangle },
  in_service: { label: "In Service", color: "text-blue-600", icon: Wrench },
  calibrating: { label: "Calibrating", color: "text-purple-600", icon: Clock },
  out_of_order: { label: "Out of Order", color: "text-rose-600", icon: AlertTriangle },
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  maintenance_due: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
  in_service: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25",
  calibrating: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25",
  out_of_order: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
};

const TREATMENT_TYPES = ["Laser", "RF", "RF Microneedling", "Microneedling", "IPL / BBL", "HIFU", "Ultrasound", "Plasma", "Cryo", "Other"];
const FITZPATRICK = ["I", "II", "III", "IV", "V", "VI"];
const ENERGY_UNITS = ["J/cm²", "mJ", "W", "%"];

const emptyDevice: Partial<AestheticDevice> = {
  name: "",
  model: "",
  serial_number: "",
  manufacturer: "",
  modality: "Laser",
  room_assignment: "Laser Suite 1",
  status: "active",
  notes: ""
};

const emptyPreset: Partial<Preset> = {
  treatment_type: "Laser",
  energy_unit: "J/cm²"
};

/* ─── Pulse progress mini-bar ─── */
function PulseBar({ count, limit }: { count: number | null; limit: number | null }) {
  if (count == null) return <span className="text-muted-foreground">—</span>;
  if (limit == null) return <span className="font-mono text-xs">{count.toLocaleString()}</span>;
  const pct = Math.min((count / limit) * 100, 100);
  const barColor = pct > 85 ? "bg-rose-500" : pct > 65 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
        {count.toLocaleString()}/{limit.toLocaleString()}
      </span>
    </div>
  );
}

/* ─── Device detail expandable row ─── */
function DeviceExpandedRow({ device, onEdit, onDelete, onAddPreset }: {
  device: AestheticDevice;
  onEdit: () => void;
  onDelete: () => void;
  onAddPreset: () => void;
}) {
  return (
    <tr className="bg-muted/20 border-b border-border">
      <td colSpan={6} className="p-0">
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-2">
            <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Device Info</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Serial</span>
                <span className="font-mono font-medium">{device.serial_number || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">{device.model || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manufacturer</span>
                <span className="font-medium">{device.manufacturer || "—"}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Service Schedule</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Serviced</span>
                <span className="font-medium">{device.last_serviced_at || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Service</span>
                <span className={`font-medium ${device.status === "maintenance_due" ? "text-amber-600" : ""}`}>
                  {device.next_service_due || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usage</span>
                <PulseBar count={device.pulse_count} limit={device.pulse_limit} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Notes & Actions</p>
            {device.notes && (
              <p className="text-muted-foreground italic text-[11px] leading-relaxed">{device.notes}</p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={onEdit} className="h-7 text-[11px] rounded-lg">
                <Pencil className="h-3 w-3 mr-1.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" onClick={onAddPreset} className="h-7 text-[11px] rounded-lg">
                <Plus className="h-3 w-3 mr-1.5" /> Add Preset
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 text-[11px] rounded-lg text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3 mr-1.5" /> Remove
              </Button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}


export default function AdminDevicePresets() {
  usePageMeta({ title: "Device Inventory & Presets · Admin" });

  const [activeTab, setActiveTab] = useState("devices");

  // State lists — standard database-backed initial state
  const [devices, setDevices] = useState<AestheticDevice[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);

  // Dialog states
  const [editingDevice, setEditingDevice] = useState<Partial<AestheticDevice> | null>(null);
  const [editingPreset, setEditingPreset] = useState<Partial<Preset> | null>(null);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [newMaint, setNewMaint] = useState<{ device_name: string; technician: string; service_type: string; notes: string; cost: string }>({
    device_name: "", technician: "", service_type: "Routine Calibration", notes: "", cost: ""
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [modalityFilter, setModalityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fitzFilter, setFitzFilter] = useState("all");

  // Expand state for device rows
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);

  async function loadData() {
    // 1. Fetch devices from Live DB
    try {
      const { data: devData } = await apiQuery("aesthetic_devices").select("*");
      setDevices(Array.isArray(devData) ? devData : []);
    } catch {
      setDevices([]);
    }

    // 2. Fetch treatment presets from Live DB
    try {
      const { data: presetData } = await apiQuery("device_presets").select("*");
      setPresets(Array.isArray(presetData) ? presetData : []);
    } catch {
      setPresets([]);
    }

    // 3. Fetch maintenance service logs from Live DB
    try {
      const { data: maintData } = await apiQuery("device_maintenance").select("*");
      setMaintenance(Array.isArray(maintData) ? maintData : []);
    } catch {
      setMaintenance([]);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // --- Device Actions ---
  async function saveDevice() {
    if (!editingDevice?.name?.trim() || !editingDevice?.serial_number?.trim()) {
      toast.error("Device name and serial number are required.");
      return;
    }

    const payload: Partial<AestheticDevice> = {
      name: editingDevice.name!.trim(),
      model: editingDevice.model || editingDevice.name!,
      serial_number: editingDevice.serial_number!.trim(),
      manufacturer: editingDevice.manufacturer || "General Aesthetics",
      modality: editingDevice.modality || "Laser",
      room_assignment: editingDevice.room_assignment || "Treatment Room 1",
      status: editingDevice.status || "active",
      pulse_count: editingDevice.pulse_count ?? null,
      pulse_limit: editingDevice.pulse_limit ?? null,
      last_serviced_at: editingDevice.last_serviced_at || null,
      next_service_due: editingDevice.next_service_due || null,
      notes: editingDevice.notes || null,
      is_archived: false,
    };

    if (editingDevice.id) {
      await apiQuery("aesthetic_devices").update(payload).eq("id", editingDevice.id);
      toast.success("Device details updated");
    } else {
      const newDev = { id: `dev-${Date.now()}`, ...payload };
      await apiQuery("aesthetic_devices").insert(newDev);
      toast.success("New device registered in database");
    }

    setEditingDevice(null);
    loadData();
  }

  async function deleteDevice(id: string) {
    if (!(await confirmDialog({
      title: "Remove device?",
      description: "This will permanently remove the device from your inventory database.",
      destructive: true,
      confirmLabel: "Delete Device"
    }))) return;

    await apiQuery("aesthetic_devices").delete().eq("id", id);
    toast.success("Device removed from database");
    setExpandedDeviceId(null);
    loadData();
  }

  // --- Preset Actions ---
  async function savePreset() {
    if (!editingPreset?.device_name?.trim() || !editingPreset?.treatment_type) {
      toast.error("Device name and treatment type are required.");
      return;
    }

    const payload: Partial<Preset> = {
      device_id: editingPreset.device_id || null,
      device_name: editingPreset.device_name.trim(),
      treatment_type: editingPreset.treatment_type,
      fitzpatrick: editingPreset.fitzpatrick || null,
      depth_mm: editingPreset.depth_mm ?? null,
      energy: editingPreset.energy ?? null,
      energy_unit: editingPreset.energy_unit || "J/cm²",
      passes: editingPreset.passes ?? null,
      pulse_ms: editingPreset.pulse_ms ?? null,
      pulse_hz: editingPreset.pulse_hz ?? null,
      spot_size_mm: editingPreset.spot_size_mm ?? null,
      cooling: editingPreset.cooling || null,
      notes: editingPreset.notes || null,
      is_archived: false,
    };

    if (editingPreset.id) {
      await apiQuery("device_presets").update(payload).eq("id", editingPreset.id);
      toast.success("Preset updated");
    } else {
      const newPreset = { id: `preset-${Date.now()}`, ...payload };
      await apiQuery("device_presets").insert(newPreset);
      toast.success("Preset saved to database");
    }

    setEditingPreset(null);
    loadData();
  }

  async function deletePreset(id: string) {
    if (!(await confirmDialog({
      title: "Delete preset?",
      description: "Are you sure you want to delete this treatment preset?",
      destructive: true,
      confirmLabel: "Delete Preset"
    }))) return;

    await apiQuery("device_presets").delete().eq("id", id);
    toast.success("Preset removed from database");
    loadData();
  }

  // --- Maintenance Actions ---
  async function saveMaintenance() {
    if (!newMaint.device_name || !newMaint.technician) {
      toast.error("Device name and technician are required.");
      return;
    }

    const record: MaintenanceRecord = {
      id: `maint-${Date.now()}`,
      device_name: newMaint.device_name,
      service_date: new Date().toISOString().split("T")[0],
      technician: newMaint.technician,
      service_type: newMaint.service_type,
      notes: newMaint.notes,
      cost: newMaint.cost ? Number(newMaint.cost) : null
    };

    await apiQuery("device_maintenance").insert(record);
    toast.success("Maintenance log saved to database");
    setMaintenanceDialogOpen(false);
    setNewMaint({ device_name: "", technician: "", service_type: "Routine Calibration", notes: "", cost: "" });
    loadData();
  }

  // --- Filtered lists ---
  const activeDevices = useMemo(() => devices.filter(d => !d.is_archived), [devices]);

  const filteredDevices = useMemo(() => {
    return activeDevices.filter(d => {
      const matchSearch = !searchQuery.trim() ||
        (d.name && d.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.model && d.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.serial_number && d.serial_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.room_assignment && d.room_assignment.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchModality = modalityFilter === "all" || d.modality === modalityFilter;
      const matchStatus = statusFilter === "all" || d.status === statusFilter;
      return matchSearch && matchModality && matchStatus;
    });
  }, [activeDevices, searchQuery, modalityFilter, statusFilter]);

  const activePresets = useMemo(() => presets.filter(p => !p.is_archived), [presets]);

  const filteredPresets = useMemo(() => {
    return activePresets.filter(p => {
      const matchSearch = !searchQuery.trim() ||
        (p.device_name && p.device_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.treatment_type && p.treatment_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchFitz = fitzFilter === "all" || p.fitzpatrick === fitzFilter;
      return matchSearch && matchFitz;
    });
  }, [activePresets, searchQuery, fitzFilter]);

  // Quick summary counts
  const readyCount = activeDevices.filter(d => d.status === "active").length;
  const needsAttentionCount = activeDevices.filter(d => d.status === "maintenance_due" || d.status === "out_of_order").length;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">

      {/* ── Header: Title + Action buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight">Device Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeDevices.length} device{activeDevices.length !== 1 ? "s" : ""} registered
            {readyCount > 0 && <span className="text-emerald-600"> · {readyCount} active</span>}
            {needsAttentionCount > 0 && <span className="text-amber-600"> · {needsAttentionCount} need attention</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setEditingPreset(emptyPreset)} className="rounded-lg text-xs h-9">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> New Preset
          </Button>
          <Button onClick={() => setEditingDevice(emptyDevice)} className="rounded-lg text-xs h-9">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Device
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl w-full sm:w-auto">
            <TabsTrigger value="devices" className="rounded-lg text-xs font-medium px-4">
              <Laptop className="h-3.5 w-3.5 mr-1.5" /> Devices ({activeDevices.length})
            </TabsTrigger>
            <TabsTrigger value="presets" className="rounded-lg text-xs font-medium px-4">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Presets ({activePresets.length})
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="rounded-lg text-xs font-medium px-4">
              <Wrench className="h-3.5 w-3.5 mr-1.5" /> Service Logs ({maintenance.length})
            </TabsTrigger>
          </TabsList>

          {/* Unified search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 text-xs rounded-xl bg-card h-8"
            />
          </div>
        </div>

        {/* ════════ TAB 1: DEVICES ════════ */}
        <TabsContent value="devices" className="space-y-3 pt-3">
          {/* Compact filter row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Select value={modalityFilter} onValueChange={setModalityFilter}>
              <SelectTrigger className="w-[140px] text-xs h-8 rounded-lg bg-card">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {MODALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] text-xs h-8 rounded-lg bg-card">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(modalityFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => { setModalityFilter("all"); setStatusFilter("all"); }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Device Table */}
          {filteredDevices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card">
              <Laptop className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No devices registered in database</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Add Device" to register aesthetic hardware.</p>
              <Button onClick={() => setEditingDevice(emptyDevice)} className="mt-4 rounded-lg text-xs h-8">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add First Device
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                    <tr>
                      <th className="p-3 pl-4 w-8"></th>
                      <th className="p-3">Device</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Room</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredDevices.map((d) => {
                      const statusCfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.active;
                      const StatusIcon = statusCfg.icon;
                      const isExpanded = expandedDeviceId === d.id;
                      return (
                        <>
                          <tr
                            key={d.id}
                            className={`hover:bg-muted/30 transition cursor-pointer ${isExpanded ? "bg-muted/20" : ""}`}
                            onClick={() => setExpandedDeviceId(isExpanded ? null : d.id)}
                          >
                            <td className="p-3 pl-4">
                              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-foreground">{d.name}</div>
                              <div className="text-[11px] text-muted-foreground">{d.manufacturer || "Aesthetic Device"}</div>
                            </td>
                            <td className="p-3">
                              <span className="text-xs text-muted-foreground">{d.modality}</span>
                            </td>
                            <td className="p-3">
                              <span className="text-xs">{d.room_assignment}</span>
                            </td>
                            <td className="p-3">
                              <Badge
                                variant="outline"
                                className={`${STATUS_BADGE[d.status] || STATUS_BADGE.active} text-[10px] font-medium gap-1`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {statusCfg.label}
                              </Badge>
                            </td>
                            <td className="p-3 text-right pr-4">
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={(e) => { e.stopPropagation(); setEditingDevice(d); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 rounded-full text-destructive"
                                onClick={(e) => { e.stopPropagation(); deleteDevice(d.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <DeviceExpandedRow
                              key={`${d.id}-expanded`}
                              device={d}
                              onEdit={() => setEditingDevice(d)}
                              onDelete={() => deleteDevice(d.id)}
                              onAddPreset={() => {
                                setEditingPreset({ ...emptyPreset, device_name: d.name, device_id: d.id });
                                setActiveTab("presets");
                              }}
                            />
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ════════ TAB 2: TREATMENT PRESETS ════════ */}
        <TabsContent value="presets" className="space-y-3 pt-3">
          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Select value={fitzFilter} onValueChange={setFitzFilter}>
              <SelectTrigger className="w-[160px] text-xs h-8 rounded-lg bg-card">
                <SelectValue placeholder="All Skin Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Skin Types</SelectItem>
                {FITZPATRICK.map(f => <SelectItem key={f} value={f}>Fitzpatrick {f}</SelectItem>)}
              </SelectContent>
            </Select>

            {fitzFilter !== "all" && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => setFitzFilter("all")}>
                Clear
              </Button>
            )}
          </div>

          {filteredPresets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No treatment presets saved</p>
              <p className="text-xs text-muted-foreground mt-1">Create a treatment preset protocol for your devices.</p>
              <Button onClick={() => setEditingPreset(emptyPreset)} className="mt-4 rounded-lg text-xs h-8">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Create First Preset
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPresets.map((p) => {
                const params = [
                  p.energy != null && `${p.energy} ${p.energy_unit ?? ""}`.trim(),
                  p.depth_mm != null && `${p.depth_mm}mm depth`,
                  p.passes != null && `${p.passes} pass${p.passes !== 1 ? "es" : ""}`,
                  p.pulse_ms != null && `${p.pulse_ms}ms`,
                  p.spot_size_mm != null && `${p.spot_size_mm}mm spot`,
                ].filter(Boolean);

                return (
                  <div
                    key={p.id}
                    className="group rounded-xl border border-border/80 bg-card p-4 hover:border-primary/30 transition shadow-xs"
                  >
                    {/* Top: Device + Treatment type */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{p.device_name}</p>
                        <p className="text-xs text-muted-foreground">{p.treatment_type}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => setEditingPreset(p)} className="h-7 w-7 rounded-full">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePreset(p.id)} className="h-7 w-7 rounded-full text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Parameters as inline chips */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {p.fitzpatrick && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-medium">
                          Fitz {p.fitzpatrick}
                        </span>
                      )}
                      {params.map((param, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-foreground text-[10px] font-mono">
                          {param}
                        </span>
                      ))}
                    </div>

                    {/* Cooling */}
                    {p.cooling && (
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-medium">Cooling:</span> {p.cooling}
                      </p>
                    )}

                    {/* Notes */}
                    {p.notes && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2 italic">{p.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ════════ TAB 3: SERVICE LOGS ════════ */}
        <TabsContent value="maintenance" className="space-y-3 pt-3">
          <div className="flex items-center justify-end">
            <Button size="sm" onClick={() => setMaintenanceDialogOpen(true)} className="rounded-lg text-xs h-8">
              <Wrench className="h-3.5 w-3.5 mr-1.5" /> Log Service Event
            </Button>
          </div>

          {maintenance.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card">
              <Wrench className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No service logs in database</p>
              <p className="text-xs text-muted-foreground mt-1">Record calibrations, repairs, and maintenance activities.</p>
              <Button onClick={() => setMaintenanceDialogOpen(true)} className="mt-4 rounded-lg text-xs h-8">
                <Wrench className="h-3.5 w-3.5 mr-1.5" /> Log First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {maintenance.map((m) => (
                <div key={m.id} className="rounded-xl border border-border bg-card p-4 hover:border-border/80 transition shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground">{m.device_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.service_type}</p>
                        {m.notes && <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2">{m.notes}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-muted-foreground">{m.service_date}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.technician}</p>
                      {m.cost != null && (
                        <p className="text-sm font-semibold text-foreground mt-1">${m.cost.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════ DIALOG: Register / Edit Device ═══════════════ */}
      <Dialog open={!!editingDevice} onOpenChange={o => !o && setEditingDevice(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>{editingDevice?.id ? "Edit Device" : "Register New Device"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Device Name *</Label>
                <Input value={editingDevice?.name ?? ""} onChange={e => setEditingDevice(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Sciton Joule X" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Manufacturer</Label>
                <Input value={editingDevice?.manufacturer ?? ""} onChange={e => setEditingDevice(p => ({ ...p, manufacturer: e.target.value }))} placeholder="e.g. Sciton Inc." className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Model</Label>
                <Input value={editingDevice?.model ?? ""} onChange={e => setEditingDevice(p => ({ ...p, model: e.target.value }))} placeholder="e.g. Joule X Platform" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Serial Number *</Label>
                <Input value={editingDevice?.serial_number ?? ""} onChange={e => setEditingDevice(p => ({ ...p, serial_number: e.target.value }))} placeholder="SN-XXXX-XXXX" className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Modality</Label>
                <Select value={editingDevice?.modality ?? "Laser"} onValueChange={v => setEditingDevice(p => ({ ...p, modality: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MODALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Room</Label>
                <Input value={editingDevice?.room_assignment ?? ""} onChange={e => setEditingDevice(p => ({ ...p, room_assignment: e.target.value }))} placeholder="e.g. Laser Suite 1" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Status</Label>
                <Select value={editingDevice?.status ?? "active"} onValueChange={v => setEditingDevice(p => ({ ...p, status: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, val]) => <SelectItem key={k} value={k}>{val.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Pulse Count</Label>
                <Input type="number" value={editingDevice?.pulse_count ?? ""} onChange={e => setEditingDevice(p => ({ ...p, pulse_count: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Pulse Limit</Label>
                <Input type="number" value={editingDevice?.pulse_limit ?? ""} onChange={e => setEditingDevice(p => ({ ...p, pulse_limit: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Last Serviced</Label>
                <Input type="date" value={editingDevice?.last_serviced_at ?? ""} onChange={e => setEditingDevice(p => ({ ...p, last_serviced_at: e.target.value || null }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Next Service Due</Label>
                <Input type="date" value={editingDevice?.next_service_due ?? ""} onChange={e => setEditingDevice(p => ({ ...p, next_service_due: e.target.value || null }))} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Notes</Label>
                <Textarea rows={2} value={editingDevice?.notes ?? ""} onChange={e => setEditingDevice(p => ({ ...p, notes: e.target.value }))} placeholder="Handpiece tips, cooling requirements…" className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20">
            <Button variant="ghost" onClick={() => setEditingDevice(null)}>Cancel</Button>
            <Button onClick={saveDevice}>Save Device</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ DIALOG: Add / Edit Treatment Preset ═══════════════ */}
      <Dialog open={!!editingPreset} onOpenChange={o => !o && setEditingPreset(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>{editingPreset?.id ? "Edit Preset" : "New Treatment Preset"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold">Device Name *</Label>
                <Input value={editingPreset?.device_name ?? ""} onChange={e => setEditingPreset(p => ({ ...p, device_name: e.target.value }))} placeholder="e.g. Sciton Joule X" className="mt-1" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold">Treatment Type</Label>
                <Select value={editingPreset?.treatment_type ?? "Laser"} onValueChange={v => setEditingPreset(p => ({ ...p, treatment_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{TREATMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Skin Type</Label>
                <Select value={editingPreset?.fitzpatrick ?? "any"} onValueChange={v => setEditingPreset(p => ({ ...p, fitzpatrick: v === "any" ? null : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {FITZPATRICK.map(f => <SelectItem key={f} value={f}>Fitzpatrick {f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Energy</Label>
                <Input type="number" step="any" value={editingPreset?.energy ?? ""} onChange={e => setEditingPreset(p => ({ ...p, energy: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Unit</Label>
                <Select value={editingPreset?.energy_unit ?? "J/cm²"} onValueChange={v => setEditingPreset(p => ({ ...p, energy_unit: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ENERGY_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Depth (mm)</Label>
                <Input type="number" step="any" value={editingPreset?.depth_mm ?? ""} onChange={e => setEditingPreset(p => ({ ...p, depth_mm: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Passes</Label>
                <Input type="number" value={editingPreset?.passes ?? ""} onChange={e => setEditingPreset(p => ({ ...p, passes: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Pulse (ms)</Label>
                <Input type="number" step="any" value={editingPreset?.pulse_ms ?? ""} onChange={e => setEditingPreset(p => ({ ...p, pulse_ms: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Pulse Rate (Hz)</Label>
                <Input type="number" step="any" value={editingPreset?.pulse_hz ?? ""} onChange={e => setEditingPreset(p => ({ ...p, pulse_hz: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Spot Size (mm)</Label>
                <Input type="number" step="any" value={editingPreset?.spot_size_mm ?? ""} onChange={e => setEditingPreset(p => ({ ...p, spot_size_mm: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Cooling</Label>
                <Input value={editingPreset?.cooling ?? ""} onChange={e => setEditingPreset(p => ({ ...p, cooling: e.target.value }))} placeholder="e.g. Contact Cooling 5°C" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Notes</Label>
                <Textarea rows={2} value={editingPreset?.notes ?? ""} onChange={e => setEditingPreset(p => ({ ...p, notes: e.target.value }))} placeholder="Indications, test spots, numbing requirements…" className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20">
            <Button variant="ghost" onClick={() => setEditingPreset(null)}>Cancel</Button>
            <Button onClick={savePreset}>Save Preset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ DIALOG: Log Maintenance Event ═══════════════ */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>Log Service Event</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
            <div>
              <Label className="text-xs font-semibold">Device *</Label>
              <Select value={newMaint.device_name} onValueChange={v => setNewMaint(p => ({ ...p, device_name: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select Device" /></SelectTrigger>
                <SelectContent>
                  {devices.length === 0 ? (
                    <SelectItem value="No registered devices" disabled>No registered devices</SelectItem>
                  ) : (
                    devices.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Service Type</Label>
              <Input value={newMaint.service_type} onChange={e => setNewMaint(p => ({ ...p, service_type: e.target.value }))} placeholder="e.g. Routine Calibration" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Technician / Vendor *</Label>
              <Input value={newMaint.technician} onChange={e => setNewMaint(p => ({ ...p, technician: e.target.value }))} placeholder="e.g. Sciton Direct Tech" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Cost ($)</Label>
              <Input type="number" value={newMaint.cost} onChange={e => setNewMaint(p => ({ ...p, cost: e.target.value }))} placeholder="e.g. 750" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Details</Label>
              <Textarea rows={3} value={newMaint.notes} onChange={e => setNewMaint(p => ({ ...p, notes: e.target.value }))} placeholder="What was done during service…" className="mt-1" />
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20">
            <Button variant="ghost" onClick={() => setMaintenanceDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveMaintenance}>Log Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
