import { useMemo, useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { useAuth, clearDemoAuthSession } from "@/hooks/useAuth";
import { usePendingBookings } from "@/hooks/usePendingBookings";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { authService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcutsHelp } from "@/components/staff/KeyboardShortcutsHelp";
import { StaffBottomNav } from "@/components/staff/StaffBottomNav";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Menu, Sun, Inbox, MessageSquare, Calendar as CalIcon, Clock,
  Stethoscope, ShieldCheck, ShieldAlert, Boxes, UserCircle2,
  BookOpen, History as HistoryIcon, Laptop, Building2, LogOut, Loader2,
  LayoutDashboard, FileCheck, FileText, Pill, Activity, Users, BarChart3, Settings,
  ChevronDown, ChevronRight
} from "lucide-react";
import rkaLogo from "@/assets/rka-logo.webp";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  badge?: number;
  show?: boolean;
}

interface Group {
  key: string;
  label: string;
  icon: any;
  children: NavItem[];
  badge?: number;
  show?: boolean;
}

export default function StaffLayout() {
  const { user, loading, roles, isAdmin, isNP, isStaff, isReceptionist, isScheduler, isPrivacyOfficer, isMedicalDirector, isPrivileged } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    dashboard: true,
    clinical_reviews: true,
    orders_prescriptions: true,
    staff_oversight: true,
    reports_overview: true,
    settings_overview: true,
    today: true,
    schedule: true,
    clients: true,
    security_officer: true,
    clinical: true,
    admin: true,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key]
    }));
  };

  // Privileged roles requiring MFA (aal2) — isPrivileged comes from useAuth
  const [mfaOk, setMfaOk] = useState(true);
  const [mfaChecked, setMfaChecked] = useState(false);

  const { showWarning, countdown, staySignedIn } = useIdleLogout(!!user);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!user) { setMfaChecked(true); return; }
    authService.getAuthenticatorAssuranceLevel().then(() => {
      setMfaOk(true);
      setMfaChecked(true);
    });
  }, [user]);

  const pendingCount = usePendingBookings(!!user && (isAdmin || isScheduler || isReceptionist || isStaff));
  const [unreadSms] = useState(0);

  // Medical Director, Security Officer, and Staff navigation groups
  const staffGroups: Group[] = useMemo(() => {
    if (isMedicalDirector) {
      return [
        {
          key: "dashboard",
          label: "Dashboard",
          icon: LayoutDashboard,
          show: true,
          children: [
            { to: "/staff/today", label: "Dashboard", icon: LayoutDashboard },
          ],
        },
        {
          key: "clinical_reviews",
          label: "Clinical Reviews",
          icon: FileCheck,
          show: true,
          children: [
            { to: "/staff/clinical-reviews?tab=pending", label: "Pending Notes", icon: FileText },
            { to: "/staff/clinical-reviews?tab=sign", label: "Sign Notes", icon: FileCheck },
          ],
        },
        {
          key: "orders_prescriptions",
          label: "Orders & Prescriptions",
          icon: Stethoscope,
          show: true,
          children: [
            { to: "/staff/orders?tab=rx", label: "Prescription Approvals", icon: Pill },
            { to: "/staff/orders?tab=labs", label: "Lab & Imaging Orders", icon: Activity },
          ],
        },
        {
          key: "staff_oversight",
          label: "Staff",
          icon: Users,
          show: true,
          children: [
            { to: "/staff/team?tab=providers", label: "Providers", icon: Users },
            { to: "/staff/team?tab=notes", label: "Staff Notes", icon: FileText },
          ],
        },
        {
          key: "reports_overview",
          label: "Reports",
          icon: BarChart3,
          show: true,
          children: [
            { to: "/staff/reports", label: "Reports", icon: BarChart3 },
          ],
        },
        {
          key: "settings_overview",
          label: "Settings",
          icon: Settings,
          show: true,
          children: [
            { to: "/staff/me", label: "Settings", icon: Settings },
          ],
        },
      ];
    }

    if (isPrivacyOfficer) {
      return [
        {
          key: "sec_dashboard",
          label: "Dashboard",
          icon: LayoutDashboard,
          show: true,
          children: [
            { to: "/staff/security-officer", label: "Dashboard", icon: LayoutDashboard },
          ],
        },
        {
          key: "sec_audit",
          label: "Audit Logs",
          icon: HistoryIcon,
          show: true,
          children: [
            { to: "/staff/audit-report", label: "Audit Logs", icon: HistoryIcon },
          ],
        },
        {
          key: "sec_hipaa",
          label: "HIPAA Compliance",
          icon: BookOpen,
          show: true,
          children: [
            { to: "/staff/hipaa-policies", label: "HIPAA Compliance", icon: BookOpen },
          ],
        },
        {
          key: "sec_incidents",
          label: "Security Incidents",
          icon: ShieldAlert,
          show: true,
          children: [
            { to: "/staff/breach-report", label: "Security Incidents", icon: ShieldAlert },
          ],
        },
        {
          key: "sec_access",
          label: "Access Management",
          icon: Laptop,
          show: true,
          children: [
            { to: "/staff/vendors?tab=devices", label: "Access Management", icon: Laptop },
          ],
        },
        {
          key: "sec_reports",
          label: "Reports",
          icon: BarChart3,
          show: true,
          children: [
            { to: "/staff/reports", label: "Reports", icon: BarChart3 },
          ],
        },
        {
          key: "sec_settings",
          label: "Settings",
          icon: Settings,
          show: true,
          children: [
            { to: "/staff/me", label: "Settings", icon: Settings },
          ],
        },
      ];
    }

    const canClinical = isNP || isStaff;
    return [
      {
        key: "staff_dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        show: true,
        children: [
          { to: "/staff/today", label: "Dashboard", icon: LayoutDashboard },
        ],
      },
      {
        key: "staff_patients",
        label: "Patients",
        icon: UserCircle2,
        show: true,
        children: [
          { to: "/staff/clients", label: "Patients", icon: UserCircle2 },
        ],
      },
      {
        key: "staff_appts",
        label: "Appointments",
        icon: CalIcon,
        show: true,
        children: [
          { to: "/staff/calendar", label: "Appointments", icon: CalIcon },
        ],
      },
      {
        key: "staff_notes",
        label: "Clinical Notes",
        icon: FileText,
        show: true,
        children: [
          { to: "/staff/clinical", label: "Clinical Notes", icon: FileText },
        ],
      },
      {
        key: "staff_rx",
        label: "Prescriptions",
        icon: Pill,
        show: true,
        children: [
          { to: "/staff/orders?tab=rx", label: "Prescriptions", icon: Pill },
        ],
      },
      {
        key: "staff_tasks",
        label: "Tasks",
        icon: Inbox,
        show: true,
        badge: pendingCount,
        children: [
          { to: "/staff/inbox", label: "Tasks", icon: Inbox, badge: pendingCount },
        ],
      },
      {
        key: "staff_messages",
        label: "Messages",
        icon: MessageSquare,
        show: true,
        badge: unreadSms,
        children: [
          { to: "/staff/messages", label: "Messages", icon: MessageSquare, badge: unreadSms },
        ],
      },
      {
        key: "staff_settings",
        label: "Settings",
        icon: Settings,
        show: true,
        children: [
          { to: "/staff/me", label: "Settings", icon: Settings },
        ],
      },
    ];
  }, [isMedicalDirector, isScheduler, isReceptionist, isStaff, isNP, isPrivacyOfficer, pendingCount, unreadSms]);

  if (loading || (user && !mfaChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/staff/login" replace />;
  if (isPrivileged && !mfaOk) return <Navigate to="/staff/mfa" replace />;

  const isStaffMember = isAdmin || isScheduler || isReceptionist || isStaff || isNP || isPrivacyOfficer;

  if (!isStaffMember) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-sm">Your account doesn't have staff access yet.</p>
          <Button variant="link" onClick={async () => { clearDemoAuthSession(); await authService.logout(); navigate("/staff/login"); }}>Sign out</Button>
        </div>
      </div>
    );
  }

  const footerLinkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${isActive
      ? "bg-primary text-primary-foreground font-semibold"
      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
    }`;

  const isSubActive = (targetUrl: string) => {
    const [targetPath, targetQuery] = targetUrl.split("?");
    if (location.pathname !== targetPath) return false;
    if (!targetQuery) {
      return !location.search || location.search === "" || location.search === "?";
    }
    const currentParams = new URLSearchParams(location.search);
    const targetParams = new URLSearchParams(targetQuery);
    for (const [key, val] of targetParams.entries()) {
      if (currentParams.get(key) !== val) return false;
    }
    return true;
  };

  const NavInner = (
    <>
      <div className="space-y-2">
        {staffGroups.filter(g => g.show).map((g) => {
          const visibleChildren = g.children.filter(c => c.show !== false);
          if (visibleChildren.length === 0) return null;
          const GIcon = g.icon;
          const isOpen = openGroups[g.key] !== false; // default true/open
          const isSingleChild = visibleChildren.length === 1 && visibleChildren[0].label === g.label;

          if (isSingleChild) {
            const single = visibleChildren[0];
            const active = isSubActive(single.to);
            return (
              <NavLink
                key={g.key}
                to={single.to}
                onClick={() => setOpen(false)}
                className={() =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "text-foreground hover:bg-secondary/60"
                  }`
                }
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <GIcon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{g.label}</span>
                </div>
                {g.badge ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-primary/15 text-primary font-bold shrink-0">
                    {g.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          }

          const hasActiveChild = visibleChildren.some(c => isSubActive(c.to));

          return (
            <div key={g.key} className="space-y-0.5">
              {/* Dropdown Button Header */}
              <button
                type="button"
                onClick={() => toggleGroup(g.key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer select-none ${
                  hasActiveChild
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <GIcon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{g.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {g.badge ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-primary/15 text-primary font-bold">
                      {g.badge}
                    </span>
                  ) : null}
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Collapsible Dropdown Children Items */}
              {isOpen && (
                <div className="pl-4 pr-1 py-1 space-y-1">
                  {visibleChildren.map((c) => {
                    const CIcon = c.icon;
                    const active = isSubActive(c.to);
                    return (
                      <NavLink
                        key={c.to}
                        to={c.to}
                        onClick={() => setOpen(false)}
                        className={() =>
                          `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                            active
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          }`
                        }
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{c.label}</span>
                        </div>
                        {c.badge ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-primary/15 text-primary font-bold shrink-0">
                            {c.badge}
                          </span>
                        ) : null}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-3 mt-4 border-t border-border space-y-1">
        <NavLink to="/staff/me" className={footerLinkCls} onClick={() => setOpen(false)}><UserCircle2 className="h-4 w-4" />My Profile</NavLink>
        <NavLink to="/staff/help" className={footerLinkCls} onClick={() => setOpen(false)}><BookOpen className="h-4 w-4" />Help / Handbook</NavLink>
        <div className="flex items-center justify-between px-3 py-1.5 text-xs font-medium text-muted-foreground rounded-lg">
          <span>Appearance</span>
          <ThemeToggle className="h-7 w-7 border border-border bg-background/80 hover:bg-accent rounded-full" />
        </div>
      </div>
    </>
  );

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background flex flex-col">
      {/* Top Full-width Portal Header Bar */}
      <header className="w-full border-b border-border bg-card/80 backdrop-blur px-4 md:px-6 py-2.5 flex items-center justify-between z-30 shrink-0">
        {/* Left Corner: Mobile Menu & Company Logo */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="xl:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4 flex flex-col justify-between">
                <div className="overflow-y-auto">
                  <div className="font-serif text-lg font-bold mb-4">Navigation</div>
                  <nav className="space-y-1">{NavInner}</nav>
                </div>
                <div className="pt-3 border-t border-border shrink-0 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={async () => {
                      clearDemoAuthSession();
                      await authService.logout();
                      navigate("/staff/login");
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Link to={roles.includes("privacy_officer") ? "/staff/security-officer" : "/staff/today"} className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition">
            <img src={rkaLogo} alt="Radiantilyk Aesthetic" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover shadow-soft" />
            <div className="text-left hidden sm:block">
              <div className="font-serif text-sm leading-tight font-medium">Radiantilyk Aesthetic</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {roles.includes("medical_director") ? "Medical Director Hub" : roles.includes("privacy_officer") ? "Security Officer Hub" : "Staff Hub"}
              </div>
            </div>
          </Link>
        </div>

        {/* Right Corner: Active Portal Name Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider shadow-xs ${
            roles.includes("medical_director")
              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30"
              : roles.includes("privacy_officer")
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
              : "bg-primary/10 text-primary border border-primary/20"
          }`}>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span>
              {roles.includes("medical_director")
                ? "Medical Director Portal"
                : roles.includes("privacy_officer")
                ? "Security Officer Portal"
                : "Staff Portal"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar and Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">


      {/* Desktop Sidebar */}
      <aside className="hidden xl:flex flex-col w-64 border-r border-border bg-card p-4 shrink-0 justify-between">
        <div className="space-y-4 overflow-y-auto pr-1">
          <nav className="space-y-1">{NavInner}</nav>
        </div>

        <div className="pt-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
            onClick={async () => {
              clearDemoAuthSession();
              await authService.logout();
              navigate("/staff/login");
            }}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-background min-w-0">
        <Outlet />
      </main>
    </div>

    <StaffBottomNav
      canCheckout={isAdmin || isScheduler || isReceptionist || isStaff}
      canClinical={isAdmin || isNP || isStaff}
      pendingBadge={pendingCount + unreadSms}
    />

    <CommandPalette isAdmin={isAdmin} />
    <KeyboardShortcutsHelp />

    <AlertDialog open={showWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still there?</AlertDialogTitle>
          <AlertDialogDescription>
            For patient privacy, you will be automatically signed out in {countdown} seconds due to inactivity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={staySignedIn}>Stay Signed In</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);
}
