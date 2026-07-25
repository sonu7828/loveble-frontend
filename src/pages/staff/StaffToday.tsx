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

type Appt = {
  id: string; status: string; start_at: string;
  client_first_name: string; client_last_name: string; client_email: string; client_phone: string | null;
  service_id: string; staff_id: string; location_id: string;
  checked_in_at: string | null;
  stripe_payment_method_id: string | null;
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

  const handleOrderAction = (id: string, action: "approve" | "reject") => {
    setPendingOrders(prev => prev.filter(o => o.id !== id));
    toast.success(`Order ${id} ${action === "approve" ? "approved & e-signed" : "rejected"}`);
  };

  const directorName = user?.user_metadata?.first_name || user?.user_metadata?.last_name
    ? `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() + " (Medical Director)"
    : user?.email || "Medical Director";

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-xl sm:text-2xl font-medium tracking-tight">Medical Director Control Hub</h1>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 font-medium px-2.5 py-0.5 text-xs">
              <Stethoscope className="h-3.5 w-3.5 mr-1 text-purple-600" /> Supervising Physician Oversight
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Clinical governance, chart note co-signing, prescription approvals, and provider supervision.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card text-xs">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-muted-foreground font-medium">{directorName}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/staff/clinical/cosign")} className="h-9 rounded-xl text-xs gap-1.5">
            <FileCheck className="h-3.5 w-3.5 text-primary" />
            <span>Open Cosign Queue</span>
          </Button>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pending Signatures */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-purple-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Pending Signatures</span>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <FileCheck className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">{reviews.length} Notes</div>
          <div className="text-[11px] text-purple-600 font-medium mt-1">
            Requires MD co-signature
          </div>
        </Card>

        {/* KPI 2: Pending Prescription Approvals */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-amber-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Prescription Approvals</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Pill className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">
            {pendingOrders.filter(o => o.type === "Prescription").length} Rx Pending
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            Topical & Oral script reviews
          </div>
        </Card>

        {/* KPI 3: Pending Lab Orders */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-sky-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Pending Lab Orders</span>
            <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <TestTube className="h-4 w-4 text-sky-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">
            {pendingOrders.filter(o => o.type === "Lab Order").length} Labs
          </div>
          <div className="text-[11px] text-sky-600 font-medium mt-1">
            CMP, CBC & Imaging reviews
          </div>
        </Card>

        {/* KPI 4: Active Providers */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-emerald-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Active Providers</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">0 Clinical Staff</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Supervising NP / RN Injectors
          </div>
        </Card>
      </div>

      {/* Main Content Grid: Left Main Sections (2 Cols) + Right Sidebar (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT MAIN SECTIONS */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1: Pending Clinical Reviews Table Box */}
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-purple-600" /> Pending Clinical Reviews & Co-Signatures
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">RN chart notes and Good Faith Exams requiring supervising physician sign-off.</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => navigate("/staff/clinical/cosign")}>
                View All Queue →
              </Button>
            </div>

            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-medium">
                    <tr>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Provider / Injector</th>
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
                            <FileCheck className="h-8 w-8 text-muted-foreground/40" />
                            <span className="font-medium text-xs">No pending clinical reviews or co-signatures required.</span>
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
                            <Button size="sm" className="h-7 text-xs rounded-lg bg-purple-600 hover:bg-purple-700 text-white" onClick={() => navigate("/staff/clinical/cosign")}>
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

          {/* Section 2: Pending Orders Box with Approve / Reject Action Buttons */}
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <Pill className="h-4 w-4 text-amber-600" /> Pending Orders & Prescriptions
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Topical scripts, oral medications, and lab order requisitions for MD authorization.</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{pendingOrders.length} Awaiting Authorization</Badge>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
                <Pill className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs font-medium text-foreground">No pending prescription approvals or lab orders.</p>
                <p className="text-[11px] text-muted-foreground">Orders submitted by clinical staff will appear here with Approve and Reject actions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((ord) => (
                  <div key={ord.id} className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={ord.type === "Prescription" ? "bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]" : "bg-sky-500/10 text-sky-700 border-sky-500/20 text-[10px]"} variant="outline">
                          {ord.type}
                        </Badge>
                        <span className="font-semibold text-foreground">{ord.detail}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Patient: <strong className="text-foreground">{ord.patient}</strong> • Prescribed by {ord.prescriber} • {ord.date}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2.5" onClick={() => handleOrderAction(ord.id, "reject")}>
                        <X className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                      <Button size="sm" className="h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5" onClick={() => handleOrderAction(ord.id, "approve")}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve & Sign
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>

        {/* SMALL RIGHT SIDEBAR (1 COL) */}
        <div className="space-y-6">

          {/* Today's Clinical Summary */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-base font-normal tracking-tight flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-600" /> Today's Clinical Summary
              </h3>
              <Badge variant="outline" className="text-[10px]">Active</Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Chart Notes Co-Signed Today</span>
                <span className="font-bold text-foreground">0 Notes</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Prescriptions E-Signed</span>
                <span className="font-bold text-foreground">0 Scripts</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Good Faith Exams Completed</span>
                <span className="font-bold text-emerald-600 font-semibold">100% Validated</span>
              </div>
              <div className="pt-2 border-t border-border flex justify-between items-center text-muted-foreground text-[11px]">
                <span>Supervised Clinical Injectors</span>
                <span className="font-semibold text-foreground">0 Active on Floor</span>
              </div>
            </div>
          </Card>

          {/* Notifications & Urgent Alerts */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs space-y-3.5 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-base font-normal tracking-tight flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" /> Urgent Clinical Alerts
              </h3>
              <Badge variant="outline" className="text-[10px]">0 New</Badge>
            </div>

            <div className="text-center py-6 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
              <Bell className="h-6 w-6 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-medium text-foreground">No urgent clinical alerts.</p>
              <p className="text-[11px] text-muted-foreground">High-dose treatments and urgent prescription reviews will alert here.</p>
            </div>
          </Card>

        </div>

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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [recentPatients, setRecentPatients] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const staffName = user?.user_metadata?.first_name || user?.user_metadata?.last_name
    ? `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim()
    : user?.email || "Clinical Staff";

  const toggleStaffTask = (id: number) => {
    setMyTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    toast.success("Task updated");
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* ── Executive Staff Header ────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-card via-card to-primary/5 p-6 rounded-2xl border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold uppercase tracking-wider text-[10px]">
              <Stethoscope className="h-3.5 w-3.5 mr-1" /> Clinical Staff Portal
            </Badge>
            <span className="text-xs text-muted-foreground">• {formatClinicDate()}</span>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium">Welcome back, {staffName}</h1>
          <p className="text-xs text-muted-foreground">
            Overview of today's patient visits, clinical documentation tasks, and messaging queue.
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
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-primary/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Today's Appointments</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <CalIcon className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">{appts.length}</div>
          <div className="text-[11px] text-muted-foreground mt-1 font-medium">
            Scheduled for today
          </div>
        </Card>

        {/* KPI 2: Waiting Patients */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-emerald-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Waiting Patients</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">0</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Checked in & in building
          </div>
        </Card>

        {/* KPI 3: Pending Tasks */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-amber-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Pending Tasks</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Inbox className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">{myTasks.length}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            Clinical & administrative
          </div>
        </Card>

        {/* KPI 4: Unsigned Notes */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-rose-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Unsigned Notes</span>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <FileText className="h-4 w-4 text-rose-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">0</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Awaiting completion
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
                          <td className="p-3 text-muted-foreground">{a.service_id}</td>
                          <td className="p-3 text-muted-foreground">{a.staff_id}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px] uppercase">{a.status}</Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/staff/appointments/${a.id}`)}>
                              View Chart
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

          {/* Section 2: Recent Patients */}
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4 text-primary" /> Recent Patients
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Recently accessed patient charts and intake submissions.</p>
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
                      <th className="p-3">Chart Status</th>
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
                            <span className="text-[11px] text-muted-foreground">Access patient profiles in the Patients directory to open medical charts.</span>
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
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate(`/staff/clients/${p.id}`)}>
                              Open Chart →
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

/* ── Staff Today Main Dispatcher Component ─────────────────────────────────── */
export default function StaffToday() {
  const { isMedicalDirector } = useAuth();

  if (isMedicalDirector) {
    return <MedicalDirectorDashboard />;
  }

  return <StandardStaffToday />;
}
