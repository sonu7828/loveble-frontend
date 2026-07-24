import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { setDemoAuthSession } from "@/hooks/useAuth";
import { getClientSession } from "@/hooks/useClientAuth";

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(8, "At least 8 characters").max(72),
});

export default function PatientAuth() {
  const navigate = useNavigate();
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
    toast.info("Demo User credentials populated in Email & Password fields. Click Sign in to proceed.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "signin") {
      const cleanEmail = form.email.trim().toLowerCase();

      // Demo fallback for user@gmail.com
      if (cleanEmail === "user@gmail.com") {
        setDemoAuthSession("user@gmail.com", []);
        toast.success("Signed in as Demo Patient");
        setLoading(false);
        navigate("/account", { replace: true });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: form.password,
      });

      setLoading(false);
      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("not found")) {
          toast.error("We couldn't sign you in. Try the email sign-in link below — it works even if you've never set a password.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      navigate("/account");
      return;
    }

    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      setLoading(false);
      toast.error(parsed.error.issues[0]?.message ?? "Please complete the form");
      return;
    }

    const email = form.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
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
      toast.error(error.message);
      return;
    }

    // Insert client profile (best-effort if session exists)
    if (data.user && data.session) {
      await supabase.from("client_profiles").upsert({
        user_id: data.user.id,
        email,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim(),
      }, { onConflict: "user_id" });
    }

    // Sync to GoHighLevel (best-effort)
    supabase.functions.invoke("ghl-sync-contact", {
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
    const { error } = await supabase.auth.signInWithOtp({
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
        <div className="w-full max-w-md bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          {/* Portal Switcher Tabs */}
          <div className="flex items-center justify-between p-1 mb-3.5 rounded-xl bg-muted/60 border border-border text-xs font-medium">
            <Link
              to="/staff/login?role=admin"
              className="flex-1 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition text-center"
            >
              Admin Login
            </Link>
            <Link
              to="/staff/login?role=staff"
              className="flex-1 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition text-center"
            >
              Staff Login
            </Link>
            <button
              type="button"
              className="flex-1 py-1.5 rounded-lg bg-background text-foreground shadow-xs transition text-center font-semibold"
            >
              User Login
            </button>
          </div>

          <div className="text-center mb-3">
            <h1 className="font-serif text-2xl font-normal tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "signin"
                ? "Sign in to view and manage appointments."
                : "Save your details for faster booking next time."}
            </p>
          </div>

          {mode === "signin" && (
            <div className="mb-3.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
              <div className="font-semibold text-foreground mb-0.5 flex items-center justify-between">
                <span>⚡ Quick Demo User</span>
                <span className="text-[10px] text-muted-foreground font-normal">Pass: <code className="bg-muted px-1 rounded text-foreground font-mono">12345678</code></span>
              </div>
              <div className="text-[11px] text-muted-foreground mb-2">Click below to auto-fill demo patient login:</div>
              <button
                type="button"
                onClick={fillClientDemoCredentials}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary/60 transition text-left text-xs font-medium cursor-pointer flex items-center justify-between"
              >
                <div>
                  👤 <strong>Demo Patient Account</strong>
                  <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">user@gmail.com</span>
                </div>
                <span className="text-[10px] bg-secondary text-secondary-foreground font-semibold px-2 py-0.5 rounded">Client Portal</span>
              </button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor="fn" className="text-xs uppercase tracking-wider text-muted-foreground">First name</Label>
                  <Input id="fn" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label htmlFor="ln" className="text-xs uppercase tracking-wider text-muted-foreground">Last name</Label>
                  <Input id="ln" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-1 h-9 text-sm" />
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input id="email" type="email" autoFocus autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-9 text-sm" />
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-muted-foreground">Phone</Label>
                <Input id="phone" type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
            )}
            <div>
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {mode === "signin" && (
            <>
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={sendMagicLink}
                disabled={loading}
                className="w-full rounded-full h-9 text-xs gap-2"
              >
                <Mail className="h-3.5 w-3.5" /> Email me a one-tap sign-in link
              </Button>
            </>
          )}

          <div className="mt-3 text-center text-xs text-muted-foreground space-y-1">
            <p>
              {mode === "signin" ? (
                <>New here? <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">Create an account</button></>
              ) : (
                <>Already have one? <button onClick={() => setMode("signin")} className="text-primary font-medium hover:underline">Sign in</button></>
              )}
            </p>
            <p>
              <Link to="/book" className="hover:text-foreground text-[11px]">Continue as guest →</Link>
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
