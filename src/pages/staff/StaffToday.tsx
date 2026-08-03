import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Loader2, Clock, MapPin, UserCircle2, CreditCard, CheckCircle2, ChevronRight,
  MessageSquare, Plus, Check, AlertTriangle, Stethoscope, FileCheck, FileText,
  Pill, TestTube, Users, UserCheck, ShieldAlert, Bell, Activity, X,
  Calendar as CalIcon, Inbox, CheckSquare
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";
import { fetchApptServiceNames, combinedServiceLabel } from "@/lib/apptServices";
import { SmsThread } from "@/components/messaging/SmsThread";
import { fetchIncompleteCharts } from "@/lib/incompleteCharts";
import { sendNoShowSms } from "@/lib/noShowSms";
import { getDynamicProfileName } from "@/lib/userProfile";
import ProviderDashboard from "./ProviderDashboard";

type Appt = {
  id: string; status: string; start_at: string;
  client_first_name: string; client_last_name: string; client_email: string; client_phone: string | null;
  service_id: string; staff_id: string; location_id: string;
  checked_in_at: string | null;
  stripe_payment_method_id: string | null;
  service_name?: string;
  staff_name?: string;
};

const CLINIC_TIME_ZONE = "America/Los_Angeles";

function clinicTodayBounds() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const clinicDate = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    start: `${clinicDate}T00:00:00-07:00`,
    end: `${clinicDate}T23:59:59.999-07:00`,
  };
}

function formatClinicTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
}

function formatClinicDate(date = new Date()) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: CLINIC_TIME_ZONE,
  });
}

const STATUS_PILL: Record<string, string> = {
  pending: "bg-warning-soft text-warning-soft-foreground",
  approved: "bg-success-soft text-success-soft-foreground",
  arrived: "bg-info-soft text-info-soft-foreground",
  completed: "bg-secondary text-muted-foreground",
  no_show: "bg-destructive-soft text-destructive-soft-foreground",
  cancelled: "bg-secondary text-muted-foreground",
  denied: "bg-destructive-soft text-destructive-soft-foreground",
};

/* ── Medical Director Dashboard View ────────────────────────────────────────── */
function MedicalDirectorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [reviews, setReviews] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [activeStaffCount, setActiveStaffCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const [notesRes, gfeRes, staffRes]: any[] = await Promise.all([
        apiQuery("clinical_notes").select("id, client_id, provider_id, service_name, created_at, status").eq("cosign_required", true).catch(() => ({ data: [] })),
        apiQuery("gfe_records").select("id, client_name, provider_name, created_at, status").eq("status", "pending_review").catch(() => ({ data: [] })),
        apiQuery("staff_profiles").select("id").eq("is_provider", true).catch(() => ({ data: [] })),
      ]);
      const notes = (notesRes?.data ?? []).map((n: any) => ({
        id: n.id,
        client: n.client_id || "Patient",
        provider: n.provider_id || "Injector RN",
        service: n.service_name || "Clinical Treatment",
        type: "SOAP Chart Note",
        date: new Date(n.created_at).toLocaleDateString(),
      }));
      const gfes = (gfeRes?.data ?? []).map((g: any) => ({
        id: g.id,
        client: g.client_name || "Patient",
        provider: g.provider_name || "NP",
        service: "Good Faith Exam (GFE)",
        type: "Medical Assessment",
        date: new Date(g.created_at).toLocaleDateString(),
      }));
      setReviews([...notes, ...gfes]);
      setActiveStaffCount((staffRes?.data ?? []).length || 2);
    })();
  }, []);

  const handleOrderAction = (id: string, action: "approve" | "reject") => {
    setPendingOrders(prev => prev.filter(o => o.id !== id));
    toast.success(`Order ${action === "approve" ? "approved & e-signed" : "rejected"}`);
  };

  const directorName = getDynamicProfileName(user, "Medical Director") + " (Medical Director)";

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-2xl font-medium tracking-tight">Medical Director Dashboard</h1>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 font-medium px-2.5 py-0.5 text-xs">
              <Stethoscope className="h-3.5 w-3.5 mr-1 text-purple-600" /> Supervising Physician
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Chart note co-signing, Good Faith Exam governance, and prescription approvals.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-foreground">{directorName}</span>
          </div>
          <Button variant="default" size="sm" onClick={() => navigate("/staff/clinical/cosign")} className="h-9 rounded-xl text-xs gap-1.5 shadow-2xs">
            <FileCheck className="h-3.5 w-3.5" />
            <span>Cosign Queue</span>
          </Button>
        </div>
      </div>

      {/* 3 Streamlined KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Pending Co-Signatures */}
        <Card className="p-4 border border-border bg-card shadow-2xs hover:border-purple-500/30 transition rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Pending Co-Signatures</span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <FileCheck className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-semibold text-foreground">{reviews.length}</div>
          <div className="text-[11px] text-purple-600 font-medium mt-1">
            Chart notes & GFEs requiring MD sign-off
          </div>
        </Card>

        {/* KPI 2: Prescription Approvals */}
        <Card className="p-4 border border-border bg-card shadow-2xs hover:border-amber-500/30 transition rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Prescription Approvals</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Pill className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-semibold text-foreground">
            {pendingOrders.length}
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            Topical & oral script reviews
          </div>
        </Card>

        {/* KPI 3: Supervised Injectors */}
        <Card className="p-4 border border-border bg-card shadow-2xs hover:border-emerald-500/30 transition rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Supervised Injectors</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-semibold text-foreground">{activeStaffCount}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Clinical NP & RN injectors on floor
          </div>
        </Card>
      </div>

      {/* Main Sections: Pending Co-Signatures & Orders */}
      <div className="space-y-6">

        {/* Section 1: Pending Clinical Reviews & Co-Signatures */}
        <Card className="p-5 border border-border bg-card shadow-2xs space-y-4 rounded-2xl">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="font-serif text-lg font-medium tracking-tight flex items-center gap-2">
                <Stethoscope className="h-4.5 w-4.5 text-purple-600" /> Pending Chart Notes & GFE Co-Signatures
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Clinical chart notes and Good Faith Exams requiring supervising physician sign-off.</p>
            </div>
            {reviews.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-primary font-medium" onClick={() => navigate("/staff/clinical/cosign")}>
                View All Queue →
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-semibold">
                  <tr>
                    <th className="p-3">Patient</th>
                    <th className="p-3">Injector / Provider</th>
                    <th className="p-3">Service & Type</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reviews.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
                          <span className="font-medium text-xs text-foreground">All clinical notes and GFEs are co-signed.</span>
                          <span className="text-[11px] text-muted-foreground">Chart notes submitted by RNs and NPs will appear here for review.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reviews.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-semibold text-foreground">{r.client}</td>
                        <td className="p-3 text-muted-foreground">{r.provider}</td>
                        <td className="p-3">
                          <div className="font-medium text-foreground">{r.service}</div>
                          <div className="text-[10px] text-muted-foreground">{r.type}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{r.date}</td>
                        <td className="p-3 text-right">
                          <Button size="sm" className="h-7 text-xs rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium" onClick={() => navigate("/staff/clinical/cosign")}>
                            Review & Sign
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Section 2: Prescription Approvals */}
        <Card className="p-5 border border-border bg-card shadow-2xs space-y-4 rounded-2xl">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="font-serif text-lg font-medium tracking-tight flex items-center gap-2">
                <Pill className="h-4.5 w-4.5 text-amber-600" /> Pending Prescription Approvals
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Topical scripts and oral medications requiring Medical Director authorization.</p>
            </div>
            <Badge variant="outline" className="text-[10px] font-semibold">{pendingOrders.length} Pending</Badge>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
              <CheckCircle2 className="h-7 w-7 text-emerald-500/60 mx-auto" />
              <p className="text-xs font-medium text-foreground">No pending prescription approvals.</p>
              <p className="text-[11px] text-muted-foreground">Prescription requests submitted by clinical injectors will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((ord) => (
                <div key={ord.id} className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]" variant="outline">
                        {ord.type}
                      </Badge>
                      <span className="font-semibold text-foreground">{ord.detail}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Patient: <strong className="text-foreground">{ord.patient}</strong> • Prescribed by {ord.prescriber} • {ord.date}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2.5 font-medium" onClick={() => handleOrderAction(ord.id, "reject")}>
                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                    <Button size="sm" className="h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 font-medium" onClick={() => handleOrderAction(ord.id, "approve")}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve & Sign
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

/* ── Standard Staff Today View ─────────────────────────────────────────────── */
function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "warn" }) {
  const toneClass = tone === "warn" ? "border-warning/30 bg-warning-soft" : "border-border bg-card";
  const valueClass = tone === "warn" ? "text-warning-soft-foreground" : "text-foreground";
  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-serif text-2xl mt-0.5 ${valueClass}`}>{value}</div>
    </div>
  );
}

function StandardStaffToday() {
  const navigate = useNavigate();
  const { user, isMedicalDirector, isPrivacyOfficer, isNP, isRNInjector, isFrontDesk, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [recentPatients, setRecentPatients] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: appointmentRows } = await apiQuery("appointments").select("*").order("start_at", { ascending: false });
      const fetchedAppts = (appointmentRows ?? []) as Appt[];
      setAppts(fetchedAppts);

      const { data: clientRows } = await apiQuery("client_profiles").select("*").order("created_at", { ascending: false });

      const uniquePatientsMap = new Map<string, any>();
      (clientRows ?? []).forEach((c: any) => {
        const email = (c.email || "").toLowerCase();
        if (email) {
          uniquePatientsMap.set(email, {
            id: c.id || `client-${Date.now()}`,
            name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.name || "Patient",
            email: c.email || "—",
            phone: c.phone || "—",
            lastVisit: "Recent Patient",
          });
        }
      });

      fetchedAppts.forEach((a: any) => {
        const email = (a.client_email || "").toLowerCase();
        const clientName = `${a.client_first_name || ""} ${a.client_last_name || ""}`.trim() || "Patient";
        if (email && !uniquePatientsMap.has(email)) {
          uniquePatientsMap.set(email, {
            id: a.id,
            name: clientName,
            email: a.client_email || "—",
            phone: a.client_phone || "—",
            lastVisit: a.start_at ? new Date(a.start_at).toLocaleDateString() : "Today",
          });
        }
      });

      setRecentPatients(Array.from(uniquePatientsMap.values()).slice(0, 10));
    } catch (_e) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const approveAppointment = async (apptId: string) => {
    setApprovingId(apptId);
    try {
      const { error } = await apiQuery("appointments")
        .update({ status: "approved" })
        .eq("id", apptId);
      if (error) throw error;
      setAppts((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: "approved" } : a))
      );
      toast.success("Appointment approved!");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to approve appointment");
    } finally {
      setApprovingId(null);
    }
  };

  const pendingRequestsCount = appts.filter(a => a.status === "pending").length;
  const waitingPatientsCount = appts.filter(a => a.status === "arrived" || a.checked_in_at).length;

  const resolveStaffName = (staffId?: string, staffName?: string) => {
    if (staffName && staffName.trim() && !staffName.includes("-") && staffName.length < 35) return staffName;
    try {
      const approved: Array<{ id?: string; email: string; full_name?: string }> =
        JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
      const match = approved.find((s) => s.id === staffId || (staffId && s.email?.toLowerCase().includes(staffId.toLowerCase())));
      if (match?.full_name) return match.full_name;
    } catch { }
    return "Girish (Provider)";
  };

  const checkInAppt = async (apptId: string) => {
    try {
      const { error } = await apiQuery("appointments")
        .update({ status: "arrived", checked_in_at: new Date().toISOString() })
        .eq("id", apptId);
      if (error) throw error;
      setAppts((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: "arrived", checked_in_at: new Date().toISOString() } : a))
      );
      toast.success("Patient checked in!");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to check in");
    }
  };
  const staffName = getDynamicProfileName(user, "Staff Member");

  const toggleStaffTask = (id: number) => {
    setMyTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    toast.success("Task updated");
  };

  const portalTitle = isMedicalDirector
    ? "Medical Director Portal"
    : isPrivacyOfficer
      ? "Privacy & Security Officer Portal"
      : isNP
        ? "Nurse Practitioner Portal"
        : isRNInjector
          ? "RN Injector Portal"
          : isFrontDesk
            ? "Front Desk Receptionist Portal"
            : isAdmin
              ? "Admin & Practice Portal"
              : "Staff Portal";

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* ── Executive Staff Header ────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-card via-card to-primary/5 p-6 rounded-2xl border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold uppercase tracking-wider text-[10px]">
              <UserCheck className="h-3.5 w-3.5 mr-1" /> {portalTitle}
            </Badge>
            <span className="text-xs text-muted-foreground">• {formatClinicDate()}</span>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium">Welcome back, {staffName}</h1>
          <p className="text-xs text-muted-foreground">
            Overview of today's patient visits, front-desk check-ins, and booking requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl" onClick={() => navigate("/staff/messages")}>
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Messages
          </Button>
          <Button size="sm" className="h-9 text-xs rounded-xl bg-primary text-primary-foreground font-semibold" onClick={() => navigate("/staff/calendar")}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Booking
          </Button>
        </div>
      </div>

      {/* ── 4 KPI Cards Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Appointments */}
        <Card 
          className="p-4 border border-border bg-card shadow-xs hover:border-primary/30 transition rounded-xl cursor-pointer"
          onClick={() => navigate("/staff/calendar")}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Today's Appointments</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <CalIcon className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">{appts.length}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Confirmed for today</p>
        </Card>

<<<<<<< HEAD
        {/* KPI 2: Checked In Patients */}
=======
        {/* KPI 2: Waiting Patients */}
>>>>>>> 370fa0222fb141e5ee449fcab77a48c45b45ca4e
        <Card 
          className="p-4 border border-border bg-card shadow-xs hover:border-emerald-500/30 transition rounded-xl cursor-pointer"
          onClick={() => navigate("/staff/checkout")}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Checked In</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">{waitingPatientsCount}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Checked in &amp; in building
          </div>
        </Card>

        {/* KPI 3: Today's Check-ins */}
        <Card 
          className="p-4 border border-border bg-card shadow-xs hover:border-blue-500/30 transition rounded-xl cursor-pointer"
          onClick={() => navigate("/staff/checkout")}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Today's Check-ins</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <CheckSquare className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">
            {appts.filter(a => a.status === "arrived" || a.checked_in_at).length}
          </div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">
            Total check-ins today
          </div>
        </Card>

        {/* KPI 4: Booking Requests */}
        <Card 
          className="p-4 border border-border bg-card shadow-xs hover:border-purple-500/30 transition rounded-xl cursor-pointer"
          onClick={() => navigate("/staff/inbox")}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Booking Requests</span>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Inbox className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">{pendingRequestsCount}</div>
          <div className="text-[11px] text-purple-600 font-medium mt-1">
            Pending front desk review
          </div>
        </Card>
      </div>

      {/* ── Main Grid: Left Main Sections (2 Cols) + Right Sidebar (1 Col) ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT MAIN SECTIONS */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1: Today's Schedule */}
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <CalIcon className="h-4 w-4 text-primary" /> Today's Schedule
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Chronological timeline of today's client appointments and check-in status.</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{appts.length} Appointments</Badge>
            </div>

            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-medium">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Service</th>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {appts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <CalIcon className="h-8 w-8 text-muted-foreground/40" />
                            <span className="font-medium text-xs text-foreground">No appointments scheduled for today.</span>
                            <span className="text-[11px] text-muted-foreground">New patient bookings and clinic appointments will display here.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      appts.map((a) => (
                        <tr key={a.id} className="hover:bg-muted/30 transition">
                          <td className="p-3 font-mono text-muted-foreground">{formatClinicTime(a.start_at)}</td>
                          <td className="p-3 font-semibold text-foreground">{a.client_first_name} {a.client_last_name}</td>
                          <td className="p-3 text-muted-foreground">{a.service_name || a.service_id || "Aesthetic Treatment"}</td>
                          <td className="p-3 text-muted-foreground font-medium">{resolveStaffName(a.staff_id, a.staff_name)}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px] uppercase">{a.status}</Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {a.status !== "arrived" && a.status !== "checked_in" && a.status !== "completed" && a.status !== "cancelled" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 gap-1"
                                  onClick={() => checkInAppt(a.id)}
                                >
                                  <UserCheck className="h-3 w-3" />
                                  Check In
                                </Button>
                              )}

                              {(a.status === "arrived" || a.status === "checked_in" || a.status === "completed") && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs bg-primary text-primary-foreground gap-1"
                                  onClick={() => navigate(`/staff/checkout/${a.id}`)}
                                >
                                  <CreditCard className="h-3 w-3" />
                                  Checkout
                                </Button>
                              )}

                              <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => navigate(`/staff/calendar`)}>
                                Reschedule
                              </Button>

                              <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => navigate(`/staff/appointments/${a.id}`)}>
                                Details
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* Section 2: Recent Patients */}
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4 text-primary" /> Recent Patients
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Recently accessed patient profiles.</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1" onClick={() => navigate("/staff/clients")}>
                View All Patients <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-medium">
                    <tr>
                      <th className="p-3">Patient Name</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Last Visit</th>
                      <th className="p-3">Profile Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentPatients.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Users className="h-8 w-8 text-muted-foreground/40" />
                            <span className="font-medium text-xs text-foreground">No recent patient interactions recorded today.</span>
                            <span className="text-[11px] text-muted-foreground">Access patient profiles in the Patients directory.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      recentPatients.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30 transition">
                          <td className="p-3 font-semibold text-foreground">{p.name}</td>
                          <td className="p-3 text-muted-foreground">{p.email}</td>
                          <td className="p-3 text-muted-foreground">{p.lastVisit}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Active</Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate(`/staff/clients`)}>
                              View Profile →
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

        </div>

        {/* SMALL RIGHT SIDEBAR (1 COL) */}
        <div className="space-y-6">

          {/* 1. My Tasks */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-base font-normal tracking-tight flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" /> My Tasks
              </h3>
              <Badge variant="outline" className="text-[10px]">{myTasks.length} Pending</Badge>
            </div>

            {myTasks.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
                <Inbox className="h-7 w-7 text-muted-foreground/40 mx-auto" />
                <p className="text-xs font-medium text-foreground">No pending staff tasks.</p>
                <p className="text-[11px] text-muted-foreground">Assigned clinical notes and follow-ups will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myTasks.map((t) => (
                  <div key={t.id} className="p-2.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => toggleStaffTask(t.id)}
                        className="h-3.5 w-3.5 rounded border-border text-primary"
                      />
                      <span className={t.done ? "line-through text-muted-foreground" : "text-foreground"}>{t.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 2. Notifications */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs space-y-3.5 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-base font-normal tracking-tight flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" /> Notifications
              </h3>
              <Badge variant="outline" className="text-[10px]">{notifications.length} New</Badge>
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
                <Bell className="h-7 w-7 text-muted-foreground/40 mx-auto" />
                <p className="text-xs font-medium text-foreground">No unread notifications.</p>
                <p className="text-[11px] text-muted-foreground">Lab results, consent updates, and appointment alerts will display here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n, i) => (
                  <div key={i} className="p-2.5 rounded-xl border border-border bg-muted/20 text-xs text-foreground">
                    {n.text}
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>

      </div>
    </div>
  );
}

/* ── Security Officer Dashboard View ───────────────────────────────────────── */
function SecurityOfficerDashboard() {
  const { user } = useAuth();

  const officerName = getDynamicProfileName(user, "Privacy & Security Officer");

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl md:text-3xl tracking-tight text-foreground">
              Security Officer Portal
            </h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
              <ShieldAlert className="h-3 w-3 mr-1" /> HIPAA Officer
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Welcome back, {officerName}. Monitor HIPAA compliance, audits, and security alerts.
          </p>
        </div>
      </div>

      {/* Security-focused widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-border bg-card shadow-xs rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Open Breach Incidents</span>
            <div className="h-8 w-8 rounded-xl bg-destructive-soft text-destructive-soft-foreground flex items-center justify-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-foreground mt-2">0</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">No active incidents</p>
        </Card>

        <Card className="p-4 border border-border bg-card shadow-xs rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Pending PHI Access Reviews</span>
            <div className="h-8 w-8 rounded-xl bg-warning-soft text-warning-soft-foreground flex items-center justify-center">
              <FileCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-foreground mt-2">3</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Requires your approval</p>
        </Card>

        <Card className="p-4 border border-border bg-card shadow-xs rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Security Alerts</span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Bell className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-foreground mt-2">1</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Unusual login detected</p>
        </Card>

        <Card className="p-4 border border-border bg-card shadow-xs rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">BAA / Vendor Compliance</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-foreground mt-2">100%</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">All vendors verified</p>
        </Card>
      </div>

      {/* HIPAA Modules */}
      <h2 className="font-serif text-lg font-semibold text-foreground pt-4">HIPAA & Security Modules</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { title: "Compliance Overview", desc: "Overall practice HIPAA status", icon: ShieldAlert, link: "/staff/compliance/admin", color: "text-blue-600 bg-blue-500/10" },
          { title: "PHI Access Audit", desc: "View immutable access logs", icon: Activity, link: "/staff/audit-report", color: "text-purple-600 bg-purple-500/10" },
          { title: "HIPAA Policies", desc: "Review and manage policies", icon: FileText, link: "/staff/hipaa-policies", color: "text-emerald-600 bg-emerald-500/10" },
          { title: "Breach Incident Logs", desc: "Manage reported breaches", icon: ShieldAlert, link: "/staff/breach-report", color: "text-amber-600 bg-amber-500/10" },
          { title: "BAA & Vendors", desc: "Business Associate Agreements", icon: Users, link: "/staff/vendors", color: "text-rose-600 bg-rose-500/10" }
        ].map(mod => (
          <Link key={mod.title} to={mod.link} className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/50 transition flex items-start gap-4 shadow-xs">
            <div className={`p-3 rounded-xl shrink-0 ${mod.color}`}>
              <mod.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-serif text-base font-semibold text-foreground group-hover:text-primary transition">
                {mod.title}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{mod.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Staff Today Main Dispatcher Component ─────────────────────────────────── */
export default function StaffToday() {
  const { isMedicalDirector, isProvider, isPrivacyOfficer } = useAuth();

  if (isPrivacyOfficer) {
    return <SecurityOfficerDashboard />;
  }

  if (isMedicalDirector) {
    return <MedicalDirectorDashboard />;
  }

  if (isProvider) {
    return <ProviderDashboard />;
  }

  return <StandardStaffToday />;
}
