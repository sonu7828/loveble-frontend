import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/SiteChrome";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function StaffActivate() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [stage, setStage] = useState<"loading" | "form" | "done" | "invalid">("loading");
  const [staffName, setStaffName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("staff-invite-verify", { body: { token } });
      if (error || !data?.valid) { setStage("invalid"); return; }
      setStaffName(data.staffName);
      setEmail(data.email);
      setStage("form");
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("staff-invite-accept", {
      body: { token, password },
    });
    if (error || data?.error) {
      setSubmitting(false);
      toast.error(data?.error || error?.message || "Could not activate");
      return;
    }
    // Sign in
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signErr) { toast.error(signErr.message); return; }
    setStage("done");
    setTimeout(() => navigate("/staff/today"), 1500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="font-serif text-3xl">Radiantilyk Aesthetic</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">Activate your account</div>
          </div>

          {stage === "loading" && <div className="text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}

          {stage === "invalid" && (
            <div className="text-center space-y-3">
              <p className="text-sm">This invitation link is invalid or has expired.</p>
              <p className="text-xs text-muted-foreground">Please ask your administrator to send a new one.</p>
            </div>
          )}

          {stage === "form" && (
            <form onSubmit={submit} className="space-y-5">
              <div className="rounded-xl bg-secondary/50 p-4 text-sm">
                <div className="font-serif text-lg">Welcome, {staffName}</div>
                <div className="text-xs text-muted-foreground mt-1">{email}</div>
              </div>
              <div>
                <Label>Create password</Label>
                <Input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Confirm password</Label>
                <Input type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5" />
              </div>
              <Button type="submit" disabled={submitting} className="w-full rounded-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate account"}
              </Button>
            </form>
          )}

          {stage === "done" && (
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <p className="text-sm">Account activated. Redirecting…</p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
