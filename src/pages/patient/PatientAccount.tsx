import { confirmDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2, Calendar, MapPin, FileText, LogOut, Plus, FileCheck2,
  Pencil, MessageSquare, LayoutDashboard, ShieldCheck,
  CreditCard, Download, FileEdit, Bell, User, Lock, HelpCircle, Phone,
  Clock, CheckCircle2, Menu
} from "lucide-react";
import rkaLogo from "@/assets/rka-logo.webp";

import { SmsThread } from "@/components/messaging/SmsThread";
import { formatPhone10 } from "@/lib/formatPhone";
import { MyTreatmentPlansCard } from "@/components/MyTreatmentPlansCard";
import MyReceiptsCard from "@/components/MyReceiptsCard";
import { MyChartTimelineCard } from "@/components/MyChartTimelineCard";
import { PreOpCountdownCard } from "@/components/PreOpCountdownCard";
import { PostOpCheckInsCard } from "@/components/PostOpCheckInsCard";
import { PromSurveysCard } from "@/components/PromSurveysCard";
import { ClientAvatar } from "@/components/ClientAvatar";
import { DownloadRecordsCard } from "@/components/patient/DownloadRecordsCard";
import { PatientAmendmentModal } from "@/components/patient/PatientAmendmentModal";
import { getClientSession } from "@/hooks/useClientAuth";
import { clearDemoAuthSession } from "@/hooks/useAuth";
import {
  CANCELLATION_NOTICE_HOURS, CLINIC_PHONE_DISPLAY, CLINIC_PHONE_TEL, WITHIN_WINDOW_WARNING,
} from "@/lib/cancellationPolicy";

const TABS = [
  "dashboard",
  "appointments",
  "records",
  "consents",
  "billing",
  "download",
  "amendment",
  "notifications",
  "profile",
  "privacy",
  "support",
] as const;

type TabKey = typeof TABS[number];

const NAV_ITEMS: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "appointments", label: "My Appointments", icon: Calendar },
  { key: "records", label: "Medical Records", icon: FileText },
  { key: "consents", label: "Consent Forms", icon: FileCheck2 },
  { key: "billing", label: "Billing & Payments", icon: CreditCard },
  { key: "download", label: "Download Records", icon: Download },
  { key: "amendment", label: "Request Amendment", icon: FileEdit },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "profile", label: "My Profile", icon: User },
  { key: "privacy", label: "Privacy & Security", icon: Lock },
  { key: "support", label: "Help & Support", icon: HelpCircle },
];

interface Appt {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string;
  service_id: string;
  staff_id: string;
  location_id: string;
  consent_pdf_url: string | null;
}

export default function PatientAccount() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [services, setServices] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<Record<string, { name: string; title: string }>>({});
  const [locations, setLocations] = useState<Record<string, { name: string; city: string }>>({});

  // Form states for profile & security
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", phone: "", emergencyContact: "" });
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [updatingPass, setUpdatingPass] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const tabParam = (searchParams.get("tab") ?? "dashboard") as TabKey;
  const activeTab: TabKey = (TABS as readonly string[]).includes(tabParam) ? tabParam : "dashboard";

  const onTabChange = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "dashboard") next.delete("tab"); else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    (async () => {
      const session = await getClientSession();
      if (!session) { navigate("/account/auth"); return; }
      setUser(session.user);

      const email = session.user.email?.toLowerCase();

      const [{ data: prof }, { data: ap }, { data: cs }, { data: sv }, { data: st }, { data: loc }] = await Promise.all([
        supabase.from("client_profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("appointments").select("*").order("start_at", { ascending: false }),
        supabase.from("consent_signatures").select("*").ilike("client_email", email ?? "").order("signed_at", { ascending: false }),
        supabase.from("services").select("id, name"),
        supabase.from("staff_directory" as any).select("id, full_name, title"),
        supabase.from("locations").select("id, name, city"),
      ]);

      const resolvedProfile = prof ?? {
        id: "demo-profile",
        user_id: session.user.id,
        email: session.user.email ?? "user@gmail.com",
        first_name: session.user.user_metadata?.first_name ?? "Demo",
        last_name: session.user.user_metadata?.last_name ?? "User",
        phone: session.user.user_metadata?.phone ?? "555-0199",
      };

      setProfile(resolvedProfile);
      setProfileForm({
        firstName: resolvedProfile.first_name || "",
        lastName: resolvedProfile.last_name || "",
        phone: resolvedProfile.phone || "",
        emergencyContact: resolvedProfile.emergency_contact || "",
      });

      setAppts((ap ?? []) as Appt[]);
      setConsents(cs ?? []);
      setServices(Object.fromEntries((sv ?? []).map((s: any) => [s.id, s.name])));
      setStaff(Object.fromEntries((st ?? []).map((s: any) => [s.id, { name: s.full_name, title: s.title }])));
      setLocations(Object.fromEntries((loc ?? []).map((l: any) => [l.id, { name: l.name, city: l.city }])));
      setLoading(false);
    })();
  }, [navigate]);

  const signOut = async () => {
    clearDemoAuthSession();
    await supabase.auth.signOut();
    navigate("/");
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (user?.id) {
        await supabase.from("client_profiles").upsert({
          user_id: user.id,
          email: user.email,
          first_name: profileForm.firstName,
          last_name: profileForm.lastName,
          phone: profileForm.phone,
          emergency_contact: profileForm.emergencyContact,
        });
      }
      setProfile((p: any) => ({
        ...(p ?? {}),
        first_name: profileForm.firstName,
        last_name: profileForm.lastName,
        phone: profileForm.phone,
        emergency_contact: profileForm.emergencyContact,
      }));
      setEditingProfile(false);
      toast.success("Profile details updated!");
    } catch {
      toast.error("Failed to update profile.");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setUpdatingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;
      toast.success("Password updated successfully!");
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      toast.error(err?.message || "Could not update password.");
    } finally {
      setUpdatingPass(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      const appt = appts.find(a => a.id === id);
      if (!appt) return;
      const hoursUntil = (new Date(appt.start_at).getTime() - Date.now()) / 3600000;
      if (hoursUntil < 48) {
        const ok = await confirmDialog({
          title: "Cancel this appointment?",
          description: WITHIN_WINDOW_WARNING,
          confirmLabel: "Cancel anyway",
          cancelLabel: "Keep appointment",
          destructive: true,
        });
        if (!ok) return;
      } else {
        if (!(await confirmDialog({ title: "Cancel this appointment?", confirmLabel: "Cancel appointment", cancelLabel: "Keep it" }))) return;
      }

      const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      setAppts(prev => prev.map(a => a.id === id ? { ...a, status: "cancelled" } : a));
      toast.success("Appointment cancelled.");
    } catch (e: any) {
      toast.error(e.message || "Could not cancel appointment.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const now = Date.now();
  const upcoming = appts.filter(a => new Date(a.start_at).getTime() >= now && !["cancelled", "denied", "no_show"].includes(a.status));
  const past = appts.filter(a => new Date(a.start_at).getTime() < now || ["cancelled", "denied", "no_show", "completed"].includes(a.status));

  const nextAppt = upcoming[0];

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background flex flex-col">
      {/* Top Full-width Portal Header Bar */}
      <header className="w-full border-b border-border bg-card/80 backdrop-blur px-4 md:px-6 py-3 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="xl:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-4 flex flex-col justify-between">
                <div className="overflow-y-auto">
                  <div className="font-serif text-lg font-bold mb-4">Patient Modules</div>
                  <nav className="flex flex-col w-full space-y-1">
                    {NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            onTabChange(item.key);
                            setMenuOpen(false);
                          }}
                          className={`w-full flex items-center px-3 py-2.5 text-xs font-medium rounded-xl transition gap-3 text-left ${
                            isActive
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
                <div className="pt-3 border-t border-border shrink-0 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={signOut}
                  >
                    <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          <Link to="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition">
            <img src={rkaLogo} alt="Radiantilyk" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover shadow-soft" />
            <div className="text-left hidden sm:block">
              <div className="font-serif text-sm leading-tight font-medium">Radiantilyk Aesthetic</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Medspa</div>
            </div>
          </Link>
        </div>

        <div className="flex items-center">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden sm:inline">Patient Portal</span>
            <span className="sm:hidden">Patient</span>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex overflow-hidden min-h-0 w-full">
        {/* Desktop Sidebar */}
        <aside className="hidden xl:flex flex-col w-64 border-r border-border bg-card p-4 shrink-0 justify-between">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Patient Modules
            </div>
            <TabsList className="flex flex-col w-full h-auto bg-transparent p-0 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <TabsTrigger
                    key={item.key}
                    value={item.key}
                    className={`w-full justify-start px-3 py-2.5 text-xs font-medium rounded-xl transition gap-3 text-left ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          <div className="pt-3 border-t border-border mt-4 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
              onClick={signOut}
            >
              <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
            </Button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-background min-w-0 p-4 md:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-6 pb-12">
            {activeTab === "dashboard" && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border border-border p-5 md:p-6 rounded-2xl shadow-xs">
                <div className="flex items-center gap-4 min-w-0">
                  {(() => {
                    const rawName = (profile?.first_name || user?.user_metadata?.first_name || "").trim();
                    const lower = rawName.toLowerCase();
                    const displayFirstName = (!rawName || lower === "admin" || lower === "administrator" || lower === "user" || lower === "staff")
                      ? "Patient"
                      : rawName;
                    const displayLastName = profile?.last_name || user?.user_metadata?.last_name || "";
                    const initials = (displayFirstName[0] ?? "P") + (displayLastName[0] ?? "");
                    
                    const rawEmail = (profile?.email || user?.email || "").trim();
                    const displayEmail = (!rawEmail || rawEmail.toLowerCase() === "admin@gmail.com" || rawEmail.toLowerCase().includes("admin"))
                      ? "user@gmail.com"
                      : rawEmail;

                    return (
                      <>
                        <ClientAvatar
                          clientEmail={displayEmail}
                          avatarPath={(profile as any)?.avatar_path ?? null}
                          editable
                          size={64}
                          fallbackInitials={initials}
                          onChange={(path) => setProfile((p: any) => ({ ...(p ?? {}), avatar_path: path }))}
                        />
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <h1 className="font-serif text-2xl md:text-3xl truncate">
                              Welcome back, {displayFirstName}
                            </h1>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] hidden md:inline-flex">
                              <ShieldCheck className="h-3 w-3 mr-1" /> HIPAA Protected
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{displayEmail}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link to="/book">
                    <Button className="rounded-full gap-1"><Plus className="h-4 w-4" /> Book Visit</Button>
                  </Link>
                </div>
              </div>
            )}
              
              {/* 1. DASHBOARD OVERVIEW */}
              <TabsContent value="dashboard" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-2xl font-serif">{upcoming.length}</div>
                      <div className="text-xs text-muted-foreground">Upcoming Visits</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
                      <FileCheck2 className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-2xl font-serif">{consents.length}</div>
                      <div className="text-xs text-muted-foreground">Signed Consents</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-2xl font-serif">HIPAA §164</div>
                      <div className="text-xs text-muted-foreground">Encrypted Account</div>
                    </div>
                  </div>
                </div>

                {nextAppt && (
                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] mb-2">
                          Next Appointment
                        </Badge>
                        <h3 className="font-serif text-xl">{services[nextAppt.service_id] || "Medical Aesthetic Visit"}</h3>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(nextAppt.start_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                        </p>
                        {locations[nextAppt.location_id] && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {locations[nextAppt.location_id].name} ({locations[nextAppt.location_id].city})
                          </p>
                        )}
                      </div>
                      <Button size="sm" className="rounded-full shrink-0" onClick={() => onTabChange("appointments")}>
                        View Details
                      </Button>
                    </div>
                  </div>
                )}

                <PreOpCountdownCard />
                <MyChartTimelineCard />
              </TabsContent>

              {/* 2. MY APPOINTMENTS */}
              <TabsContent value="appointments" className="mt-0 space-y-6">
                <PreOpCountdownCard />
                <PostOpCheckInsCard />
                <PromSurveysCard />

                <div className="space-y-4">
                  <h3 className="font-serif text-xl">Upcoming Visits</h3>
                  {upcoming.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
                      No upcoming appointments scheduled.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcoming.map(a => (
                        <div key={a.id} className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="font-serif text-lg">{services[a.service_id] || "Service Visit"}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" /> {format(new Date(a.start_at), "PPP 'at' p")}
                            </div>
                            {locations[a.location_id] && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" /> {locations[a.location_id].name}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] capitalize bg-primary/10 text-primary">
                              {a.status.replace("_", " ")}
                            </Badge>
                            <Button variant="outline" size="sm" className="rounded-full text-xs text-destructive hover:bg-destructive/10" onClick={() => cancel(a.id)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="font-serif text-xl">Past Visit History</h3>
                  {past.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
                      No past visit history recorded.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {past.map(a => (
                        <div key={a.id} className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs flex items-center justify-between">
                          <div>
                            <div className="font-medium text-foreground">{services[a.service_id] || "Completed Visit"}</div>
                            <div className="text-muted-foreground">{format(new Date(a.start_at), "PP")}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {a.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* 3. MEDICAL RECORDS */}
              <TabsContent value="records" className="mt-0 space-y-6">
                <MyChartTimelineCard />
                <MyTreatmentPlansCard />
              </TabsContent>

              {/* 4. CONSENT FORMS */}
              <TabsContent value="consents" className="mt-0 space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-xl">Signed Consent Forms</h3>
                      <p className="text-xs text-muted-foreground">Review your signed treatment disclosures and legal consent records.</p>
                    </div>
                    <FileCheck2 className="h-6 w-6 text-primary shrink-0" />
                  </div>

                  {consents.length === 0 ? (
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                      No signed consent records found.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {consents.map(c => (
                        <div key={c.id} className="rounded-xl border border-border bg-background p-4 text-xs flex items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-foreground">{c.signed_full_name || "Signed Form"}</div>
                            <div className="text-muted-foreground">Signed: {format(new Date(c.signed_at), "PPP")}</div>
                          </div>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Valid Record
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* 5. BILLING & PAYMENTS */}
              <TabsContent value="billing" className="mt-0 space-y-6">
                <MyReceiptsCard />
              </TabsContent>

              {/* 6. DOWNLOAD MEDICAL RECORDS */}
              <TabsContent value="download" className="mt-0 space-y-6">
                <DownloadRecordsCard userEmail={user?.email || ""} profile={profile} />
              </TabsContent>

              {/* 7. REQUEST RECORD AMENDMENT */}
              <TabsContent value="amendment" className="mt-0 space-y-6">
                <PatientAmendmentModal userEmail={user?.email || ""} />
              </TabsContent>

              {/* 8. NOTIFICATIONS & MESSAGES */}
              <TabsContent value="notifications" className="mt-0 space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-xl">Message Support &amp; Alerts</h3>
                      <p className="text-xs text-muted-foreground">Direct SMS communications with our clinical staff.</p>
                    </div>
                    <Bell className="h-6 w-6 text-primary shrink-0" />
                  </div>
                  <SmsThread clientEmail={user?.email || ""} viewerRole="client" />
                </div>
              </TabsContent>

              {/* 9. MY PROFILE */}
              <TabsContent value="profile" className="mt-0 space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-xl">Personal Profile &amp; Demographics</h3>
                      <p className="text-xs text-muted-foreground">Manage your contact information and emergency details.</p>
                    </div>
                    {!editingProfile && (
                      <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => setEditingProfile(true)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit Profile
                      </Button>
                    )}
                  </div>

                  {editingProfile ? (
                    <form onSubmit={saveProfile} className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="fn" className="text-xs">First Name</Label>
                          <Input id="fn" value={profileForm.firstName} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} className="mt-1 text-xs" />
                        </div>
                        <div>
                          <Label htmlFor="ln" className="text-xs">Last Name</Label>
                          <Input id="ln" value={profileForm.lastName} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} className="mt-1 text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="ph" className="text-xs">Phone Number (10 digits)</Label>
                          <Input id="ph" placeholder="(555) 000-0000" maxLength={14} value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: formatPhone10(e.target.value) })} className="mt-1 text-xs" />
                        </div>
                        <div>
                          <Label htmlFor="ec" className="text-xs">Emergency Contact</Label>
                          <Input id="ec" placeholder="Name & Phone Number" value={profileForm.emergencyContact} onChange={(e) => setProfileForm({ ...profileForm, emergencyContact: e.target.value })} className="mt-1 text-xs" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setEditingProfile(false)}>Cancel</Button>
                        <Button type="submit" size="sm" className="rounded-full">Save Changes</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
                        <div className="text-muted-foreground mb-1">Full Name</div>
                        <div className="font-semibold text-foreground">{profile?.first_name} {profile?.last_name}</div>
                      </div>
                      <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
                        <div className="text-muted-foreground mb-1">Email Address</div>
                        <div className="font-semibold text-foreground">{user?.email}</div>
                      </div>
                      <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
                        <div className="text-muted-foreground mb-1">Phone Number</div>
                        <div className="font-semibold text-foreground">{profile?.phone || "Not specified"}</div>
                      </div>
                      <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
                        <div className="text-muted-foreground mb-1">Emergency Contact</div>
                        <div className="font-semibold text-foreground">{profile?.emergency_contact || "None listed"}</div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* 10. PRIVACY & SECURITY */}
              <TabsContent value="privacy" className="mt-0 space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
                  <div>
                    <h3 className="font-serif text-xl">Account Security &amp; Password</h3>
                    <p className="text-xs text-muted-foreground mt-1">Update your password to keep your patient account secure.</p>
                  </div>

                  <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                    <div>
                      <Label htmlFor="np" className="text-xs">New Password</Label>
                      <Input id="np" type="password" required value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="mt-1 text-xs" />
                    </div>
                    <div>
                      <Label htmlFor="cp" className="text-xs">Confirm New Password</Label>
                      <Input id="cp" type="password" required value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="mt-1 text-xs" />
                    </div>
                    <Button type="submit" disabled={updatingPass} size="sm" className="rounded-full">
                      {updatingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                    </Button>
                  </form>

                  <div className="pt-4 border-t border-border space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-xs">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" /> HIPAA Privacy Notice (NPP)
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your personal health data is protected under federal HIPAA privacy regulations (§164.502). We do not share your medical information without explicit written consent.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* 11. HELP & SUPPORT */}
              <TabsContent value="support" className="mt-0 space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
                  <div>
                    <h3 className="font-serif text-xl">Help &amp; Patient Support</h3>
                    <p className="text-xs text-muted-foreground mt-1">Need assistance with your appointment or medical chart?</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Phone className="h-4 w-4 text-primary" /> Call Clinic Directly
                      </div>
                      <p className="text-muted-foreground">Speak with our patient care coordinator during business hours.</p>
                      <a href={CLINIC_PHONE_TEL} className="inline-block text-primary hover:underline font-medium">
                        {CLINIC_PHONE_DISPLAY}
                      </a>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Clock className="h-4 w-4 text-primary" /> Cancellation Policy
                      </div>
                      <p className="text-muted-foreground">Visits must be cancelled or rescheduled at least {CANCELLATION_NOTICE_HOURS} hours in advance.</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
          </div>
        </main>
      </Tabs>
    </div>
  );
}
