import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiQuery, authService } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Calendar as CalIcon, Clock, UserCheck, FileEdit, MessageSquare,
  Users, Plus, ChevronRight, Stethoscope, Bell, FileText, Activity, CheckCircle2, AlertCircle
} from "lucide-react";

import { startOfDay, endOfDay } from "date-fns";

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
  checked_in_at: string | null;
}

import { getDynamicProfileName } from "@/lib/userProfile";

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
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
}

export function ProviderDashboard() {
  const navigate = useNavigate();
  const { user, isNP, isRNInjector, isMedicalDirector, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [unsignedNotesCount, setUnsignedNotesCount] = useState<number>(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<ClinicalNotification[]>([]);

  // Resolve provider name dynamically from user profile
  const providerName = getDynamicProfileName(user, "Provider");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch today's appointments strictly within today's date bounds
      const startToday = startOfDay(new Date()).toISOString();
      const endToday = endOfDay(new Date()).toISOString();

      const { data: apptData } = await apiQuery("appointments")
        .select("*")
        .gte("start_at", startToday)
        .lte("start_at", endToday)
        .order("start_at", { ascending: true });
      setAppts(Array.isArray(apptData) ? apptData : []);

      // Fetch recent patient profiles
      const { data: clientData } = await apiQuery("client_profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (Array.isArray(clientData) && clientData.length > 0) {
        setRecentPatients(
          clientData.map((c: any) => ({
            id: c.id,
            name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email || "Patient",
            email: c.email || "",
            phone: c.phone || "",
            lastVisit: c.created_at ? new Date(c.created_at).toLocaleDateString() : "Recent",
            primaryConcern: c.notes || "General Consultation",
          }))
        );
      } else {
        setRecentPatients([]);
      }

      // Fetch unsigned draft notes count
      const { data: draftNotes } = await apiQuery("clinical_notes")
        .select("id")
        .eq("status", "draft");
      setUnsignedNotesCount(Array.isArray(draftNotes) ? draftNotes.length : 0);

      // Fetch unread messages count if table exists
      try {
        const { data: msgData } = await apiQuery("messages")
          .select("id")
          .eq("read", false);
        setUnreadMessagesCount(Array.isArray(msgData) ? msgData.length : 0);
      } catch {
        setUnreadMessagesCount(0);
      }

      // Generate live clinical notifications from checked-in appointments & pending notes
      const liveAlerts: ClinicalNotification[] = [];
      const checkedIn = (Array.isArray(apptData) ? apptData : []).filter((a: any) => a.status === "arrived" || a.checked_in_at);
      for (const c of checkedIn) {
        liveAlerts.push({
          id: `ci-${c.id}`,
          type: "checkin",
          title: `Patient ${c.client_first_name || ""} ${c.client_last_name || ""} checked-in for ${c.service_name || "Treatment"}`,
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
      setAppts([]);
      setRecentPatients([]);
      setUnsignedNotesCount(0);
      setUnreadMessagesCount(0);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const waitingPatientsCount = appts.filter(a => a.status === "arrived" || a.checked_in_at).length;

  const providerRoleBadge = isNP
    ? "Nurse Practitioner & Lead Injector"
    : isRNInjector
      ? "RN Injector"
      : isMedicalDirector
        ? "Medical Director & Supervising Physician"
        : "Clinical Provider";

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Provider Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-900/10 via-primary/5 to-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Welcome back, {providerName}
            </h1>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 px-2.5 py-0.5 text-xs font-medium">
              <Stethoscope className="h-3.5 w-3.5 mr-1 text-blue-600" /> {providerRoleBadge}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Clinical workspace — manage your patient appointments, review medical charts, and record clinical notes.
          </p>
        </div>

        {/* Quick Actions Header Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button size="sm" variant="default" className="text-xs gap-1.5 shadow-xs" onClick={() => navigate("/staff/clinical/notes/new")}>
            <Plus className="h-4 w-4" /> Create Clinical Note
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => navigate("/staff/clients")}>
            <Users className="h-4 w-4" /> View Patients
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => navigate("/staff/calendar")}>
            <CalIcon className="h-4 w-4" /> Today's Schedule
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Appointments */}
        <Card className="p-4 border border-border shadow-xs hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Appointments</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <CalIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-serif">{appts.length}</span>
            <span className="text-[11px] text-muted-foreground">Scheduled today</span>
          </div>
        </Card>

        {/* Card 2: Waiting Patients */}
        <Card className="p-4 border border-border shadow-xs hover:border-blue-500/40 transition bg-blue-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Waiting Patients</span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-serif text-blue-700 dark:text-blue-300">{waitingPatientsCount}</span>
            <Badge className="bg-blue-600 text-white text-[10px]">Checked-in</Badge>
          </div>
        </Card>

        {/* Card 3: Unsigned Notes */}
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

        {/* Card 4: New Messages */}
        <Card className="p-4 border border-border shadow-xs hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Messages</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-serif text-emerald-600">{unreadMessagesCount}</span>
            <span className="text-[11px] text-muted-foreground">Unread inquiries</span>
          </div>
        </Card>
      </div>

      {/* Main Grid: Today's Schedule Table & Side Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule Table (Col Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border border-border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b border-border bg-muted/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-serif font-medium">Today's Patient Schedule</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Click Open Chart to view medical history and record chart notes.</p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs text-primary gap-1" onClick={() => navigate("/staff/calendar")}>
                View Calendar <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="p-3 font-semibold">Time</th>
                    <th className="p-3 font-semibold">Patient Name</th>
                    <th className="p-3 font-semibold">Treatment / Service</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {appts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-muted-foreground">
                        No appointments scheduled for today.
                      </td>
                    </tr>
                  ) : (
                    appts.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-mono font-medium text-foreground">{formatClinicTime(a.start_at)}</td>
                        <td className="p-3 font-semibold text-foreground">
                          {a.client_first_name} {a.client_last_name}
                          <div className="text-[10px] font-normal text-muted-foreground">{a.client_phone || a.client_email}</div>
                        </td>
                        <td className="p-3 text-muted-foreground font-medium">{a.service_name || "Aesthetic Treatment"}</td>
                        <td className="p-3">
                          {a.status === "arrived" || a.checked_in_at ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] uppercase">Waiting / Checked-In</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] uppercase">{a.status}</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs bg-primary text-primary-foreground gap-1"
                            onClick={() => navigate(`/staff/clinical/clients/${encodeURIComponent(a.client_email || "patient@example.com")}`)}
                          >
                            <FileText className="h-3 w-3" /> Open Chart
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

        {/* Side Panel: Recent Patients & Clinical Notifications (Col Span 1) */}
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
