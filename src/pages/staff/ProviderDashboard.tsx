import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiQuery } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Calendar as CalIcon, Clock, UserCheck, FileEdit, MessageSquare,
  Users, Plus, ChevronRight, Stethoscope, Bell, FileText, Activity, CheckCircle2, AlertCircle, RefreshCw, Filter,
  Trash2, CheckSquare
} from "lucide-react";

import { startOfDay, endOfDay } from "date-fns";
import { getDynamicProfileName } from "@/lib/userProfile";
import { isTestPatient } from "@/lib/testPatientFilter";

interface Appt {
  id: string;
  status: string;
  start_at: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string | null;
  service_id: string;
  service_name?: string;
  staff_name?: string;
  staff_id?: string;
  staff_profiles?: { id?: string; full_name?: string; title?: string };
  checked_in_at: string | null;
  checked_out_at?: string | null;
}

interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  lastVisit: string;
  primaryConcern: string;
}

interface ClinicalNotification {
  id: string;
  type: "checkin" | "note" | "lab" | "alert";
  title: string;
  time: string;
  urgent?: boolean;
}

const CLINIC_TIME_ZONE = "America/Los_Angeles";

function formatClinicTime(iso: string) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
}

function formatClinicDateTime(iso: string) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
}

export function ProviderDashboard() {
  const navigate = useNavigate();
  const { user, isNP, isRNInjector, isMedicalDirector } = useAuth();

  const [loading, setLoading] = useState(true);
  const [allAppts, setAllAppts] = useState<Appt[]>([]);
  const [todayAppts, setTodayAppts] = useState<Appt[]>([]);
  const [unsignedNotesCount, setUnsignedNotesCount] = useState<number>(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<ClinicalNotification[]>([]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "today" | "history">("upcoming");
  const [filterScope] = useState<"mine" | "all">("mine");

  // Resolve provider name dynamically from user profile (e.g. Thomas, Kiem, Girish)
  const providerName = getDynamicProfileName(user, "Thomas");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch DB + local demo appointments
      const todayStartIso = startOfDay(new Date()).toISOString();
      const apptRes: any = await apiQuery("appointments")
        .select("*")
        .gte("start_at", todayStartIso)
        .order("start_at", { ascending: true })
        .catch(() => ({ data: [] }));
      const rawApptData = apptRes?.data ?? [];
      
      let localAppts: any[] = [];
      try {
        localAppts = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
      } catch { }

      const apptMap = new Map<string, Appt>();
      (Array.isArray(rawApptData) ? rawApptData : []).forEach((a: any) => {
        if (a.id) apptMap.set(a.id, a);
      });
      localAppts.forEach((a: any) => {
        if (a.id) apptMap.set(a.id, a);
      });

      const mergedAppts = Array.from(apptMap.values());
      const apptArray: Appt[] = mergedAppts.filter(
        (a) => a.start_at && !isNaN(new Date(a.start_at).getTime()) && !isTestPatient(a)
      );
      
      // Separate into today vs upcoming
      const endToday = endOfDay(new Date()).getTime();
      const startToday = startOfDay(new Date()).getTime();

      const todayList = apptArray.filter((a) => {
        const t = new Date(a.start_at).getTime();
        return t >= startToday && t <= endToday;
      });

      setAllAppts(apptArray);
      setTodayAppts(todayList);

      // 2. Fetch unsigned draft notes count
      const draftRes: any = await apiQuery("clinical_notes")
        .select("id")
        .eq("status", "draft")
        .catch(() => ({ data: [] }));
      const draftNotes = draftRes?.data ?? [];
      setUnsignedNotesCount(Array.isArray(draftNotes) ? draftNotes.length : 0);

      // 3. Fetch unread messages count if available
      try {
        const { data: msgData } = await apiQuery("messages")
          .select("id")
          .eq("read", false);
        setUnreadMessagesCount(Array.isArray(msgData) ? msgData.length : 0);
      } catch {
        setUnreadMessagesCount(0);
      }

      // 4. Generate live clinical notifications (filter test patients & match provider)
      const liveAlerts: ClinicalNotification[] = [];
      const checkedIn = apptArray.filter(
        (a) => (a.status === "arrived" || a.checked_in_at) && a.status !== "completed" && !isTestPatient(a) && isMatchForProvider(a)
      );
      for (const c of checkedIn) {
        liveAlerts.push({
          id: `ci-${c.id}`,
          type: "checkin",
          title: `Patient ${c.client_first_name || ""} ${c.client_last_name || ""} checked in for ${c.service_name || "Treatment"}`,
          time: formatClinicTime(c.checked_in_at || c.start_at),
          urgent: false,
        });
      }
      if (Array.isArray(draftNotes) && draftNotes.length > 0) {
        liveAlerts.push({
          id: "draft-notes-alert",
          type: "note",
          title: `${draftNotes.length} draft chart note(s) pending signature`,
          time: "Action required",
          urgent: true,
        });
      }
      setNotifications(liveAlerts);
    } catch (_e) {
      setAllAppts([]);
      setTodayAppts([]);
      setUnsignedNotesCount(0);
      setUnreadMessagesCount(0);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener("rka_appointment_created", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("rka_appointment_created", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [loadData]);

  // Provider-matching filter logic — strictly filter appointments to only those assigned to this provider
  const isMatchForProvider = (a: Appt) => {
    if (filterScope === "all" && (isMedicalDirector || (user as any)?.role === "admin" || (user as any)?.role === "front_desk")) {
      return true;
    }

    const apptStaffId = (a.staff_id || a.staff_profiles?.id || "").toLowerCase();
    const rawStaffName = (a.staff_name || a.staff_profiles?.full_name || "").toLowerCase();
    const userEmail = (user?.email || "").toLowerCase();
    const userStaffId = ((user as any)?.staff_id || user?.id || "").toLowerCase();

    // 1. Direct ID match (user ID or staff ID)
    if (userStaffId && apptStaffId && (apptStaffId === userStaffId || apptStaffId.includes(userStaffId))) {
      return true;
    }

    // 2. Direct name match against provider display name or user profile
    const myName = (providerName || (user as any)?.full_name || "").toLowerCase();
    const myFirstName = myName.split(/\s+/)[0];

    if (rawStaffName) {
      if (myName && (rawStaffName.includes(myName) || myName.includes(rawStaffName))) return true;
      if (myFirstName && myFirstName.length >= 3 && rawStaffName.includes(myFirstName)) return true;
    }

    // 3. Resolve staff ID via rka_approved_staff_accounts
    if (apptStaffId && userEmail) {
      try {
        const approved: Array<{ id?: string; email?: string; full_name?: string }> =
          JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
        const match = approved.find(
          (s) => (s.id && s.id.toLowerCase() === apptStaffId)
        );
        if (match && match.email?.toLowerCase() === userEmail) return true;
      } catch {}
    }

    // 4. Role-based isolation check:
    if (isRNInjector) {
      // RN Injector ONLY sees appointments explicitly assigned to RN Injector
      if (rawStaffName.includes("injector") || rawStaffName.includes("rn")) return true;
      return false;
    }

    if (isNP) {
      // Nurse Practitioner ONLY sees appointments assigned to Nurse Practitioner or unassigned (excluding RN Injector)
      if (rawStaffName.includes("injector") || rawStaffName.includes("rn / injector")) return false;
      if (
        rawStaffName.includes("nurse") ||
        rawStaffName.includes("practitioner") ||
        rawStaffName.includes("np") ||
        apptStaffId === "any-available" ||
        !rawStaffName
      ) {
        return true;
      }
      return false;
    }

    return false;
  };

  const filteredAllAppts = allAppts.filter(isMatchForProvider);
  const filteredTodayAppts = todayAppts.filter(isMatchForProvider);

  // Compute displayed list depending on active tab
  const historyAppts = filteredAllAppts.filter(a => a.status === "completed" || a.status === "checked_out");
  const displayedAppts = activeTab === "today"
    ? filteredTodayAppts.filter(a => a.status !== "completed")
    : activeTab === "upcoming"
      ? filteredAllAppts.filter(a => a.status !== "cancelled" && a.status !== "denied" && a.status !== "completed")
      : historyAppts;

  const waitingPatientsCount = filteredTodayAppts.filter(a => (a.status === "arrived" || a.checked_in_at) && a.status !== "completed").length;

  const providerRoleBadge = isNP
    ? "Nurse Practitioner & Lead Injector"
    : isRNInjector
      ? "RN Injector"
      : isMedicalDirector
        ? "Medical Director & Supervising Physician"
        : "Clinical Provider";

  const handleCheckIn = async (apptId: string) => {
    try {
      const nowIso = new Date().toISOString();
      await apiQuery("appointments").update({ status: "arrived", checked_in_at: nowIso }).eq("id", apptId).catch(() => {});
      const local = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
      const updated = local.map((a: any) => (a.id === apptId ? { ...a, status: "arrived", checked_in_at: nowIso } : a));
      localStorage.setItem("rka_demo_appointments", JSON.stringify(updated));
      window.dispatchEvent(new Event("rka_demo_appointments_updated"));
      window.dispatchEvent(new Event("rka_appointment_updated"));
      window.dispatchEvent(new Event("rka_appointment_checkin"));
      toast.success("Patient marked as checked-in!");
      loadData();
    } catch {
      toast.error("Could not update check-in status");
    }
  };

  const handleCheckout = async (apptId: string) => {
    try {
      const nowIso = new Date().toISOString();
      await apiQuery("appointments").update({ status: "completed", checked_out_at: nowIso }).eq("id", apptId).catch(() => {});
      const local = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
      const updated = local.map((a: any) => (a.id === apptId ? { ...a, status: "completed", checked_out_at: nowIso } : a));
      localStorage.setItem("rka_demo_appointments", JSON.stringify(updated));
      window.dispatchEvent(new Event("rka_demo_appointments_updated"));
      window.dispatchEvent(new Event("rka_appointment_updated"));
      window.dispatchEvent(new Event("rka_appointment_completed"));
      toast.success("Patient checked-out & payment completed! Saved to Patient History.");
      loadData();
    } catch {
      toast.error("Could not complete checkout");
    }
  };

  const handleDeleteAppt = async (apptId: string) => {
    if (!window.confirm("Are you sure you want to delete this patient appointment record?")) return;
    try {
      await apiQuery("appointments").delete().eq("id", apptId).catch(() => {});
      const local = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
      const filtered = local.filter((a: any) => a.id !== apptId);
      localStorage.setItem("rka_demo_appointments", JSON.stringify(filtered));
      toast.success("Appointment record deleted.");
      loadData();
    } catch {
      toast.error("Could not delete appointment");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-secondary/60 via-background to-secondary/30 border border-border shadow-xs">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">
            Welcome back, {providerName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 text-xs gap-1">
              <Stethoscope className="h-3 w-3" /> {providerRoleBadge}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2 max-w-xl">
            Clinical workspace — manage your patient appointments, review medical charts, and record clinical notes.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={() => navigate("/staff/clinical/notes/new")} className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs whitespace-nowrap">
            <Plus className="h-3.5 w-3.5" /> Create Clinical Note
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/staff/clinical/clients")} className="gap-1.5 text-xs whitespace-nowrap">
            <Users className="h-3.5 w-3.5" /> View Patients
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/staff/calendar")} className="gap-1.5 text-xs whitespace-nowrap">
            <CalIcon className="h-3.5 w-3.5" /> Today's Schedule
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Appointments */}
        <Card 
          className={`p-4 border shadow-xs hover:border-primary/40 transition cursor-pointer ${activeTab === "today" ? "ring-2 ring-primary/40 bg-primary/5" : ""}`}
          onClick={() => setActiveTab("today")}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Appointments</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <CalIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-serif text-foreground">{filteredTodayAppts.filter(a => a.status !== "completed").length}</span>
            <span className="text-[11px] text-muted-foreground">Scheduled today</span>
          </div>
        </Card>

        {/* Card 2: Upcoming & All Appointments */}
        <Card 
          className={`p-4 border shadow-xs hover:border-blue-500/40 transition cursor-pointer ${activeTab === "upcoming" ? "ring-2 ring-blue-500/40 bg-blue-500/5" : ""}`}
          onClick={() => setActiveTab("upcoming")}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Upcoming & Scheduled</span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-serif text-blue-700 dark:text-blue-300">{filteredAllAppts.filter(a => a.status !== "completed").length}</span>
            <Badge className="bg-blue-600 text-white text-[10px]">Total Booked</Badge>
          </div>
        </Card>

        {/* Card 3: Waiting Patients */}
        <Card className="p-4 border border-border shadow-xs hover:border-emerald-500/40 transition bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Waiting Patients</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-serif text-emerald-700 dark:text-emerald-300">{waitingPatientsCount}</span>
            <Badge className="bg-emerald-600 text-white text-[10px]">Checked-in</Badge>
          </div>
        </Card>

        {/* Card 4: Unsigned Notes */}
        <Card className="p-4 border border-border shadow-xs hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unsigned Notes</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <FileEdit className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-serif text-amber-600">{unsignedNotesCount}</span>
            <span className="text-[11px] text-muted-foreground">Pending sign-off</span>
          </div>
        </Card>
      </div>

      {/* Main Grid: Patient Schedule Table & Side Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedule Table (Col Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border border-border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-serif font-medium">
                    {activeTab === "today" ? "Today's Patient Schedule" : activeTab === "upcoming" ? "Nurse Appointments (Upcoming & Scheduled)" : "Patient History (Checked-Out)"}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    {displayedAppts.length} total
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Appointments booked for {providerName}. Click Open Chart to record clinical notes.
                </p>
              </div>

              {/* Controls & Filter - Single Line */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg bg-muted/60 p-0.5 text-xs font-medium border border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTab("upcoming")}
                    className={`px-3 py-1 rounded-md transition ${activeTab === "upcoming" ? "bg-primary text-primary-foreground font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Upcoming & All
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("today")}
                    className={`px-3 py-1 rounded-md transition ${activeTab === "today" ? "bg-primary text-primary-foreground font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Today Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("history")}
                    className={`px-3 py-1 rounded-md transition ${activeTab === "history" ? "bg-primary text-primary-foreground font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Patient History ({historyAppts.length})
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 font-semibold whitespace-nowrap">Date & Time</th>
                    <th className="p-3 font-semibold whitespace-nowrap">Patient Name</th>
                    <th className="p-3 font-semibold min-w-[200px]">Treatment / Service</th>
                    <th className="p-3 font-semibold whitespace-nowrap">Assigned Nurse</th>
                    <th className="p-3 font-semibold whitespace-nowrap">Status</th>
                    <th className="p-3 font-semibold text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedAppts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CalIcon className="h-8 w-8 text-muted-foreground/40" />
                          <span className="font-medium text-xs text-foreground">No appointments found.</span>
                          <span className="text-[11px] text-muted-foreground">New patient bookings assigned to {providerName} will display here automatically.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedAppts.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-mono font-medium text-foreground whitespace-nowrap align-top">
                          {formatClinicDateTime(a.start_at)}
                        </td>
                        <td className="p-3 font-semibold text-foreground align-top whitespace-nowrap">
                          {a.client_first_name} {a.client_last_name}
                          <div className="text-[10px] font-normal text-muted-foreground">{a.client_phone || a.client_email}</div>
                        </td>
                        <td className="p-3 text-muted-foreground font-medium align-top max-w-[240px]">
                          <div className="line-clamp-2 leading-relaxed" title={a.service_name || "Aesthetic Treatment"}>
                            {a.service_name || "Aesthetic Treatment"}
                          </div>
                        </td>
                        <td className="p-3 font-medium text-foreground align-top whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] bg-secondary/40">
                            {a.staff_name || a.staff_profiles?.full_name || providerName}
                          </Badge>
                        </td>
                        <td className="p-3 align-top whitespace-nowrap">
                          {a.status === "completed" ? (
                            <Badge className="bg-blue-600 text-white text-[10px] uppercase">Completed & Paid</Badge>
                          ) : a.status === "arrived" || a.checked_in_at ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] uppercase">Checked-In</Badge>
                          ) : a.status === "approved" ? (
                            <Badge className="bg-success-soft text-success-soft-foreground text-[10px] uppercase">Approved</Badge>
                          ) : a.status === "pending" ? (
                            <Badge className="bg-warning-soft text-warning-soft-foreground text-[10px] uppercase">Pending Approval</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] uppercase">{a.status}</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap space-x-1.5 align-top">
                          {a.status !== "arrived" && !a.checked_in_at && a.status !== "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] border-emerald-500/30 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleCheckIn(a.id)}
                            >
                              Check In
                            </Button>
                          )}
                          {(a.status === "arrived" || a.checked_in_at) && a.status !== "completed" && (
                            <Button
                              size="sm"
                              className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-2xs"
                              onClick={() => handleCheckout(a.id)}
                            >
                              <CheckSquare className="h-3 w-3" /> Checkout & Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs bg-primary text-primary-foreground gap-1"
                            disabled={!a.client_email}
                            onClick={() => {
                              if (a.client_email) {
                                navigate(`/staff/clinical/clients/${encodeURIComponent(a.client_email)}`);
                              } else {
                                navigate(`/staff/appointments/${a.id}`);
                              }
                            }}
                          >
                            <FileText className="h-3 w-3" /> Open Chart
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                            title="Delete patient appointment record"
                            onClick={() => handleDeleteAppt(a.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel: Recent Notifications & Actions (Col Span 1) */}
        <div className="space-y-6">
          {/* Notifications Panel */}
          <Card className="border border-border shadow-xs">
            <CardHeader className="p-4 border-b border-border bg-muted/30 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">Clinical Notifications</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px]">{notifications.length} New</Badge>
            </CardHeader>
            <CardContent className="p-3 space-y-2.5">
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No new clinical notifications.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition flex items-start gap-2.5 text-xs">
                    <div className="mt-0.5">
                      {n.urgent ? (
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground leading-snug">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground">{n.time}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ProviderDashboard;
