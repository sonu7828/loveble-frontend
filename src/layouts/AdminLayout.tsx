import { useMemo, useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { useAuth, clearDemoAuthSession } from "@/hooks/useAuth";
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
import ThemeToggle from "@/components/ThemeToggle";
import {
  Menu, ShieldCheck, ShieldAlert, Star, Users,
  BookOpen, History as HistoryIcon, Laptop, Building2, LogOut, Loader2, UserCircle2
} from "lucide-react";
import rkaLogo from "@/assets/rka-logo.webp";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  badge?: number;
  show?: boolean;
}

export default function AdminLayout() {
  const { user, loading, isAdmin, isPrivileged } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Privileged roles requiring MFA (aal2)
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

  const adminNavItems: NavItem[] = useMemo(() => [
    { to: "/staff/admin", label: "Compliance Dashboard", icon: ShieldCheck },
    { to: "/staff/model-applications", label: "Model Applications", icon: Star },
    { to: "/staff/team", label: "Staff Management", icon: Users },
    { to: "/staff/security-officer", label: "Privacy & Security Officer", icon: ShieldCheck },
    { to: "/staff/audit-report", label: "Audit Logs", icon: HistoryIcon },
    { to: "/staff/hipaa-policies", label: "HIPAA Policies", icon: BookOpen },
    { to: "/staff/vendors?tab=devices", label: "Device Inventory", icon: Laptop },
    { to: "/staff/vendors", label: "Vendor Management", icon: Building2 },
    { to: "/staff/breach-report", label: "Breach Reports", icon: ShieldAlert },
  ], []);

  if (loading || (user && !mfaChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/staff/login" replace />;
  if (isPrivileged && !mfaOk) return <Navigate to="/staff/mfa" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-sm font-medium mb-4">Access Denied. Admin privileges required.</p>
          <Button variant="outline" onClick={async () => { clearDemoAuthSession(); await supabase.auth.signOut(); navigate("/staff/login"); }}>Sign out</Button>
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
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2">Admin Modules</div>
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const active = isSubActive(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={() =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${active
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
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
      <header className="w-full border-b border-border bg-card/80 backdrop-blur px-4 md:px-6 py-3 flex items-center justify-between z-30 shrink-0">
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

          <Link to="/staff/admin" className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition">
            <img src={rkaLogo} alt="Radiantilyk Aesthetic" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover shadow-soft" />
            <div className="text-left hidden sm:block">
              <div className="font-serif text-sm leading-tight font-medium">Radiantilyk Aesthetic</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Admin Dashboard
              </div>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden sm:inline">Admin Portal</span>
            <span className="sm:hidden">Admin</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
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

        <main className="flex-1 overflow-y-auto bg-background min-w-0">
          <Outlet />
        </main>
      </div>

      <CommandPalette isAdmin={true} />
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
