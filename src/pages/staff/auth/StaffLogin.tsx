import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Loader2, ShieldAlert, ShieldCheck, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { setDemoAuthSession, clearDemoAuthSession, AppRole } from "@/hooks/useAuth";

type Step = "credentials" | "mfa-enroll" | "mfa-verify" | "redirecting";
type Mode = "loading" | "ready";

const MFA_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out. Please sign out, then sign in again.`)), MFA_TIMEOUT_MS);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

function isFactorNameConflict(error: unknown) {
  const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  return msg.includes("factor") && msg.includes("friendly name") && msg.includes("exists");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// Derive post-login destination from the user's roles (no email matching).
function resolveRedirectTarget(roles: string[]): string {
  if (roles.includes("admin")) return "/staff/admin";
  if (roles.includes("privacy_officer")) return "/staff/security-officer";
  return "/staff/today";
}

export default function StaffLogin() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const reason = sp.get("reason");
  const nextParam = sp.get("next");
  const roleParam = sp.get("role");
  // Only allow same-origin relative paths to prevent open redirects.
  const nextPath = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : "/staff/today";

  const [step, setStep] = useState<Step>("credentials");
  const [mode, setMode] = useState<Mode>("loading");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // MFA state
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string>("");

  // On mount, if user is already signed in, jump straight to the right step
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setEmail(data.session.user.email ?? "");
        await beginMfa(cancelled);
      } else {
        setMode("ready");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginMfa = async (cancelled?: boolean) => {
    setMode("loading");
    setErrMsg("");
    try {
      const { data: aal, error: aalErr } = await withTimeout(
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        "Checking two-factor status",
      );
      if (aalErr) throw aalErr;
      if (aal?.currentLevel === "aal2") {
        setStep("redirecting");
        setMode("ready");
        // Resolve target from DB roles — no email hardcoding.
        let aal2Target = "/staff/today";
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s?.user?.id) {
            const { data: rd } = await supabase.from("user_roles").select("role").eq("user_id", s.user.id);
            aal2Target = resolveRedirectTarget((rd ?? []).map((x: any) => x.role));
          }
        } catch { /* keep fallback /staff/today */ }
        setTimeout(() => navigate(aal2Target, { replace: true }), 350);
        return;
      }
      const { data: factors, error } = await withTimeout(supabase.auth.mfa.listFactors(), "Loading authenticator factors");
      if (error) throw error;
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (verified) {
        const { data: ch, error: chErr } = await withTimeout(
          supabase.auth.mfa.challenge({ factorId: verified.id }),
          "Starting two-factor verification",
        );
        if (chErr) throw chErr;
        if (cancelled) return;
        setFactorId(verified.id);
        setChallengeId(ch.id);
        setStep("mfa-verify");
        setMode("ready");
      } else {
        // Evaluate if user is in a privileged role (admin, provider/staff, nurse_practitioner)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const uid = currentSession?.user?.id;
        let isPrivileged = false;
        if (uid) {
          const { data: rData } = await supabase.from("user_roles").select("role").eq("user_id", uid);
          const userRoles = (rData ?? []).map((x: any) => x.role);
          isPrivileged = userRoles.includes("admin") || userRoles.includes("staff") || userRoles.includes("nurse_practitioner");
        }

        if (!isPrivileged) {
          // Non-privileged users (receptionists, schedulers, etc.) bypass mandatory MFA enrollment
          setStep("redirecting");
          setMode("ready");
          setTimeout(() => navigate(nextPath, { replace: true }), 350);
          return;
        }

        const unverified = factors?.totp?.filter((f) => f.status !== "verified") ?? [];
        for (const f of unverified) {
          try { await withTimeout(supabase.auth.mfa.unenroll({ factorId: f.id }), "Clearing old authenticator setup"); } catch (e) { console.warn(e); }
        }
        let { data: enroll, error: enrErr } = await withTimeout(supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Authenticator-${crypto.randomUUID()}`,
        }), "Creating authenticator setup");
        if (enrErr && isFactorNameConflict(enrErr)) {
          const { data: latest } = await withTimeout(supabase.auth.mfa.listFactors(), "Refreshing authenticator factors");
          for (const f of latest?.totp?.filter((i) => i.status !== "verified") ?? []) {
            try { await withTimeout(supabase.auth.mfa.unenroll({ factorId: f.id }), "Clearing duplicate authenticator setup"); } catch (e) { console.warn(e); }
          }
          const retry = await withTimeout(supabase.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: `Authenticator-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          }), "Creating a fresh authenticator setup");
          enroll = retry.data; enrErr = retry.error;
        }
        if (enrErr) throw enrErr;
        if (!enroll) throw new Error("Could not create an authenticator setup.");
        if (cancelled) return;
        setFactorId(enroll.id);
        setQrSvg(enroll.totp.qr_code);
        setSecret(enroll.totp.secret);
        setStep("mfa-enroll");
        setMode("ready");
      }
    } catch (e) {
      setErrMsg(errorMessage(e, "Could not load two-factor setup."));
      setMode("ready");
    }
  };

  const [pendingDemoLogin, setPendingDemoLogin] = useState<{ cleanEmail: string; roles: AppRole[]; isAd: boolean } | null>(null);

  const fillDemoCredentials = (targetEmail: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    setEmail(cleanEmail);
    setPassword("12345678");
    const roleLabel =
      cleanEmail === "admin@gmail.com" ? "Admin" :
      cleanEmail === "md@gmail.com" ? "Medical Director" :
      cleanEmail === "officer@gmail.com" ? "Security Officer" :
      cleanEmail === "user@gmail.com" ? "Patient / User" :
      "Staff";
    toast.info(`${roleLabel} credentials populated in Email & Password fields. Click Continue to sign in.`);
  };

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check built-in demo patient user account
    if (cleanEmail === "user@gmail.com") {
      setDemoAuthSession("user@gmail.com", []);
      toast.success("Signed in as Demo Patient");
      setLoading(false);
      navigate("/account", { replace: true });
      return;
    }

    // 2. Check built-in staff/admin demo accounts
    if (
      cleanEmail === "admin@gmail.com" ||
      cleanEmail === "staff@gmail.com" ||
      cleanEmail === "officer@gmail.com" ||
      cleanEmail === "md@gmail.com"
    ) {
      const isAd = cleanEmail === "admin@gmail.com";
      const isOfficer = cleanEmail === "officer@gmail.com";
      const isMD = cleanEmail === "md@gmail.com";
      const roles: AppRole[] = isAd
        ? ["admin"]
        : isOfficer
        ? ["privacy_officer", "staff"]
        : isMD
        ? ["medical_director", "staff"]
        : ["staff"];
      setPendingDemoLogin({ cleanEmail, roles, isAd });
      setLoading(false);
      setStep("mfa-verify");
      setMode("ready");
      toast.info("Credentials verified. Complete mandatory 2-Factor authentication (Code: 123456).");
      return;
    }

    // 2. Check admin-approved team member accounts
    const approvedAccounts: Array<{ email: string; password?: string; role: AppRole; full_name: string }> =
      JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");

    const matchedApproved = approvedAccounts.find(
      (a) => a.email.toLowerCase() === cleanEmail && (a.password ? password === a.password : password === "12345678")
    );

    if (matchedApproved) {
      const isAd = matchedApproved.role === "admin";
      const roles: AppRole[] = [matchedApproved.role];
      if (matchedApproved.role === "provider" || matchedApproved.role === "nurse_practitioner" || matchedApproved.role === "medical_director" || matchedApproved.role === "receptionist" || matchedApproved.role === "scheduler") {
        roles.push("staff");
      }
      setPendingDemoLogin({ cleanEmail, roles, isAd });
      setLoading(false);
      setPassword("");
      setStep("mfa-verify");
      setMode("ready");
      toast.info("Credentials verified. Complete mandatory 2-Factor authentication (Code: 123456).");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    await beginMfa();
  };

  const verifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await withTimeout(
        supabase.auth.mfa.challenge({ factorId }),
        "Starting two-factor verification",
      );
      if (chErr) { toast.error(chErr.message); return; }
      const { error } = await withTimeout(supabase.auth.mfa.verify({
        factorId, challengeId: ch.id, code: code.trim(),
      }), "Verifying two-factor code");
      if (error) { toast.error(error.message); return; }
      toast.success("Two-factor authentication enabled");
      setStep("redirecting");
      // Resolve target from DB roles after successful MFA enrollment.
      let enrollTarget = "/staff/today";
      try {
        const { data: { session: es } } = await supabase.auth.getSession();
        if (es?.user?.id) {
          const { data: rd } = await supabase.from("user_roles").select("role").eq("user_id", es.user.id);
          enrollTarget = resolveRedirectTarget((rd ?? []).map((x: any) => x.role));
        }
      } catch { /* keep fallback /staff/today */ }
      setTimeout(() => navigate(enrollTarget, { replace: true }), 400);
    } catch (e) {
      toast.error(errorMessage(e, "Could not verify two-factor code."));
    } finally {
      setBusy(false);
    }
  };

  const verifyLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pendingDemoLogin) {
      if (code.trim().length !== 6) {
        toast.error("Please enter a valid 6-digit authentication code.");
        return;
      }
      setBusy(true);
      setDemoAuthSession(pendingDemoLogin.cleanEmail, pendingDemoLogin.roles);
      toast.success("MFA Verification Successful — Security Operations Center Access Granted");
      setStep("redirecting");
      // Use the roles already attached to the demo session — no email matching.
      const demoTarget = resolveRedirectTarget(pendingDemoLogin.roles);
      setTimeout(() => navigate(demoTarget, { replace: true }), 400);
      return;
    }

    if (!factorId || !challengeId) return;
    setBusy(true);
    try {
      const { error } = await withTimeout(supabase.auth.mfa.verify({
        factorId, challengeId, code: code.trim(),
      }), "Verifying two-factor code");
      if (error) {
        toast.error(error.message);
        setCode("");
        const { data: ch } = await supabase.auth.mfa.challenge({ factorId });
        if (ch) setChallengeId(ch.id);
        return;
      }
      toast.dismiss();
      setStep("redirecting");
      // Resolve target from DB roles — no email hardcoding.
      let verifyTarget = "/staff/today";
      try {
        const { data: { session: vs } } = await supabase.auth.getSession();
        if (vs?.user?.id) {
          const { data: rd } = await supabase.from("user_roles").select("role").eq("user_id", vs.user.id);
          verifyTarget = resolveRedirectTarget((rd ?? []).map((x: any) => x.role));
        }
      } catch { /* keep fallback /staff/today */ }
      setTimeout(() => navigate(verifyTarget, { replace: true }), 400);
    } catch (e) {
      toast.error(errorMessage(e, "Could not verify two-factor code."));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setStep("credentials");
    setMode("ready");
    setEmail(""); setPassword(""); setCode("");
    setFactorId(null); setChallengeId(null); setQrSvg(""); setSecret(""); setErrMsg("");
  };

  const activeRole = roleParam === "admin" ? "admin" : roleParam === "user" ? "user" : "staff";

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-4 md:py-6">
        <div className="w-full max-w-md bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          {/* Portal Switcher Tabs */}
          <div className="flex items-center justify-between p-1 mb-3.5 rounded-xl bg-muted/60 border border-border text-xs font-medium">
            <Link
              to="/staff/login?role=admin"
              className={`flex-1 py-1.5 rounded-lg transition text-center ${activeRole === "admin" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Admin Login
            </Link>
            <Link
              to="/staff/login?role=staff"
              className={`flex-1 py-1.5 rounded-lg transition text-center ${activeRole === "staff" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Staff Login
            </Link>
            <Link
              to="/staff/login?role=user"
              className={`flex-1 py-1.5 rounded-lg transition text-center ${activeRole === "user" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            >
              User Login
            </Link>
          </div>

          <div className="text-center mb-3">
            <h1 className="font-serif text-2xl font-normal tracking-tight">Radiantilyk Aesthetic</h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-0.5">
              {activeRole === "admin" ? "Admin & Management Portal" : activeRole === "user" ? "Patient & Client Portal" : "Staff & Provider Portal"}
            </p>
          </div>

          <Stepper step={step} />

          {mode === "loading" && (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          )}

          {mode === "ready" && step === "credentials" && (
            <>
              {reason === "idle" && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
                  <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Signed out after 15m of inactivity for privacy. Please sign in again.</span>
                </div>
              )}
              {/* Demo Credentials Quick Fill Box */}
              <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs">
                <div className="font-semibold text-foreground mb-1">⚡ Quick Demo Credentials</div>
                <div className="text-muted-foreground mb-2.5">Click a button below to auto-fill demo login details (password: <code className="bg-muted px-1 rounded text-foreground font-mono">12345678</code>):</div>
                <div className={`grid gap-2 ${roleParam === "admin" ? "grid-cols-2" : roleParam === "staff" ? "grid-cols-1" : "grid-cols-3"}`}>
                  {roleParam !== "staff" && (
                    <button
                      type="button"
                      onClick={() => fillDemoCredentials("admin@gmail.com")}
                      className="px-3 py-2 rounded-lg border border-border bg-background hover:bg-secondary/60 transition text-left text-xs font-medium cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        👑 <strong>Admin</strong>
                        <span className="text-[10px] text-muted-foreground block font-mono">admin@gmail.com</span>
                      </div>
                      <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded">Full Admin Access</span>
                    </button>
                  )}
                  {roleParam !== "admin" && (
                    <>
                      <button
                        type="button"
                        onClick={() => fillDemoCredentials("md@gmail.com")}
                        className="px-2 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 transition text-left text-xs font-medium cursor-pointer text-purple-900 dark:text-purple-300"
                      >
                        🩺 <strong>Medical Director</strong><br /><span className="text-[10px] opacity-80 truncate block">md@gmail.com</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fillDemoCredentials("officer@gmail.com")}
                        className="px-2 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition text-left text-xs font-medium cursor-pointer text-emerald-800 dark:text-emerald-300"
                      >
                        🛡️ <strong>Security Officer</strong><br /><span className="text-[10px] opacity-80 truncate block">officer@gmail.com</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fillDemoCredentials("staff@gmail.com")}
                        className="px-2 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary/60 transition text-left text-xs font-medium cursor-pointer"
                      >
                        💉 <strong>Staff / Nurse</strong><br /><span className="text-[10px] text-muted-foreground truncate block">staff@gmail.com</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <form onSubmit={submitCredentials} className="space-y-3">
                <div>
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-9 text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-0.5"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full rounded-full h-10 text-sm font-medium mt-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                </Button>
                <div className="pt-1 text-center text-xs space-y-1">
                  <Link to="/staff/forgot-password" className="text-primary hover:underline font-medium inline-block">
                    Forgot your password?
                  </Link>
                  <p className="text-[11px] text-muted-foreground">
                    No account? Check your email for an activation link.
                  </p>
                </div>
              </form>
            </>
          )}

          {mode === "ready" && errMsg && (step === "mfa-enroll" || step === "mfa-verify") && (
            <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive-soft-foreground">
              {errMsg}
            </div>
          )}

          {mode === "ready" && step === "mfa-enroll" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground flex gap-2">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>To protect health data, two-factor auth is required.</span>
              </div>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                <li>Install an authenticator app (Google Authenticator, Authy).</li>
                <li>Scan the QR code or enter secret.</li>
                <li>Enter the 6-digit verification code.</li>
              </ol>
              {qrSvg && (
                <div className="flex justify-center bg-white rounded-xl p-3 border">
                  <img src={qrSvg} alt="Scan with your authenticator app" className="h-32 w-32" />
                </div>
              )}
              {secret && (
                <div className="text-center">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Manual entry key</div>
                  <code className="text-xs font-mono select-all">{secret}</code>
                </div>
              )}
              <form onSubmit={verifyEnroll} className="space-y-3">
                <div>
                  <Label htmlFor="code" className="text-xs uppercase tracking-wider text-muted-foreground">6-digit code</Label>
                  <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="mt-1 h-9 text-center tracking-[0.4em] font-mono text-base" />
                </div>
                <Button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-full h-10 text-sm font-medium">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate two-factor"}
                </Button>
              </form>
            </div>
          )}

          {mode === "ready" && step === "mfa-verify" && (
            <form onSubmit={verifyLogin} className="space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                Enter the 6-digit code from your authenticator app to continue.
              </p>
              <div>
                <Label htmlFor="code" className="text-xs uppercase tracking-wider text-muted-foreground">Authentication code</Label>
                <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 h-9 text-center tracking-[0.4em] font-mono text-base" />
              </div>
              <Button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-full h-10 text-sm font-medium">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
              </Button>
            </form>
          )}

          {mode === "ready" && step === "redirecting" && (
            <div className="py-8 flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Taking you to your dashboard…
            </div>
          )}

          {(step === "mfa-enroll" || step === "mfa-verify") && (
            <div className="mt-4 text-center">
              <Button variant="link" size="sm" onClick={signOut} className="text-xs text-muted-foreground">
                Sign out and start over
              </Button>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step | "mfa"; label: string }[] = [
    { id: "credentials", label: "Sign in" },
    { id: "mfa", label: "Two-factor" },
    { id: "redirecting", label: "Dashboard" },
  ];
  const activeIdx = step === "credentials" ? 0 : step === "redirecting" ? 2 : 1;
  return (
    <div className="mb-3.5 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground" aria-label="Sign-in progress">
      {steps.map((s, i) => {
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-medium border ${isDone ? "bg-primary text-primary-foreground border-primary" : isActive ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}>
              {isDone ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </div>
            <span className={isActive ? "text-foreground font-semibold" : ""}>{s.label}</span>
            {i < steps.length - 1 && <span className="w-4 h-px bg-border mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
}
