import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "@/services/api";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

/**
 * ForcePasswordChange — Phase 2
 * Shown when a newly provisioned patient logs in with a temporary password.
 * The user MUST change their password before accessing the patient portal.
 * Cannot be dismissed or bypassed.
 */
export default function ForcePasswordChange() {
  const navigate = useNavigate();
  const { refreshCurrentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.currentPassword) {
      errs.currentPassword = "Temporary password is required";
    }
    if (!form.newPassword) {
      errs.newPassword = "New password is required";
    } else if (form.newPassword.length < 8) {
      errs.newPassword = "Password must be at least 8 characters";
    } else if (form.newPassword.length > 72) {
      errs.newPassword = "Password must be at most 72 characters";
    } else if (!/[A-Z]/.test(form.newPassword)) {
      errs.newPassword = "Password must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(form.newPassword)) {
      errs.newPassword = "Password must contain at least one lowercase letter";
    } else if (!/[0-9]/.test(form.newPassword)) {
      errs.newPassword = "Password must contain at least one number";
    }
    if (!form.confirmPassword) {
      errs.confirmPassword = "Please confirm your new password";
    } else if (form.newPassword !== form.confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }
    if (form.newPassword && form.currentPassword && form.newPassword === form.currentPassword) {
      errs.newPassword = "New password must be different from your temporary password";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const result = await authService.changePassword(form.currentPassword, form.newPassword);
    setLoading(false);

    if (result.error) {
      const msg = result.error.toLowerCase();
      if (msg.includes("current password") || msg.includes("incorrect")) {
        setErrors({ currentPassword: "Temporary password is incorrect" });
      } else if (msg.includes("reuse") || msg.includes("history")) {
        setErrors({ newPassword: result.error });
      } else {
        toast.error(result.error);
      }
      return;
    }

    toast.success("Password changed successfully! Welcome to your patient portal.");
    await refreshCurrentUser();
    navigate("/account", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header Card */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-serif font-bold text-foreground">Password Change Required</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Your account was created with a temporary password.
              For your security, you must set a new password before continuing.
            </p>
          </div>

          {/* Form Card */}
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-lg space-y-5">
            {/* Current/Temporary Password */}
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-sm font-medium">
                Temporary Password
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  value={form.currentPassword}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, currentPassword: e.target.value }));
                    setErrors((prev) => { const n = { ...prev }; delete n.currentPassword; return n; });
                  }}
                  placeholder="Enter your temporary password"
                  autoComplete="current-password"
                  className={errors.currentPassword ? "border-destructive" : ""}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrent(!showCurrent)}
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-xs text-destructive">{errors.currentPassword}</p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-sm font-medium">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  value={form.newPassword}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, newPassword: e.target.value }));
                    setErrors((prev) => { const n = { ...prev }; delete n.newPassword; return n; });
                  }}
                  placeholder="Choose a strong new password"
                  autoComplete="new-password"
                  className={errors.newPassword ? "border-destructive" : ""}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew(!showNew)}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-xs text-destructive">{errors.newPassword}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Minimum 8 characters with uppercase, lowercase, and a number.
              </p>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, confirmPassword: e.target.value }));
                    setErrors((prev) => { const n = { ...prev }; delete n.confirmPassword; return n; });
                  }}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  className={errors.confirmPassword ? "border-destructive" : ""}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Changing Password…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Set New Password & Continue
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            This is a one-time security requirement. Your temporary password will be invalidated after this change.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
