import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { authService, ApiClient } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Loader2, ShieldAlert, ShieldCheck, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { useAuth, AppRole, resolveLandingRoute } from "@/hooks/useAuth";

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



export default function AdminLogin() {
  const navigate = useNavigate();
  const { refreshCurrentUser } = useAuth();
  const [sp] = useSearchParams();
  const reason = sp.get("reason");
  const nextParam = sp.get("next");
  const nextPath = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : null; // null means we'll derive the target from roles at redirect time

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

  // On mount or tab switch, show login portal ready & clear form inputs
  useEffect(() => {
    setMode("ready");
    setStep("credentials");
    setEmail("");
    setPassword("");
    setCode("");
  }, []);

  const beginMfa = async (_cancelled?: boolean) => {
    setMode("loading");
    setErrMsg("");
    try {
      await refreshCurrentUser();
      const { session } = await authService.getSession();
      const userRoles = session?.user?.roles || [];
      const target = nextPath || resolveLandingRoute(userRoles);

      setStep("redirecting");
      setMode("ready");
      setTimeout(() => navigate(target, { replace: true }), 350);
    } catch {
      const fallbackTarget = nextPath || "/staff/today";
      navigate(fallbackTarget, { replace: true });
    }
  };

  const [pendingDemoLogin, setPendingDemoLogin] = useState<{ cleanEmail: string; roles: AppRole[]; isAd: boolean } | null>(null);

  const submitCredentials = async (e?: React.FormEvent, overrideEmail?: string, overridePassword?: string) => {
    if (e?.preventDefault) e.preventDefault();
    setLoading(true);
    setErrMsg("");
    const targetEmail = overrideEmail || email;
    const targetPassword = overridePassword || password;
    const cleanEmail = targetEmail.trim().toLowerCase();

    // Authenticate via backend API
    const { data, error } = await authService.signInWithPassword({ email: cleanEmail, password: targetPassword });

    if (data?.user) {
      try { sessionStorage.removeItem("rka_tab_session_user"); } catch (e) {}
      await refreshCurrentUser(true);
      setLoading(false);
      setPassword("");
      await beginMfa();
      return;
    }

    setLoading(false);
    const err = error?.message || "Invalid email or password. Access denied.";
    setErrMsg(err);
    toast.error(err);
  };

  const fillDemoCredentials = (targetEmail: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    setEmail(cleanEmail);
    setPassword("12345678");
    setCode("");
    const roleName =
      cleanEmail === "admin@gmail.com" ? "Admin" :
      cleanEmail.includes("medical") ? "Medical Director" :
      cleanEmail.includes("nurse") || cleanEmail.includes("prectitioner") ? "Nurse Practitioner" :
      cleanEmail.includes("injector") ? "RN Injector" :
      cleanEmail.includes("security") || cleanEmail.includes("officer") ? "Security Officer" :
      cleanEmail.includes("scheduler") ? "Front Desk" :
      cleanEmail === "user@gmail.com" ? "Patient" :
      "Staff";
    toast.info(`Signing in as ${roleName}...`);

    setTimeout(() => {
      submitCredentials(undefined, cleanEmail, "12345678");
    }, 50);
  };

  const verifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await withTimeout(
        authService.mfa.challenge({ factorId }),
        "Starting two-factor verification",
      );
      if (chErr) { toast.error(chErr.message); return; }
      const { error } = await withTimeout(authService.mfa.verify({
        factorId, challengeId: ch.id, code: code.trim(),
      }), "Verifying two-factor code");
      if (error) { toast.error(error.message); return; }
      toast.success("Two-factor authentication enabled");
      setStep("redirecting");
      // Resolve target from DB roles after successful MFA enrollment.
      let enrollTarget = nextPath || "/staff/today";
      if (!nextPath) {
        const { data: { session: es } } = await authService.getSession();
        const userRoles = es?.user?.roles || [];
        enrollTarget = resolveLandingRoute(userRoles);
      }
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
      // pendingDemoLogin is no longer used — redirect to credentials step
      toast.error("Please sign in again.");
      setStep("credentials");
      return;
    }

    if (!factorId || !challengeId) return;
    setBusy(true);
    try {
      const { error } = await withTimeout(authService.mfa.verify({
        factorId, challengeId, code: code.trim(),
      }), "Verifying two-factor code");
      if (error) {
        toast.error(error.message);
        setCode("");
        const { data: ch } = await authService.mfa.challenge({ factorId });
        if (ch) setChallengeId(ch.id);
        return;
      }
      toast.dismiss();
      setStep("redirecting");
      let verifyTarget = nextPath || "/staff/today";
      if (!nextPath) {
        const { data: { session: vs } } = await authService.getSession();
        const userRoles = vs?.user?.roles || [];
        verifyTarget = resolveLandingRoute(userRoles);
      }
      setTimeout(() => navigate(verifyTarget, { replace: true }), 400);
    } catch (e) {
      toast.error(errorMessage(e, "Could not verify two-factor code."));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await authService.logout();
    setStep("credentials");
    setMode("ready");
    setEmail(""); setPassword(""); setCode("");
    setFactorId(null); setChallengeId(null); setQrSvg(""); setSecret(""); setErrMsg("");
  };

  const activeRole = "admin";

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-4 md:py-6">
        <div className="w-full max-w-sm sm:max-w-[370px] bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-3.5 sm:p-4 shadow-sm">
          <div className="text-center mb-2.5">
            <h1 className="font-serif text-xl sm:text-2xl font-normal tracking-tight">Radiantilyk Aesthetic</h1>
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
              Admin & Management Portal
            </p>
          </div>

          {/* Portal Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 mb-4 rounded-xl bg-muted/50 border border-border/80 text-[11px] font-medium select-none">
            <Link
              to="/admin/login"
              className={`py-1.5 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                activeRole === "admin"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <span className="text-[11px]">👑</span>
              <span>Admin</span>
            </Link>
            <Link
              to="/staff/login"
              className={`py-1.5 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                activeRole === "staff"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <span className="text-[11px]">🩺</span>
              <span>Staff</span>
            </Link>
            <Link
              to="/account/auth"
              className={`py-1.5 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                activeRole === "user"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <span className="text-[11px]">👤</span>
              <span>User</span>
            </Link>
          </div>
          <Stepper step={step} />

          {mode === "loading" && (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
          )}

          {mode === "ready" && step === "credentials" && (
            <>
              {reason === "idle" && (
                <div className="mb-2.5 flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-[11px] text-warning-soft-foreground">
                  <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Signed out after 15m of inactivity for privacy. Please sign in again.</span>
                </div>
              )}

              {/* Bold Red Error Alert Banner directly inside Form */}
              {errMsg && (
                <div className="mb-3 p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2.5 shadow-2xs">
                  <ShieldAlert className="h-4.5 w-4.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">{errMsg}</div>
                </div>
              )}

              {/* Demo Credentials Quick Fill Box */}
              <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-2.5 text-xs">
                <div className="font-semibold text-foreground mb-0.5 text-[11px]">⚡ Quick Demo Credentials</div>
                <div className="text-muted-foreground text-[10px] mb-1.5">Click below to auto-fill demo login (password: <code className="bg-muted px-1 rounded text-foreground font-mono">12345678</code>):</div>
                
                {activeRole === "admin" && (
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials("admin@gmail.com")}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary/60 transition text-left text-xs font-medium cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      👑 <strong>Admin Account</strong>
                      <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">admin@gmail.com</span>
                    </div>
                    <span className="text-[9px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded">Admin</span>
                  </button>
                )}


              </div>

              <form onSubmit={submitCredentials} className="space-y-2.5" autoComplete="off">
                <div>
                  <Label htmlFor="email" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Email</Label>
                  <Input id="email" type="email" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-0.5 h-8.5 text-xs" />
                </div>
                <div>
                  <Label htmlFor="password" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Password</Label>
                  <div className="relative mt-0.5">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-8.5 text-xs pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-0.5"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full rounded-full h-8.5 text-xs font-medium mt-1">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Continue"}
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
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-2 text-center text-xs space-y-1">
                <div className="font-semibold text-foreground">🔒 Mandatory 2-Factor Authentication</div>
                <div className="text-[11px] text-muted-foreground">
                  Authentication Code: <code className="bg-background px-1.5 py-0.5 rounded border border-border font-mono font-bold text-primary">123456</code>
                </div>
              </div>
              <div>
                <Label htmlFor="code" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Enter 6-Digit Code</Label>
                <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus
                  placeholder="------"
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="mt-0.5 h-9 text-center tracking-[0.4em] font-mono text-base" />
              </div>
              <Button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-full h-9 text-xs font-medium">
                {busy ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : "Verify Code & Open Dashboard →"}
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
    { id: "credentials", label: "Credentials" },
    { id: "mfa", label: "2FA Code" },
    { id: "redirecting", label: "Dashboard" },
  ];
  const activeIdx = step === "credentials" ? 0 : step === "redirecting" ? 2 : 1;
  return (
    <div className="mb-4 px-1" aria-label="Sign-in progress">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-2.5 left-6 right-6 h-0.5 bg-border -z-0" />
        {steps.map((s, i) => {
          const isDone = i < activeIdx;
          const isActive = i === activeIdx;
          return (
            <div key={s.id} className="flex flex-col items-center gap-1 z-10 bg-card px-1">
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold border transition ${
                  isDone
                    ? "bg-primary text-primary-foreground border-primary"
                    : isActive
                    ? "bg-primary/10 border-primary text-primary ring-2 ring-primary/20 font-bold"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium tracking-tight ${isActive ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
