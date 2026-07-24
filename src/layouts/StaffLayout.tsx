import { useMemo, useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { useAuth, clearDemoAuthSession } from "@/hooks/useAuth";
import { usePendingBookings } from "@/hooks/usePendingBookings";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { supabase } from "@/integrations/supabase/client";
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
  BookOpen, History as HistoryIcon, Laptop, Building2, LogOut, Loader2
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
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error) { setMfaOk(true); return; }
        if (data.currentLevel !== "aal2" && data.nextLevel === "aal2") {
          setMfaOk(false);
        } else {
          setMfaOk(true);
        }
      } catch {
        setMfaOk(true);
      } finally {
        if (!cancelled) setMfaChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const pendingCount = usePendingBookings(!!user && (isAdmin || isScheduler || isReceptionist || isStaff));
  const [unreadSms, setUnreadSms] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from("sms_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .is("read_by_staff_at", null);
      setUnreadSms(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("staff_sms_unread_badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "sms_messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Standard staff navigation
  const staffGroups: Group[] = useMemo(() => {
    const canCheckout = isScheduler || isReceptionist || isStaff;
    const canClinical = isNP || isStaff;
    return [
      {
        key: "today",
        label: "Today",
        icon: Sun,
        show: true,
        badge: pendingCount + unreadSms,
        children: [
          { to: "/staff/today", label: "Today", icon: Sun },
          { to: "/staff/inbox", label: "Booking Requests", icon: Inbox, badge: pendingCount },
          { to: "/staff/messages", label: "Messages", icon: MessageSquare, badge: unreadSms },
        ],
      },
      {
        key: "schedule",
        label: "Schedule",
        icon: CalIcon,
        show: true,
        children: [
          { to: "/staff/calendar", label: "Calendar", icon: CalIcon },
          { to: "/staff/my-schedule", label: "My Schedule", icon: CalIcon },
          { to: "/staff/time-clock", label: "Time Clock", icon: Clock },
        ],
      },
      {
        key: "clients",
        label: "Clients",
        icon: UserCircle2,
        show: true,
        children: [
          { to: "/staff/clients", label: "All Clients", icon: UserCircle2 },
        ],
      },

      {
        key: "security_officer",
        label: "Security & Compliance",
        icon: ShieldCheck,
        show: isPrivacyOfficer,
        children: [
          { to: "/staff/security-officer", label: "Security Operations Center", icon: ShieldCheck },
          { to: "/staff/hipaa-policies", label: "HIPAA Policy Approval", icon: BookOpen },
          { to: "/staff/audit-report", label: "Audit & PHI Access Logs", icon: HistoryIcon },
          { to: "/staff/breach-report", label: "Incident & Breach Reports", icon: ShieldAlert },
          { to: "/staff/vendors?tab=devices", label: "Device Inventory & Encryption", icon: Laptop },
          { to: "/staff/vendors", label: "Vendor Management & BAAs", icon: Building2 },
        ],
      },
      {
        key: "clinical",
        label: "Clinical",
        icon: Stethoscope,
        show: canClinical,
        children: [
          { to: "/staff/clinical", label: "Charts", icon: Stethoscope },
          { to: "/staff/clinical/cosign", label: "Cosign Queue", icon: ShieldCheck },
          { to: "/staff/clinical/safety", label: "Safety & Protocols", icon: ShieldAlert },
          { to: "/staff/compliance", label: "My Compliance", icon: ShieldCheck },
          { to: "/staff/inventory", label: "Inventory & Supplies", icon: Boxes },
        ],
      },
    ];
  }, [isScheduler, isReceptionist, isStaff, isNP, isPrivacyOfficer, pendingCount, unreadSms]);

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
          <Button variant="link" onClick={async () => { clearDemoAuthSession(); await supabase.auth.signOut(); navigate("/staff/login"); }}>Sign out</Button>
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
      <div className="space-y-5">
        {staffGroups.filter(g => g.show).map((g) => {
          const visibleChildren = g.children.filter(c => c.show !== false);
          if (visibleChildren.length === 0) return null;
          return (
            <div key={g.key} className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2 flex items-center justify-between">
                <span>{g.label}</span>
                {g.badge ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-primary/15 text-primary font-bold shrink-0">
                    {g.badge}
                  </span>
                ) : null}
              </div>
              {visibleChildren.map((c) => {
                const CIcon = c.icon;
                const active = isSubActive(c.to);
                return (
                  <NavLink
                    key={c.to}
                    to={c.to}
                    onClick={() => setOpen(false)}
                    className={() =>
                      `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                        active
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      }`
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{c.label}</span>
                    </div>
                    {c.badge ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-primary/15 text-primary font-bold shrink-0">
                        {c.badge}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
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
      <header className="w-full border-b border-border bg-card/80 backdrop-blur px-4 md:px-6 py-3 flex items-center justify-between z-30 shrink-0">
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
                      await supabase.auth.signOut();
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
                {roles.includes("privacy_officer") ? "Security Officer Hub" : "Staff Hub"}
              </div>
            </div>
          </Link>
        </div>

        {/* Right Corner: Portal Badge */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${
            roles.includes("privacy_officer")
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : "bg-primary/10 text-primary border border-primary/20"
          }`}>
            <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden sm:inline">
              {roles.includes("privacy_officer") ? "Security Officer Portal" : "Staff Portal"}
            </span>
            <span className="sm:hidden">
              {roles.includes("privacy_officer") ? "Security Officer" : "Staff"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden lg:inline">Radiantilyk Healthcare & HIPAA Compliance Platform</span>
        </div>

        {/* Right Corner: Company Name, Logo, Theme Toggle & Top Right Sign Out */}
        <div className="flex items-center gap-2 md:gap-3">
          <Link to={isAdmin ? "/staff/admin" : "/staff/today"} className="flex items-center gap-3 hover:opacity-90 transition">
            <div className="text-right hidden sm:block">
              <div className="font-serif text-sm leading-tight font-medium">Radiantilyk Aesthetic</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{isAdmin ? "Admin Dashboard" : "Staff Hub"}</div>
            </div>
            <img src={rkaLogo} alt="Radiantilyk Aesthetic" className="h-9 w-9 rounded-full object-cover shadow-soft" />
          </Link>

          <ThemeToggle className="h-9 w-9 border border-border bg-background/80 hover:bg-accent shrink-0 rounded-full" />

          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
            onClick={async () => {
              clearDemoAuthSession();
              await supabase.auth.signOut();
              navigate("/staff/login");
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
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
              await supabase.auth.signOut();
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
