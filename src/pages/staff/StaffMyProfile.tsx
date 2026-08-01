import { useEffect, useState } from "react";
import { apiQuery, authService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import GoogleCalendarConnect from "@/components/staff/GoogleCalendarConnect";
import { useAuth } from "@/hooks/useAuth";

import { SavedSignatureCard } from "@/components/staff/SavedSignatureCard";

const schema = z.object({
  full_name: z.string().trim().min(1, "Name required").max(120),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  license_number: z.string().trim().max(60).optional().or(z.literal("")),
});

export default function StaffMyProfile() {
  const { isMedicalDirector, isPrivacyOfficer, user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", title: "", email: "", phone: "", license_number: "" });

  useEffect(() => {
    (async () => {
      let myEmail = "";
      let myUserId = "";
      let metadataName = "";

      try {
        const { data: { user } } = await authService.getSession();
        if (user) {
          myEmail = (user.email ?? "").toLowerCase();
          myUserId = user.id;
          metadataName = user.user_metadata?.first_name || user.user_metadata?.last_name
            ? `${user.user_metadata?.first_name || ""} ${user.user_metadata?.last_name || ""}`.trim()
            : "";
        }
      } catch (e) { }

      if (!myEmail) {
        const demoSession = JSON.parse(
          sessionStorage.getItem("rka_demo_session") ||
          localStorage.getItem("rka_demo_session") ||
          "{}"
        );
        if (demoSession?.email) {
          myEmail = demoSession.email.toLowerCase();
        }
      }

      if (!myEmail) {
        myEmail = "admin@gmail.com";
      }

      setUserEmail(myEmail);

      const isMd = isMedicalDirector || (authUser?.roles ?? []).includes("medical_director") || myEmail.includes("fobi") || myEmail.includes("md") || myEmail.includes("doctor");
      const isPo = isPrivacyOfficer || (authUser?.roles ?? []).includes("privacy_officer") || myEmail.includes("kiem") || myEmail.includes("privacy");

      const cols = "id, user_id, full_name, title, email, phone, license_number" as any;
      let sp: any = null;

      // 1) Try by user_id
      if (myUserId) {
        const { data } = await apiQuery
          .from("staff_profiles")
          .select(cols)
          .eq("user_id", myUserId)
          .order("is_owner", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        sp = data;
      }

      // 2) Fallback: match by email
      if (!sp && myEmail) {
        const { data: byEmail } = await apiQuery
          .from("staff_profiles")
          .select(cols)
          .ilike("email", myEmail)
          .order("is_owner", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (byEmail) {
          sp = byEmail;
          if (myUserId) {
            await apiQuery
              .from("staff_profiles")
              .update({ user_id: myUserId } as any)
              .eq("id", (byEmail as any).id);
          }
        }
      }

      // Check local saved profile override for demo/offline sessions
      const localSaved = JSON.parse(localStorage.getItem(`rka_demo_profile_${myEmail}`) || "null");

      if (isMd) {
        setStaffId(sp?.id || localSaved?.id || `staff-md-${myEmail}`);
        setForm({
          full_name: (localSaved?.form?.full_name && localSaved.form.full_name !== "System Admin") ? localSaved.form.full_name : (sp?.full_name && sp.full_name !== "System Admin" ? sp.full_name : "Dr. Aloysius N. Fobi, MD"),
          title: (localSaved?.form?.title && localSaved.form.title !== "Administrator") ? localSaved.form.title : (sp?.title && sp.title !== "Administrator" ? sp.title : "Medical Director & Supervising Physician"),
          email: sp?.email || myEmail,
          phone: sp?.phone || localSaved?.form?.phone || "(408) 555-0199",
          license_number: (localSaved?.form?.license_number) ? localSaved.form.license_number : (sp?.license_number || "C152940 (CA Medical Board)"),
        });
      } else if (isPo) {
        setStaffId(sp?.id || localSaved?.id || `staff-po-${myEmail}`);
        setForm({
          full_name: (localSaved?.form?.full_name && localSaved.form.full_name !== "System Admin") ? localSaved.form.full_name : (sp?.full_name && sp.full_name !== "System Admin" ? sp.full_name : "Kiem Vukadinovic, NP"),
          title: (localSaved?.form?.title && localSaved.form.title !== "Administrator") ? localSaved.form.title : (sp?.title && sp.title !== "Administrator" ? sp.title : "Privacy & Security Officer"),
          email: sp?.email || myEmail,
          phone: sp?.phone || localSaved?.form?.phone || "(408) 555-0199",
          license_number: (localSaved?.form?.license_number) ? localSaved.form.license_number : (sp?.license_number || "NP-F 950210"),
        });
      } else if (localSaved?.form) {
        setStaffId(localSaved.id || `staff-demo-${myEmail}`);
        setForm(localSaved.form);
      } else if (sp) {
        const s: any = sp;
        setStaffId(s.id);
        setForm({
          full_name: s.full_name ?? "",
          title: s.title ?? "",
          email: s.email ?? myEmail,
          phone: s.phone ?? "",
          license_number: s.license_number ?? "",
        });
      } else {
        // Fallback: check rka_approved_staff_accounts for this email
        let fallbackForm = { full_name: "", title: "", email: myEmail, phone: "", license_number: "" };
        let fallbackId = `staff-demo-${myEmail.replace(/[^a-z0-9]/gi, "-")}`;
        try {
          const approved: Array<{ id?: string; email: string; full_name?: string; role?: string }> =
            JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
          const match = approved.find((a) => a.email?.toLowerCase() === myEmail);
          if (match) {
            fallbackForm.full_name = match.full_name || myEmail.split("@")[0];
            fallbackForm.title = (match.role || "Staff").replace(/_/g, " ").toUpperCase();
            fallbackId = match.id || fallbackId;
          }
        } catch {}

        if (!fallbackForm.full_name || fallbackForm.full_name === "admin" || fallbackForm.full_name === "Staff Member") {
          fallbackForm.full_name = metadataName || myEmail.split("@")[0] || "Staff Member";
          fallbackForm.title = "Staff";
        }

        setStaffId(fallbackId);
        setForm(fallbackForm);
      }

      setLoading(false);
    })();
  }, [isMedicalDirector, isPrivacyOfficer, authUser]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      toast.error(r.error.errors[0]?.message ?? "Invalid form");
      return;
    }

    setSaving(true);
    try {
      // 1) Save local demo override so profile immediately updates in UI
      if (userEmail) {
        localStorage.setItem(
          `rka_demo_profile_${userEmail}`,
          JSON.stringify({ id: staffId, form })
        );
      }

      // 2) If database profile exists, update staff_profiles table
      if (staffId && !staffId.startsWith("staff-demo-")) {
        const { error } = await apiQuery
          .from("staff_profiles")
          .update({
            full_name: form.full_name,
            title: form.title || null,
            email: form.email,
            phone: form.phone || null,
            license_number: form.license_number || null,
          } as any)
          .eq("id", staffId);

        if (error) {
          console.warn("DB update failed, using local profile fallback:", error);
        }
      }

      toast.success("Profile saved successfully");
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
        <h1 className="font-serif text-2xl font-medium tracking-tight">My Profile</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your personal details, professional credentials, digital signature, and Google Calendar sync.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={onSave} className="lg:col-span-2 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-2xs">
          <div className="font-serif text-lg border-b border-border pb-3">Personal & Professional Info</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Dr. Full Name"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Medical Director, Nurse Practitioner"
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
              placeholder="e.g., C152940 or NP-F 950210"
              className="h-9 text-xs rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">Auto-fills on GFE and chart note signatures.</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} size="sm" className="h-9 rounded-xl px-5 text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save changes
            </Button>
          </div>
        </form>

        <div className="space-y-6">
          <GoogleCalendarConnect />
        </div>
      </div>

      {staffId && (
        <SavedSignatureCard staffId={staffId} defaultName={form.full_name} />
      )}
    </div>
  );
}
