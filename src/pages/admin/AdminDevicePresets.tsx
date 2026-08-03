import { useEffect, useState, useMemo } from "react";
import { apiQuery } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Laptop, Plus, Pencil, Archive, Search, Filter, Wrench, ShieldCheck,
  AlertTriangle, Cpu, CheckCircle2, Clock, Sparkles, Activity, Layers, Trash2
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

const DEVICE_STATUS_STYLES: Record<string, { label: string; style: string }> = {
  active: { label: "Active & Ready", style: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  maintenance_due: { label: "Maintenance Due", style: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  in_service: { label: "In Service / Repair", style: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  calibrating: { label: "Calibrating", style: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  out_of_order: { label: "Out of Order", style: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
};

const TREATMENT_TYPES = ["Laser", "RF", "RF Microneedling", "Microneedling", "IPL / BBL", "HIFU", "Ultrasound", "Plasma", "Cryo", "Other"];
const FITZPATRICK = ["I", "II", "III", "IV", "V", "VI"];
const ENERGY_UNITS = ["J/cm²", "mJ", "W", "%"];

const DEFAULT_DEVICES: AestheticDevice[] = [
  {
    id: "dev-1",
    name: "Sciton Joule X (Moxi & BBL)",
    model: "Joule X Platform",
    serial_number: "SN-SCITON-9842",
    manufacturer: "Sciton Inc.",
    modality: "Laser",
    room_assignment: "Laser Suite 1",
    status: "active",
    pulse_count: 34200,
    pulse_limit: 50000,
    last_serviced_at: "2026-03-15",
    next_service_due: "2026-09-15",
    notes: "Includes 1927nm Moxi handpiece and BBL Hero dual-lamp scanner.",
    is_archived: false
  },
  {
    id: "dev-2",
    name: "InMode Morpheus8",
    model: "Morpheus8 RF Platform",
    serial_number: "SN-INMODE-4410",
    manufacturer: "InMode Ltd",
    modality: "RF Microneedling",
    room_assignment: "Treatment Room 2",
    status: "active",
    pulse_count: 18500,
    pulse_limit: 30000,
    last_serviced_at: "2026-02-10",
    next_service_due: "2026-08-10",
    notes: "Compatible with 24-pin Face and 40-pin Body tip attachments.",
    is_archived: false
  },
  {
    id: "dev-3",
    name: "Candela GentleMax Pro Dual",
    model: "GentleMax Pro 755/1064",
    serial_number: "SN-CANDELA-8821",
    manufacturer: "Candela Medical",
    modality: "Laser",
    room_assignment: "Laser Suite 2",
    status: "maintenance_due",
    pulse_count: 89100,
    pulse_limit: 100000,
    last_serviced_at: "2025-11-20",
    next_service_due: "2026-05-20",
    notes: "Dual wavelength 755nm Alex and 1064nm Nd:YAG with DCD cooling.",
    is_archived: false
  },
  {
    id: "dev-4",
    name: "Hydrafacial Syndeo",
    model: "Syndeo Touchscreen System",
    serial_number: "SN-HYDRA-1209",
    manufacturer: "BeautyHealth",
    modality: "Hydro-Dermabrasion",
    room_assignment: "Facial Room 1",
    status: "active",
    pulse_count: 1240,
    pulse_limit: 5000,
    last_serviced_at: "2026-05-01",
    next_service_due: "2026-11-01",
    notes: "Connected vortex-fusion delivery system.",
    is_archived: false
  },
  {
    id: "dev-5",
    name: "Canfield Visia Gen7",
    model: "Visia Complexion Analysis",
    serial_number: "SN-VISIA-7712",
    manufacturer: "Canfield Scientific",
    modality: "Diagnostic Camera",
    room_assignment: "Consultation Suite",
    status: "active",
    pulse_count: 3100,
    pulse_limit: null,
    last_serviced_at: "2026-01-15",
    next_service_due: "2027-01-15",
    notes: "Multispectral UV, cross-polarized photography.",
    is_archived: false
  },
  {
    id: "dev-6",
    name: "Alma Opus Plasma",
    model: "Opus Fractional Plasma",
    serial_number: "SN-ALMA-3391",
    manufacturer: "Alma Lasers",
    modality: "Laser",
    room_assignment: "Treatment Room 4",
    status: "in_service",
    pulse_count: 12800,
    pulse_limit: 25000,
    last_serviced_at: "2026-06-18",
    next_service_due: "2026-12-18",
    notes: "High frequency unipolar RF plasma tip calibration ongoing.",
    is_archived: false
  }
];

const DEFAULT_PRESETS: Preset[] = [
  {
    id: "p-1",
    device_id: "dev-1",
    device_name: "Sciton Joule X (Moxi & BBL)",
    treatment_type: "Laser",
    fitzpatrick: "III",
    depth_mm: 0.25,
    energy: 10,
    energy_unit: "mJ",
    passes: 4,
    pulse_ms: null,
    pulse_hz: 15,
    spot_size_mm: 10,
    cooling: "Forced Air Level 3",
    notes: "Moxi light resurfacing protocol for sun damage & fine lines.",
    is_archived: false
  },
  {
    id: "p-2",
    device_id: "dev-2",
    device_name: "InMode Morpheus8",
    treatment_type: "RF Microneedling",
    fitzpatrick: "IV",
    depth_mm: 3.0,
    energy: 30,
    energy_unit: "%",
    passes: 2,
    pulse_ms: 100,
    pulse_hz: null,
    spot_size_mm: null,
    cooling: "Topical Numbing 45 mins",
    notes: "Full face collagen remodeling protocol. Lower energy for Fitz IV.",
    is_archived: false
  },
  {
    id: "p-3",
    device_id: "dev-3",
    device_name: "Candela GentleMax Pro Dual",
    treatment_type: "Laser",
    fitzpatrick: "II",
    depth_mm: null,
    energy: 18,
    energy_unit: "J/cm²",
    passes: 1,
    pulse_ms: 3,
    pulse_hz: 1.5,
    spot_size_mm: 18,
    cooling: "DCD Cryo Spray 30/20",
    notes: "755nm Alexandrite Laser Hair Removal for lighter skin types.",
    is_archived: false
  },
  {
    id: "p-4",
    device_id: "dev-3",
    device_name: "Candela GentleMax Pro Dual",
    treatment_type: "Laser",
    fitzpatrick: "V",
    depth_mm: null,
    energy: 24,
    energy_unit: "J/cm²",
    passes: 1,
    pulse_ms: 20,
    pulse_hz: 1.5,
    spot_size_mm: 15,
    cooling: "DCD Cryo Spray 40/20",
    notes: "1064nm Nd:YAG Laser Hair Removal for darker Fitzpatrick skin tones.",
    is_archived: false
  },
  {
    id: "p-5",
    device_id: "dev-1",
    device_name: "Sciton Joule X (Moxi & BBL)",
    treatment_type: "IPL / BBL",
    fitzpatrick: "II",
    depth_mm: null,
    energy: 14,
    energy_unit: "J/cm²",
    passes: 2,
    pulse_ms: 15,
    pulse_hz: null,
    spot_size_mm: null,
    cooling: "Contact Cooling 5°C",
    notes: "BBL Hero Photofacial for pigmented lesions & sun spots.",
    is_archived: false
  }
];

const DEFAULT_MAINTENANCE: MaintenanceRecord[] = [
  {
    id: "m-1",
    device_name: "Candela GentleMax Pro Dual",
    service_date: "2025-11-20",
    technician: "BioMed Laser Techs Inc.",
    service_type: "Annual Safety & Optics Calibration",
    notes: "Replaced flashlamp and realigned 755nm laser cavity mirror.",
    cost: 1450
  },
  {
    id: "m-2",
    device_name: "InMode Morpheus8",
    service_date: "2026-02-10",
    technician: "InMode Field Service",
    service_type: "Handpiece Tip Assembly Replacement",
    notes: "Calibrated RF power board output and updated firmware v4.2.",
    cost: 850
  },
  {
    id: "m-3",
    device_name: "Sciton Joule X (Moxi & BBL)",
    service_date: "2026-03-15",
    technician: "Sciton Direct Service",
    service_type: "Routine Water Filter & Laser Optics Clean",
    notes: "Replaced deionization canister and calibrated BBL energy meter.",
    cost: 620
  }
];

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

export default function AdminDevicePresets() {
  usePageMeta({ title: "Device Inventory & Presets · Admin" });

  const [activeTab, setActiveTab] = useState("devices");

  // State lists
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

  async function loadData() {
    // 1. Load Presets from DB / LocalStorage
    let dbPresets: Preset[] = [];
    try {
      const { data } = await apiQuery("device_presets" as any).select("*").order("device_name");
      if (data) dbPresets = data as Preset[];
    } catch (e) { }

    const localPresets: Preset[] = JSON.parse(localStorage.getItem("rka_demo_presets") || "null") ?? DEFAULT_PRESETS;
    const deletedPresetIds: string[] = JSON.parse(localStorage.getItem("rka_deleted_preset_ids") || "[]");

    const mergedPresets = [...dbPresets];
    for (const p of localPresets) {
      if (deletedPresetIds.includes(p.id)) continue;
      if (!mergedPresets.some(x => x.id === p.id)) {
        mergedPresets.push(p);
      }
    }
    setPresets(mergedPresets.filter(p => !deletedPresetIds.includes(p.id)));

    // 2. Load Devices from LocalStorage
    const localDevices: AestheticDevice[] = JSON.parse(localStorage.getItem("rka_demo_devices") || "null") ?? DEFAULT_DEVICES;
    const deletedDevIds: string[] = JSON.parse(localStorage.getItem("rka_deleted_device_ids") || "[]");
    setDevices(localDevices.filter(d => !deletedDevIds.includes(d.id)));

    // 3. Load Maintenance
    const localMaint: MaintenanceRecord[] = JSON.parse(localStorage.getItem("rka_demo_maintenance") || "null") ?? DEFAULT_MAINTENANCE;
    setMaintenance(localMaint);
  }

  useEffect(() => {
    loadData();
  }, []);

  // --- Device Actions ---
  function saveDevice() {
    if (!editingDevice?.name?.trim() || !editingDevice?.serial_number?.trim()) {
      toast.error("Device name and serial number are required.");
      return;
    }
    const local: AestheticDevice[] = JSON.parse(localStorage.getItem("rka_demo_devices") || "null") ?? DEFAULT_DEVICES;
    let updated: AestheticDevice[];

    if (editingDevice.id) {
      updated = local.map(d => d.id === editingDevice.id ? ({ ...d, ...editingDevice } as AestheticDevice) : d);
    } else {
      const newDev: AestheticDevice = {
        id: `dev-${Date.now()}`,
        name: editingDevice.name!.trim(),
        model: editingDevice.model || editingDevice.name!,
        serial_number: editingDevice.serial_number!.trim(),
        manufacturer: editingDevice.manufacturer || "General Aesthetics",
        modality: editingDevice.modality || "Laser",
        room_assignment: editingDevice.room_assignment || "Treatment Room 1",
        status: (editingDevice.status as any) || "active",
        pulse_count: editingDevice.pulse_count ?? 0,
        pulse_limit: editingDevice.pulse_limit ?? null,
        last_serviced_at: editingDevice.last_serviced_at || new Date().toISOString().split("T")[0],
        next_service_due: editingDevice.next_service_due || null,
        notes: editingDevice.notes || null,
        is_archived: false
      };
      updated = [newDev, ...local];
    }

    localStorage.setItem("rka_demo_devices", JSON.stringify(updated));
    toast.success(editingDevice.id ? "Device details updated" : "New device registered");
    setEditingDevice(null);
    loadData();
  }

  async function deleteDevice(id: string) {
    if (!(await confirmDialog({
      title: "Remove device?",
      description: "This will remove the device from your active inventory.",
      destructive: true,
      confirmLabel: "Delete Device"
    }))) return;

    const local: AestheticDevice[] = JSON.parse(localStorage.getItem("rka_demo_devices") || "null") ?? DEFAULT_DEVICES;
    const updated = local.filter(d => d.id !== id);
    localStorage.setItem("rka_demo_devices", JSON.stringify(updated));

    const deletedIds: string[] = JSON.parse(localStorage.getItem("rka_deleted_device_ids") || "[]");
    if (!deletedIds.includes(id)) deletedIds.push(id);
    localStorage.setItem("rka_deleted_device_ids", JSON.stringify(deletedIds));

    toast.success("Device removed from inventory");
    loadData();
  }

  // --- Preset Actions ---
  async function savePreset() {
    if (!editingPreset?.device_name?.trim() || !editingPreset?.treatment_type) {
      toast.error("Device name and treatment type are required.");
      return;
    }
    const payload: any = { ...editingPreset };
    delete payload.id;

    if (editingPreset.id) {
      try { await apiQuery("device_presets" as any).update(payload).eq("id", editingPreset.id); } catch (e) { }
    } else {
      try { await apiQuery("device_presets" as any).insert(payload); } catch (e) { }
    }

    const local: Preset[] = JSON.parse(localStorage.getItem("rka_demo_presets") || "null") ?? DEFAULT_PRESETS;
    let updated: Preset[];

    if (editingPreset.id) {
      updated = local.map(p => p.id === editingPreset.id ? ({ ...p, ...payload } as Preset) : p);
    } else {
      const newP: Preset = { id: `preset-${Date.now()}`, ...payload, is_archived: false };
      updated = [newP, ...local];
    }

    localStorage.setItem("rka_demo_presets", JSON.stringify(updated));
    toast.success(editingPreset.id ? "Preset updated" : "Preset created");
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

    try { await apiQuery("device_presets" as any).update({ is_archived: true }).eq("id", id); } catch (e) { }

    const local: Preset[] = JSON.parse(localStorage.getItem("rka_demo_presets") || "null") ?? DEFAULT_PRESETS;
    localStorage.setItem("rka_demo_presets", JSON.stringify(local.filter(p => p.id !== id)));

    const deletedIds: string[] = JSON.parse(localStorage.getItem("rka_deleted_preset_ids") || "[]");
    if (!deletedIds.includes(id)) deletedIds.push(id);
    localStorage.setItem("rka_deleted_preset_ids", JSON.stringify(deletedIds));

    toast.success("Preset archived");
    loadData();
  }

  // --- Maintenance Actions ---
  function saveMaintenance() {
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

    const current: MaintenanceRecord[] = JSON.parse(localStorage.getItem("rka_demo_maintenance") || "null") ?? DEFAULT_MAINTENANCE;
    const updated = [record, ...current];
    localStorage.setItem("rka_demo_maintenance", JSON.stringify(updated));

    toast.success("Maintenance log added");
    setMaintenanceDialogOpen(false);
    setNewMaint({ device_name: "", technician: "", service_type: "Routine Calibration", notes: "", cost: "" });
    loadData();
  }

  // --- Filtered lists & Stats ---
  const activeDevices = useMemo(() => devices.filter(d => !d.is_archived), [devices]);

  const filteredDevices = useMemo(() => {
    return activeDevices.filter(d => {
      const matchSearch = !searchQuery.trim() ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.room_assignment.toLowerCase().includes(searchQuery.toLowerCase());
      const matchModality = modalityFilter === "all" || d.modality === modalityFilter;
      const matchStatus = statusFilter === "all" || d.status === statusFilter;
      return matchSearch && matchModality && matchStatus;
    });
  }, [activeDevices, searchQuery, modalityFilter, statusFilter]);

  const activePresets = useMemo(() => presets.filter(p => !p.is_archived), [presets]);

  const filteredPresets = useMemo(() => {
    return activePresets.filter(p => {
      const matchSearch = !searchQuery.trim() ||
        p.device_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.treatment_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchFitz = fitzFilter === "all" || p.fitzpatrick === fitzFilter;
      return matchSearch && matchFitz;
    });
  }, [activePresets, searchQuery, fitzFilter]);

  const stats = useMemo(() => {
    const totalDev = activeDevices.length;
    const ready = activeDevices.filter(d => d.status === "active").length;
    const maintDue = activeDevices.filter(d => d.status === "maintenance_due" || d.status === "out_of_order").length;
    const totalPresetsCount = activePresets.length;
    return { totalDev, ready, maintDue, totalPresetsCount };
  }, [activeDevices, activePresets]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight">Device Inventory & Presets</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Manage aesthetic lasers, energy devices, room assignments, maintenance schedules, and treatment presets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setEditingPreset(emptyPreset)} className="rounded-full text-xs shadow-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Preset
          </Button>
          <Button onClick={() => setEditingDevice(emptyDevice)} className="rounded-full text-xs shadow-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Register Device
          </Button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Devices</span>
            <Cpu className="h-4 w-4 text-primary/70" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-foreground">{stats.totalDev}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Registered clinic hardware</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Active & Ready</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-emerald-600">{stats.ready}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Calibrated in treatment rooms</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Maintenance Due</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-amber-600">{stats.maintDue}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Service or inspection needed</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Treatment Presets</span>
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-serif font-bold text-purple-600">{stats.totalPresetsCount}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Standardized laser protocols</p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl w-full sm:w-auto">
            <TabsTrigger value="devices" className="rounded-lg text-xs font-medium px-4">
              <Laptop className="h-3.5 w-3.5 mr-1.5" /> Devices ({activeDevices.length})
            </TabsTrigger>
            <TabsTrigger value="presets" className="rounded-lg text-xs font-medium px-4">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Treatment Presets ({activePresets.length})
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="rounded-lg text-xs font-medium px-4">
              <Wrench className="h-3.5 w-3.5 mr-1.5" /> Service Logs ({maintenance.length})
            </TabsTrigger>
          </TabsList>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search devices or presets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 text-xs rounded-xl bg-card h-8"
            />
          </div>
        </div>

        {/* TAB 1: DEVICE INVENTORY */}
        <TabsContent value="devices" className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-2xs text-xs">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-semibold text-muted-foreground">Filter By:</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={modalityFilter} onValueChange={setModalityFilter}>
                <SelectTrigger className="w-36 text-xs h-8 rounded-lg">
                  <SelectValue placeholder="Modality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modalities</SelectItem>
                  {MODALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 text-xs h-8 rounded-lg">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(DEVICE_STATUS_STYLES).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredDevices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground bg-card">
              No devices found matching your criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDevices.map((d) => {
                const statusMeta = DEVICE_STATUS_STYLES[d.status] || DEVICE_STATUS_STYLES.active;
                return (
                  <Card key={d.id} className="rounded-2xl border-border/80 hover:border-primary/40 transition shadow-2xs flex flex-col justify-between">
                    <CardHeader className="pb-3 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge variant="outline" className="text-[10px] bg-muted/60 mb-1">
                            {d.modality}
                          </Badge>
                          <CardTitle className="text-base font-semibold leading-tight">{d.name}</CardTitle>
                          <CardDescription className="text-xs text-muted-foreground mt-0.5">{d.manufacturer} · {d.model}</CardDescription>
                        </div>
                        <Badge className={`${statusMeta.style} text-[10px] shrink-0 font-semibold`} variant="outline">
                          {statusMeta.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs pb-3">
                      <div className="bg-muted/40 p-2.5 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Serial Number:</span>
                          <span className="font-mono font-medium text-foreground">{d.serial_number}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Room Assignment:</span>
                          <span className="font-medium text-foreground">{d.room_assignment}</span>
                        </div>
                        {d.pulse_count != null && (
                          <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
                            <span>Pulse / Cycle Count:</span>
                            <span className="font-medium text-foreground">
                              {d.pulse_count.toLocaleString()} {d.pulse_limit != null ? `/ ${d.pulse_limit.toLocaleString()}` : "pulses"}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span>Last Serviced: {d.last_serviced_at || "—"}</span>
                        {d.next_service_due && (
                          <span className={d.status === "maintenance_due" ? "text-amber-600 font-semibold" : ""}>
                            Due: {d.next_service_due}
                          </span>
                        )}
                      </div>

                      {d.notes && <p className="text-[11px] text-muted-foreground italic line-clamp-2 pt-1">{d.notes}</p>}
                    </CardContent>

                    <div className="px-4 py-2.5 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs rounded-b-2xl">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingPreset({ ...emptyPreset, device_name: d.name, device_id: d.id });
                        setActiveTab("presets");
                      }} className="h-7 text-[11px] text-primary">
                        + Add Preset
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingDevice(d)} className="h-7 w-7 rounded-full">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDevice(d.id)} className="h-7 w-7 rounded-full text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: CLINICAL TREATMENT PRESETS */}
        <TabsContent value="presets" className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-2xs text-xs">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-semibold text-muted-foreground">Fitzpatrick Type:</span>
            </div>
            <Select value={fitzFilter} onValueChange={setFitzFilter}>
              <SelectTrigger className="w-40 text-xs h-8 rounded-lg">
                <SelectValue placeholder="All Skin Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Skin Types</SelectItem>
                {FITZPATRICK.map(f => <SelectItem key={f} value={f}>Fitzpatrick Type {f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filteredPresets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground bg-card">
              No treatment presets found.
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                    <tr>
                      <th className="p-3.5 pl-4">Device & Protocol</th>
                      <th className="p-3.5">Fitzpatrick</th>
                      <th className="p-3.5">Energy & Parameters</th>
                      <th className="p-3.5">Cooling & Safety</th>
                      <th className="p-3.5 text-right pr-4 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPresets.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition text-xs">
                        <td className="p-3.5 pl-4">
                          <div className="font-medium text-foreground">{p.device_name}</div>
                          <div className="text-muted-foreground text-[11px] font-normal">{p.treatment_type}</div>
                          {p.notes && <div className="text-[11px] text-muted-foreground/80 mt-1 max-w-sm">{p.notes}</div>}
                        </td>
                        <td className="p-3.5">
                          {p.fitzpatrick ? (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 text-[10px]">
                              Fitzpatrick {p.fitzpatrick}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Any Type</Badge>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="font-mono text-foreground">
                            {[
                              p.energy != null && `${p.energy}${p.energy_unit ?? ""}`,
                              p.depth_mm != null && `${p.depth_mm}mm depth`,
                              p.passes != null && `${p.passes} passes`,
                              p.pulse_ms != null && `${p.pulse_ms}ms pulse`,
                              p.spot_size_mm != null && `${p.spot_size_mm}mm spot`,
                            ].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td className="p-3.5 text-muted-foreground">
                          {p.cooling || "Standard air / gel cooling"}
                        </td>
                        <td className="p-3.5 text-right pr-4 whitespace-nowrap">
                          <Button size="icon" variant="ghost" onClick={() => setEditingPreset(p)} className="h-8 w-8 rounded-full">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deletePreset(p.id)} className="h-8 w-8 rounded-full text-destructive">
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
        </TabsContent>

        {/* TAB 3: MAINTENANCE LOGS */}
        <TabsContent value="maintenance" className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-2xs text-xs">
            <span className="font-semibold text-muted-foreground">Laser Safety & Maintenance History</span>
            <Button size="sm" onClick={() => setMaintenanceDialogOpen(true)} className="rounded-xl text-xs h-8">
              <Wrench className="h-3.5 w-3.5 mr-1.5" /> Log Maintenance Event
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="p-3.5 pl-4">Service Date</th>
                    <th className="p-3.5">Device Name</th>
                    <th className="p-3.5">Service Type</th>
                    <th className="p-3.5">Certified Technician</th>
                    <th className="p-3.5">Service Notes</th>
                    <th className="p-3.5 text-right pr-4">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {maintenance.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition text-xs">
                      <td className="p-3.5 pl-4 font-mono font-medium text-foreground">{m.service_date}</td>
                      <td className="p-3.5 font-medium text-foreground">{m.device_name}</td>
                      <td className="p-3.5">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 text-[10px]">
                          {m.service_type}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-muted-foreground">{m.technician}</td>
                      <td className="p-3.5 text-muted-foreground max-w-xs">{m.notes}</td>
                      <td className="p-3.5 text-right pr-4 font-mono font-medium text-foreground">
                        {m.cost != null ? `$${m.cost.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOG: Register / Edit Device */}
      <Dialog open={!!editingDevice} onOpenChange={o => !o && setEditingDevice(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>{editingDevice?.id ? "Edit Device Details" : "Register New Device"}</DialogTitle>
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
                <Label className="text-xs font-semibold">Model / Platform</Label>
                <Input value={editingDevice?.model ?? ""} onChange={e => setEditingDevice(p => ({ ...p, model: e.target.value }))} placeholder="e.g. Joule X Platform" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Serial Number *</Label>
                <Input value={editingDevice?.serial_number ?? ""} onChange={e => setEditingDevice(p => ({ ...p, serial_number: e.target.value }))} placeholder="SN-XXXX-XXXX" className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Modality Category</Label>
                <Select value={editingDevice?.modality ?? "Laser"} onValueChange={v => setEditingDevice(p => ({ ...p, modality: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MODALITIES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Room Assignment</Label>
                <Input value={editingDevice?.room_assignment ?? ""} onChange={e => setEditingDevice(p => ({ ...p, room_assignment: e.target.value }))} placeholder="e.g. Laser Suite 1" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Operational Status</Label>
                <Select value={editingDevice?.status ?? "active"} onValueChange={v => setEditingDevice(p => ({ ...p, status: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEVICE_STATUS_STYLES).map(([k, val]) => <SelectItem key={k} value={k}>{val.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Current Pulse / Cycle Count</Label>
                <Input type="number" value={editingDevice?.pulse_count ?? ""} onChange={e => setEditingDevice(p => ({ ...p, pulse_count: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Pulse Limit before Service</Label>
                <Input type="number" value={editingDevice?.pulse_limit ?? ""} onChange={e => setEditingDevice(p => ({ ...p, pulse_limit: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Last Serviced Date</Label>
                <Input type="date" value={editingDevice?.last_serviced_at ?? ""} onChange={e => setEditingDevice(p => ({ ...p, last_serviced_at: e.target.value || null }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Next Service Due Date</Label>
                <Input type="date" value={editingDevice?.next_service_due ?? ""} onChange={e => setEditingDevice(p => ({ ...p, next_service_due: e.target.value || null }))} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Device Notes & Attachments</Label>
                <Textarea rows={2} value={editingDevice?.notes ?? ""} onChange={e => setEditingDevice(p => ({ ...p, notes: e.target.value }))} placeholder="Handpiece tips, cooling requirements, or laser safety warnings..." className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20">
            <Button variant="ghost" onClick={() => setEditingDevice(null)}>Cancel</Button>
            <Button onClick={saveDevice}>Save Device</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add / Edit Treatment Preset */}
      <Dialog open={!!editingPreset} onOpenChange={o => !o && setEditingPreset(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>{editingPreset?.id ? "Edit Treatment Preset" : "New Treatment Preset"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold">Device Name *</Label>
                <Input value={editingPreset?.device_name ?? ""} onChange={e => setEditingPreset(p => ({ ...p, device_name: e.target.value }))} placeholder="e.g. Sciton Joule X" className="mt-1" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold">Treatment Modality</Label>
                <Select value={editingPreset?.treatment_type ?? "Laser"} onValueChange={v => setEditingPreset(p => ({ ...p, treatment_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{TREATMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Fitzpatrick Skin Type</Label>
                <Select value={editingPreset?.fitzpatrick ?? "any"} onValueChange={v => setEditingPreset(p => ({ ...p, fitzpatrick: v === "any" ? null : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Skin Type</SelectItem>
                    {FITZPATRICK.map(f => <SelectItem key={f} value={f}>Fitzpatrick Type {f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Energy Output</Label>
                <Input type="number" step="any" value={editingPreset?.energy ?? ""} onChange={e => setEditingPreset(p => ({ ...p, energy: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Energy Unit</Label>
                <Select value={editingPreset?.energy_unit ?? "J/cm²"} onValueChange={v => setEditingPreset(p => ({ ...p, energy_unit: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ENERGY_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Target Depth (mm)</Label>
                <Input type="number" step="any" value={editingPreset?.depth_mm ?? ""} onChange={e => setEditingPreset(p => ({ ...p, depth_mm: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Passes</Label>
                <Input type="number" value={editingPreset?.passes ?? ""} onChange={e => setEditingPreset(p => ({ ...p, passes: e.target.value === "" ? null : Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Pulse Duration (ms)</Label>
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
                <Label className="text-xs font-semibold">Cooling Parameters</Label>
                <Input value={editingPreset?.cooling ?? ""} onChange={e => setEditingPreset(p => ({ ...p, cooling: e.target.value }))} placeholder="e.g. Contact Cooling 5°C, DCD Cryo Spray 30/20" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Clinical Protocol & Safety Notes</Label>
                <Textarea rows={2} value={editingPreset?.notes ?? ""} onChange={e => setEditingPreset(p => ({ ...p, notes: e.target.value }))} placeholder="Indications, test spots, numbing requirements..." className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20">
            <Button variant="ghost" onClick={() => setEditingPreset(null)}>Cancel</Button>
            <Button onClick={savePreset}>Save Preset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Log Maintenance Event */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>Log Maintenance / Calibration Event</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
            <div>
              <Label className="text-xs font-semibold">Target Device *</Label>
              <Select value={newMaint.device_name} onValueChange={v => setNewMaint(p => ({ ...p, device_name: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select Device" /></SelectTrigger>
                <SelectContent>
                  {devices.map(d => <SelectItem key={d.id} value={d.name}>{d.name} ({d.serial_number})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Service Type</Label>
              <Input value={newMaint.service_type} onChange={e => setNewMaint(p => ({ ...p, service_type: e.target.value }))} placeholder="e.g. Routine Calibration, Handpiece Tip Replacement" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Certified Technician / Vendor *</Label>
              <Input value={newMaint.technician} onChange={e => setNewMaint(p => ({ ...p, technician: e.target.value }))} placeholder="e.g. Sciton Direct Tech" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Service Cost ($)</Label>
              <Input type="number" value={newMaint.cost} onChange={e => setNewMaint(p => ({ ...p, cost: e.target.value }))} placeholder="e.g. 750" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Service Details & Calibration Results</Label>
              <Textarea rows={3} value={newMaint.notes} onChange={e => setNewMaint(p => ({ ...p, notes: e.target.value }))} placeholder="Replaced flashlamp, calibrated laser energy meter..." className="mt-1" />
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
