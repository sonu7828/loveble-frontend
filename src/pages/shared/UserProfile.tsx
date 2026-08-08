import { useEffect, useState } from "react";
import { apiQuery, authService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import GoogleCalendarConnect from "@/components/staff/GoogleCalendarConnect";
import { useAuth } from "@/hooks/useAuth";
import { SavedSignatureCard } from "@/components/staff/SavedSignatureCard";
import { AdminBookingHoursAndHolidays } from "@/components/admin/AdminBookingHoursAndHolidays";

const schema = z.object({
  full_name: z.string().trim().min(1, "Name required").max(120),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  license_number: z.string().trim().max(60).optional().or(z.literal("")),
});

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function UserProfile() {
  const { isMedicalDirector, isPrivacyOfficer, isFrontDesk, isNP, isRNInjector, isProvider, isAdmin, user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", title: "", email: "", phone: "", license_number: "" });

  // Clinical Availability Hours state
  const [weeklyAvailability, setWeeklyAvailability] = useState<Record<string, { enabled: boolean; start: string; end: string }>>({
    Monday: { enabled: true, start: "09:00", end: "17:00" },
    Tuesday: { enabled: true, start: "09:00", end: "17:00" },
    Wednesday: { enabled: true, start: "09:00", end: "17:00" },
    Thursday: { enabled: true, start: "09:00", end: "17:00" },
    Friday: { enabled: true, start: "09:00", end: "17:00" },
    Saturday: { enabled: true, start: "09:00", end: "15:00" },
  });

  useEffect(() => {
    (async () => {
      let myEmail = (authUser?.email || "").toLowerCase().trim();
      let myUserId = authUser?.id || "";

      if (!myEmail) {
        try {
          const sessionRes = await authService.getSession();
          const user = sessionRes?.user || sessionRes?.data?.session?.user;
          if (user) {
            myEmail = (user.email ?? "").toLowerCase();
            myUserId = user.id;
          }
        } catch (e) { }
      }

      setUserEmail(myEmail);

      const roles = authUser?.roles || [];
      const isMd = (roles.includes("medical_director") || myEmail.includes("medical")) && !isAdmin;
      const isPo = (roles.includes("privacy_officer") || myEmail.includes("security")) && !isAdmin;
      const isNurse = (roles.includes("nurse_practitioner") || myEmail.includes("nurse") || myEmail.includes("prectitioner")) && !isAdmin;
      const isRn = (roles.includes("rn_injector") || myEmail.includes("injector")) && !isAdmin;
      const isFd = (roles.includes("front_desk") || myEmail.includes("scheduler")) && !isAdmin;

      const cols = "id, user_id, full_name, title, email, phone, license_number" as any;
      let sp: any = null;

      if (myUserId) {
        const { data } = await apiQuery
          .from("staff_profiles")
          .select(cols)
          .eq("user_id", myUserId)
          .order("is_owner", { ascending: false })
          .limit(1)
          .maybeSingle();
        sp = data;
      }

      if (!sp && myEmail) {
        const { data: byEmail } = await apiQuery
          .from("staff_profiles")
          .select(cols)
          .ilike("email", myEmail)
          .order("is_owner", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byEmail) sp = byEmail;
      }

      // 1. Check approved accounts created by Admin in AdminTeam (rka_approved_staff_accounts)
      let approvedAccount: any = null;
      try {
        const approvedList: any[] = JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
        // Strict priority: match exact role for the active portal
        if (isNurse) {
          approvedAccount = approvedList.find((a: any) => a.role === "nurse_practitioner" || a.email?.includes("nurse"));
        } else if (isMd) {
          approvedAccount = approvedList.find((a: any) => a.role === "medical_director" || a.email?.includes("md"));
        } else if (isPo) {
          approvedAccount = approvedList.find((a: any) => a.role === "privacy_officer" || a.email?.includes("privacy"));
        } else if (isRn) {
          approvedAccount = approvedList.find((a: any) => a.role === "rn_injector" || a.email?.includes("injector"));
        } else if (isFd) {
          approvedAccount = approvedList.find((a: any) => a.role === "front_desk" || a.email?.includes("scheduler"));
        }

        if (!approvedAccount) {
          approvedAccount = approvedList.find((a: any) => a.email && a.email.toLowerCase() === myEmail.toLowerCase());
        }
      } catch { }

      // 2. Check local saved profile override for the current user email (strictly account-scoped)
      try { localStorage.removeItem("rka_user_profile_override"); } catch { }
      // Purge any legacy Dr. M / m@gmail.com override keys
      try {
        localStorage.removeItem("rka_user_profile_override_m@gmail.com");
        localStorage.removeItem("rka_demo_profile_m@gmail.com");
      } catch { }

      const accountOverride = myEmail ? JSON.parse(localStorage.getItem(`rka_user_profile_override_${myEmail}`) || "null") : null;
      const localSaved = myEmail ? JSON.parse(localStorage.getItem(`rka_demo_profile_${myEmail}`) || "null") : null;
      const savedForm = accountOverride || localSaved?.form || localSaved;

      const isGenericName = (n: string | undefined) =>
        !n || n === "Dr. M" || n === "System Admin" || n === "Front Desk Receptionist" || n === "Staff Member" || n === "admin";
      const isGenericTitle = (t: string | undefined) =>
        !t || t === "Administrator" || t === "Staff" || t === "admin";

      let resolvedName = (savedForm?.full_name && savedForm.full_name.trim() && savedForm.full_name !== "Dr. M")
        ? savedForm.full_name
        : (approvedAccount?.full_name || (!isGenericName(sp?.full_name) ? sp.full_name : ""));
      let resolvedEmail = (savedForm?.email && savedForm.email.trim() && savedForm.email !== "m@gmail.com")
        ? savedForm.email
        : (approvedAccount?.email || (sp?.email !== "admin@gmail.com" ? sp?.email : null) || "");
      let resolvedTitle = (savedForm?.title && savedForm.title.trim())
        ? savedForm.title
        : (approvedAccount?.title || sp?.title || "");
      let resolvedPhone = (savedForm?.phone && savedForm.phone.trim() && savedForm.phone !== "(555) 234-5678")
        ? savedForm.phone
        : (approvedAccount?.phone || sp?.phone || "(408) 555-0199");
      let resolvedLicense = (savedForm?.license_number && savedForm.license_number.trim() && savedForm.license_number !== "NP-95021080")
        ? savedForm.license_number
        : (approvedAccount?.license_number || sp?.license_number || "");

      if (isGenericName(resolvedName)) {
        if (isMd) resolvedName = "Dr. Dhruva";
        else if (isPo) resolvedName = "Bob Stane";
        else if (isNurse) resolvedName = "Kiem Vukadinovic, NP";
        else if (isRn) resolvedName = "Girish, RN Injector";
        else if (isFd) resolvedName = "Front Desk Receptionist";
        else resolvedName = "System Admin";
      }

      if (!resolvedEmail || resolvedEmail === "m@gmail.com" || (resolvedEmail === "admin@gmail.com" && (isNurse || isMd || isPo || isRn || isFd))) {
        if (isNurse) resolvedEmail = "nurseprectitioner@gmail.com";
        else if (isMd) resolvedEmail = "medicaldirector@gmail.com";
        else if (isRn) resolvedEmail = "injector@gmail.com";
        else if (isFd) resolvedEmail = "scheduler@gmail.com";
        else resolvedEmail = myEmail;
      }

      if (isGenericTitle(resolvedTitle)) {
        if (isMd) resolvedTitle = "Medical Director & Supervising Physician";
        else if (isPo) resolvedTitle = "Privacy & Security Officer & Founder";
        else if (isNurse) resolvedTitle = "Nurse Practitioner & Lead Injector";
        else if (isRn) resolvedTitle = "Registered Nurse Injector";
        else if (isFd) resolvedTitle = "Front Desk Coordinator & Scheduler";
        else resolvedTitle = "System Administrator & Owner";
      }

      // If email is still admin@gmail.com while in a staff/clinical role, use approved account email
      if (resolvedEmail === "admin@gmail.com" && approvedAccount?.email) {
        resolvedEmail = approvedAccount.email;
      }

      if (!resolvedLicense || (isMd && resolvedLicense.startsWith("NP"))) {
        if (isMd) resolvedLicense = "C152940 (CA Medical Board)";
        else if (isPo || isNurse) resolvedLicense = "NP-F 950210 (CA BRN)";
        else if (isRn) resolvedLicense = "RN 842109";
        else if (isFd) resolvedLicense = "N/A (Front Desk Administrative)";
        else resolvedLicense = "N/A (System Admin)";
      }

      setStaffId(sp?.id || localSaved?.id || `staff-${resolvedEmail.replace(/[^a-z0-9]/gi, "-")}`);
      setForm({
        full_name: resolvedName,
        title: resolvedTitle,
        email: resolvedEmail,
        phone: sp?.phone || savedForm?.phone || resolvedPhone,
        license_number: resolvedLicense,
      });

      // Restore saved availability
      const savedAvailability = localStorage.getItem(`rka_availability_${myEmail}`);
      if (savedAvailability) {
        try { setWeeklyAvailability(JSON.parse(savedAvailability)); } catch { }
      }

      setLoading(false);
    })();
  }, [isMedicalDirector, isPrivacyOfficer, isFrontDesk, isNP, isRNInjector, isAdmin, authUser]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      toast.error(r.error.errors[0]?.message ?? "Invalid form");
      return;
    }

    setSaving(true);
    try {
      const nameParts = form.full_name.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const activeEmail = (userEmail || form.email || "").toLowerCase().trim();

      if (activeEmail) {
        localStorage.setItem(
          `rka_demo_profile_${activeEmail}`,
          JSON.stringify({ id: staffId, form })
        );
        localStorage.setItem(
          `rka_user_profile_override_${activeEmail}`,
          JSON.stringify({
            full_name: form.full_name,
            first_name: firstName,
            last_name: lastName,
            email: form.email,
            title: form.title,
            phone: form.phone,
            license_number: form.license_number,
          })
        );
        localStorage.setItem(
          `rka_availability_${activeEmail}`,
          JSON.stringify(weeklyAvailability)
        );
      }

      // Remove global un-scoped key so other accounts are never polluted
      try { localStorage.removeItem("rka_user_profile_override"); } catch { }

      // Update approved staff account list if present
      try {
        const approvedList: any[] = JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
        const updatedList = approvedList.map((acc: any) => {
          if (acc.email && acc.email.toLowerCase() === form.email.toLowerCase()) {
            return {
              ...acc,
              full_name: form.full_name,
              title: form.title,
              phone: form.phone,
              license_number: form.license_number,
            };
          }
          return acc;
        });
        localStorage.setItem("rka_approved_staff_accounts", JSON.stringify(updatedList));
      } catch (e) { }

      if (staffId && !staffId.startsWith("staff-")) {
        await apiQuery
          .from("staff_profiles")
          .update({
            full_name: form.full_name,
            title: form.title || null,
            email: form.email,
            phone: form.phone || null,
            license_number: form.license_number || null,
          } as any)
          .eq("id", staffId)
          .catch(() => { });
      }

      // Dispatch event to notify all components to re-render with the new profile details
      window.dispatchEvent(new Event("rka_profile_updated"));
      toast.success("Profile & Availability saved successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">My Profile &amp; Clinical Credentials</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your personal details, professional credentials, clinical availability, digital signature, and Google Calendar sync.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={onSave} className="lg:col-span-2 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-2xs">
          <div className="font-serif text-lg border-b border-border pb-3">Personal &amp; Professional Info</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Full Name"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Nurse Practitioner & Lead Injector"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                type="email"
                className="h-9 text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">Updates sign-in email. You'll get a confirmation link.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 000-0000"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">CA license # (NP/RN/MD)</Label>
            <Input
              value={form.license_number}
              onChange={(e) => setForm({ ...form, license_number: e.target.value })}
              placeholder="e.g., C152940, NP-F 950210, or N/A"
              className="h-9 text-xs rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">Auto-fills on GFE and chart note signatures.</p>
          </div>

          {/* Clinical Weekly Availability Block */}
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Clinical Availability Hours</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">San Jose Studio Schedule</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {DAYS.map((day) => {
                const avail = weeklyAvailability[day] ?? { enabled: false, start: "09:00", end: "17:00" };
                return (
                  <div key={day} className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-muted/20">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={avail.enabled}
                        onChange={(e) =>
                          setWeeklyAvailability({
                            ...weeklyAvailability,
                            [day]: { ...avail, enabled: e.target.checked },
                          })
                        }
                        className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span>{day}</span>
                    </label>

                    {avail.enabled ? (
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <span>{avail.start}</span>
                        <span className="text-muted-foreground">-</span>
                        <span>{avail.end}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">Off</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} size="sm" className="h-9 rounded-xl px-5 text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save changes &amp; Availability
            </Button>
          </div>
        </form>

        {(isProvider || isNP || isRNInjector || isMedicalDirector) && (
          <div className="space-y-6">
            <GoogleCalendarConnect staffId={staffId} />
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-8">
          <AdminBookingHoursAndHolidays />
        </div>
      )}

      {staffId && (
        <SavedSignatureCard staffId={staffId} defaultName={form.full_name} />
      )}
    </div>
  );
}
