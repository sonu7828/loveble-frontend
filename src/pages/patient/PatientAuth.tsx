import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { getClientSession } from "@/hooks/useClientAuth";
import { formatPhone10 } from "@/lib/formatPhone";

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().refine((v) => v.replace(/\D/g, "").length === 10, "Phone number must be 10 digits"),
  password: z.string().min(8, "At least 8 characters").max(72),
});

import { useAuth } from "@/hooks/useAuth";

export default function PatientAuth() {
  const navigate = useNavigate();
  const { refreshCurrentUser } = useAuth();
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "",
  });

  const fillClientDemoCredentials = () => {
    setForm((f) => ({ ...f, email: "user@gmail.com", password: "12345678" }));
    toast.info("Demo credentials filled — click Continue to sign in.");
  };

  const submit = async (e?: React.FormEvent, overrideEmail?: string, overridePassword?: string) => {
    if (e?.preventDefault) e.preventDefault();
    setLoading(true);

    if (mode === "signin") {
      const cleanEmail = (overrideEmail || form.email).trim().toLowerCase();
      const pass = overridePassword || form.password;

      const { data, error } = await authService.signInWithPassword({
        email: cleanEmail, password: pass,
      });

      setLoading(false);
      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("not found")) {
          toast.error("We couldn't sign you in. Please check your email and password.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Check if forced password change is required
      if ((data as any)?.mustChangePassword) {
        navigate("/account/change-password", { replace: true });
        return;
      }

      await refreshCurrentUser();
      navigate("/account", { replace: true });
      return;
    }

    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      setLoading(false);
      toast.error(parsed.error.issues[0]?.message ?? "Please complete the form");
      return;
    }

    const email = form.email.trim().toLowerCase();
    const { data, error } = await authService.signUp({
      email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/account`,
        data: {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          phone: form.phone.trim(),
        },
      },
    });
    if (error) {
      setLoading(false);
      const msg = error.message || "";
      const is409 = (error as any)?.statusCode === 409 || msg.includes("409") || msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("conflict");
      if (is409) {
        toast.error("An account with this email address already exists. Switching to Sign In.");
        setMode("signin");
      } else {
        toast.error(msg || "Failed to create account. Please try again.");
      }
      return;
    }

    // Insert client profile (best-effort if session exists)
    if (data.user && data.session) {
      await apiQuery("client_profiles").upsert({
        user_id: data.user.id,
        email,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim(),
      }, { onConflict: "user_id" });
    }

    // Sync to GoHighLevel (best-effort)
    ApiClient.post("ghl-sync-contact", {
      body: {
        email,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        source: "rkabook signup",
        tags: ["rkabook", "signup"],
      },
    }).catch((e) => console.error("ghl sync failed", e));

    setLoading(false);
    if (data.session) {
      toast.success("Account created");
      navigate("/account");
    } else {
      toast.success("Check your email to verify your account");
      setMode("signin");
    }
  };

  const sendMagicLink = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter your email first"); return;
    }
    setLoading(true);
    const { error } = await authService.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/account`, shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      const m = error.message?.toLowerCase() ?? "";
      if (m.includes("rate") || m.includes("too many")) {
        toast.error("Too many attempts. Please wait a minute and try again.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Check your email for a sign-in link (also check spam).");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-4 md:py-6">
        <div className="w-full max-w-sm sm:max-w-[370px] bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-3.5 sm:p-4 shadow-sm">
          <div className="text-center mb-2.5">
            <h1 className="font-serif text-xl sm:text-2xl font-normal tracking-tight">Radiantilyk Aesthetic</h1>
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
              Patient & Client Portal
            </p>
          </div>

          {/* Portal Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 mb-4 rounded-xl bg-muted/50 border border-border/80 text-[11px] font-medium select-none">
            <Link
              to="/admin/login"
              className="py-1.5 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            >
              <span className="text-[11px]">👑</span>
              <span>Admin</span>
            </Link>
            <Link
              to="/staff/login"
              className="py-1.5 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            >
              <span className="text-[11px]">🩺</span>
              <span>Staff</span>
            </Link>
            <Link
              to="/account/auth"
              className="py-1.5 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 bg-primary text-primary-foreground shadow-xs font-semibold"
            >
              <span className="text-[11px]">👤</span>
              <span>User</span>
            </Link>
          </div>

          {mode === "signin" && (
            <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-2.5 text-xs">
              <div className="font-semibold text-foreground mb-0.5 flex items-center justify-between text-[11px]">
                <span>⚡ Quick Demo User</span>
                <span className="text-[9px] text-muted-foreground font-normal">Pass: <code className="bg-muted px-1 rounded text-foreground font-mono">12345678</code></span>
              </div>
              <button
                type="button"
                onClick={fillClientDemoCredentials}
                className="w-full mt-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary/60 transition text-left text-xs font-medium cursor-pointer flex items-center justify-between"
              >
                <div>
                  👤 <strong>Demo Patient Account</strong>
                  <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">user@gmail.com</span>
                </div>
                <span className="text-[9px] bg-secondary text-secondary-foreground font-semibold px-1.5 py-0.5 rounded">User</span>
              </button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-2.5">
            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="fn" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">First name</Label>
                    <Input id="fn" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-0.5 h-8.5 text-xs" />
                  </div>
                  <div>
                    <Label htmlFor="ln" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Last name</Label>
                    <Input id="ln" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-0.5 h-8.5 text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="email" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Email</Label>
                    <Input id="email" type="email" autoFocus autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-0.5 h-8.5 text-xs" />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      maxLength={14}
                      placeholder="(555) 000-0000"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: formatPhone10(e.target.value) })}
                      className="mt-0.5 h-8.5 text-xs"
                    />
                  </div>
                </div>
              </>
            )}

            {mode === "signin" && (
              <div>
                <Label htmlFor="email" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Email</Label>
                <Input id="email" type="email" autoFocus autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-0.5 h-8.5 text-xs" />
              </div>
            )}

            <div>
              <Label htmlFor="password" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Password</Label>
              <div className="relative mt-0.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
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
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {mode === "signin" && (
            <>
              <div className="flex items-center gap-2 my-2.5">
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={sendMagicLink}
                disabled={loading}
                className="w-full rounded-full h-8 text-xs gap-1.5"
              >
                <Mail className="h-3 w-3" /> Email me a one-tap sign-in link
              </Button>
            </>
          )}

          <div className="mt-2.5 text-center text-xs text-muted-foreground space-y-0.5">
            <p>
              {mode === "signin" ? (
                <>New here? <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">Create an account</button></>
              ) : (
                <>Already have one? <button onClick={() => setMode("signin")} className="text-primary font-medium hover:underline">Sign in</button></>
              )}
            </p>
            <p>
              <Link to="/book" className="hover:text-foreground text-[10px]">Continue as guest →</Link>
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
