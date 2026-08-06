import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/SiteChrome";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function StaffResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid or missing reset token. Please request a new password reset link.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }

    setLoading(true);
    const { success, message, error } = await authService.resetPassword(token, password);
    setPassword("");
    setConfirm("");
    setLoading(false);

    if (!success || error) {
      toast.error(error || "Invalid or expired password reset link.");
      return;
    }

    toast.success(message || "Password updated successfully. Please sign in.");
    navigate("/staff/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="font-serif text-3xl">Radiantilyk Aesthetic</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">
              Choose a new password
            </div>
          </div>
          {!token ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Invalid or missing password reset link. Please request a new link.
              </p>
              <Link to="/staff/forgot-password" className="text-sm text-primary hover:underline">
                Request new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full rounded-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
