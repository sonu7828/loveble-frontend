import { useEffect, useState } from "react";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import GoogleCalendarConnect from "@/components/staff/GoogleCalendarConnect";
import { useAuth } from "@/hooks/useAuth";
import SharedOwnerCalendarCard from "@/components/staff/SharedOwnerCalendarCard";

import { SavedSignatureCard } from "@/components/staff/SavedSignatureCard";

const schema = z.object({
  full_name: z.string().trim().min(1, "Name required").max(120),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  license_number: z.string().trim().max(60).optional().or(z.literal("")),
});


export default function StaffMyProfile() {
  const { isAdmin } = useAuth();
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

      if (localSaved?.form) {
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

        // If still no name, use auth metadata or generic defaults
        if (!fallbackForm.full_name) {
          fallbackForm.full_name = metadataName || myEmail.split("@")[0] || "Staff Member";
          fallbackForm.title = "Staff";
        }

        setStaffId(fallbackId);
        setForm(fallbackForm);
        localStorage.setItem(`rka_demo_profile_${myEmail}`, JSON.stringify({ id: fallbackId, form: fallbackForm }));
      }

      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    try {
      if (staffId && !staffId.startsWith("staff-demo-")) {
        const { error } = await apiQuery
          .from("staff_profiles")
          .update({
            full_name: parsed.data.full_name,
            title: parsed.data.title || "Staff",
            email: parsed.data.email,
            phone: parsed.data.phone || null,
            license_number: parsed.data.license_number || null,
          } as any)
          .eq("id", staffId);
        if (error) throw error;
      }

      if (userEmail) {
        localStorage.setItem(
          `rka_demo_profile_${userEmail.toLowerCase()}`,
          JSON.stringify({ id: staffId || `staff-demo-${userEmail}`, form: parsed.data })
        );
      }

      toast.success("Profile updated successfully");
    } catch (e: any) {
      toast.error(e.message ?? "Could not save profile");
    } finally {
      setSaving(false);
    }
  };



  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 md:p-10">
      <h1 className="font-serif text-2xl md:text-3xl mb-1">My Profile</h1>
      <p className="text-sm text-muted-foreground mb-6">Update your details and connect your Google Calendar.</p>

      <div className="mb-6">
        <GoogleCalendarConnect staffId={staffId} />
      </div>

      {isAdmin && (
        <div className="mb-6">
          <SharedOwnerCalendarCard />
        </div>
      )}

      {!staffId && (
        <div className="mb-6 rounded-2xl border border-warning/30 bg-warning-soft dark:bg-warning-soft p-4 text-sm">
          <div className="font-medium mb-1">No staff profile linked to this account</div>
          <p className="text-muted-foreground">
            You're signed in as <span className="font-mono">{userEmail}</span>, but that email isn't on any
            staff profile yet. Ask an admin to either invite this email from <span className="font-medium">Staff → Team</span>, or
            update the email on your existing staff profile to match. Until then, saving here won't update your real profile.
          </p>
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div>
          <Label>Full name</Label>
          <Input className="mt-1.5" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <Label>Title</Label>
          <Input className="mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. RN Injector" />
        </div>
        <div>
          <Label>Email</Label>
          <Input className="mt-1.5" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <p className="text-[11px] text-muted-foreground mt-1">Changing this also updates your sign-in email. You'll get a confirmation link.</p>
        </div>
        <div>
          <Label>Phone</Label>
          <Input className="mt-1.5" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" />
        </div>
        <div>
          <Label>CA license # (NP/RN/MD)</Label>
          <Input className="mt-1.5" value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder="e.g., NP-F 12345 or 95021080" />
          <p className="text-[11px] text-muted-foreground mt-1">Auto-fills on GFE signatures.</p>
        </div>
        <Button onClick={save} disabled={saving} className="rounded-full">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save changes
        </Button>
      </div>

      {staffId && <SavedSignatureCard staffId={staffId} defaultName={form.full_name} />}


    </div>
  );
}
