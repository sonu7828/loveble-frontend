import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { loadStaffMessageTemplates, upsertStaffMessageTemplate, type StaffMessageType } from "@/lib/staffMessageTemplates";
import { SavedSignatureCard } from "@/components/staff/SavedSignatureCard";

const schema = z.object({
  full_name: z.string().trim().min(1, "Name required").max(120),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  license_number: z.string().trim().max(60).optional().or(z.literal("")),
});

const DEFAULT_CHECKIN_TEMPLATE =
  "Hi {{clientFirstName}}, it's {{providerFirstName}}. Just checking in on you! Hope you're healing and resting well. Let me know if you have any questions or concerns!";
const DEFAULT_REVIEW_TEMPLATE =
  "Hi {{clientFirstName}}, it's {{providerFirstName}} at Radiantilyk. It was so lovely seeing you! Mind sharing a quick rating? {{feedbackUrl}}";
const DEFAULT_PHOTO_TEMPLATE =
  "Hi {{clientFirstName}}, it's {{providerFirstName}} at Radiantilyk. We'd love to see how you're healing — tap to upload a quick photo for your chart: {{uploadUrl}}";
const DEFAULT_REBOOK_TEMPLATE =
  "Hi {{clientFirstName}}, it's {{providerFirstName}}. You're due for your next visit! Whenever you're ready, you can book here: https://bookrka.com";

export default function StaffMyProfile() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", title: "", email: "", phone: "", license_number: "" });

  // Post-visit check-in SMS settings
  const [checkinEnabled, setCheckinEnabled] = useState(true);
  const [checkinTemplate, setCheckinTemplate] = useState<string>(DEFAULT_CHECKIN_TEMPLATE);
  const [savingCheckin, setSavingCheckin] = useState(false);

  // Review request settings
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [reviewTemplate, setReviewTemplate] = useState<string>(DEFAULT_REVIEW_TEMPLATE);
  const [reviewDelayHours, setReviewDelayHours] = useState<number>(72);
  const [savingReview, setSavingReview] = useState(false);

  // Rebook reminder settings
  const [rebookEnabled, setRebookEnabled] = useState(false);
  const [rebookTemplate, setRebookTemplate] = useState<string>(DEFAULT_REBOOK_TEMPLATE);
  const [rebookWeeks, setRebookWeeks] = useState<number>(4);
  const [savingRebook, setSavingRebook] = useState(false);

  // Photo upload request settings
  const [photoEnabled, setPhotoEnabled] = useState(false);
  const [photoTemplate, setPhotoTemplate] = useState<string>(DEFAULT_PHOTO_TEMPLATE);
  const [photoDays, setPhotoDays] = useState<number>(14);
  const [savingPhoto, setSavingPhoto] = useState(false);

  useEffect(() => {
    (async () => {
      let myEmail = "";
      let myUserId = "";
      let metadataName = "";

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          myEmail = (user.email ?? "").toLowerCase();
          myUserId = user.id;
          metadataName = user.user_metadata?.first_name || user.user_metadata?.last_name
            ? `${user.user_metadata?.first_name || ""} ${user.user_metadata?.last_name || ""}`.trim()
            : "";
        }
      } catch (e) {}

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
        const { data } = await supabase
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
        const { data: byEmail } = await supabase
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
            await supabase
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

        try {
          const tpls = await loadStaffMessageTemplates(s.id);
          const ci = tpls.get("checkin");
          if (ci) {
            setCheckinEnabled(ci.enabled);
            setCheckinTemplate(ci.template || DEFAULT_CHECKIN_TEMPLATE);
          }
          const rv = tpls.get("review");
          if (rv) {
            setReviewEnabled(rv.enabled);
            setReviewTemplate(rv.template || DEFAULT_REVIEW_TEMPLATE);
            setReviewDelayHours(rv.delay_minutes != null ? Math.round(rv.delay_minutes / 60) : 72);
          }
          const rb = tpls.get("rebook");
          if (rb) {
            setRebookEnabled(rb.enabled);
            setRebookTemplate(rb.template || DEFAULT_REBOOK_TEMPLATE);
            setRebookWeeks(rb.delay_minutes != null ? Math.max(1, Math.round(rb.delay_minutes / (60 * 24 * 7))) : 4);
          }
          const ph = tpls.get("photo");
          if (ph) {
            setPhotoEnabled(ph.enabled);
            setPhotoTemplate(ph.template || DEFAULT_PHOTO_TEMPLATE);
            setPhotoDays(ph.delay_minutes != null ? Math.max(1, Math.round(ph.delay_minutes / (60 * 24))) : 14);
          }
        } catch {}
      } else {
        // Fallback default values for logged in staff without DB row
        const isOfficer = myEmail === "officer@gmail.com";
        const isAdminEmail = myEmail === "admin@gmail.com";
        const defaultName = metadataName || (isOfficer ? "Dr. Kiem (Privacy & Security Officer)" : isAdminEmail ? "Dr. Kiem" : "Staff Provider");
        const defaultTitle = isOfficer ? "Privacy & Security Officer" : isAdminEmail ? "Medical Director & Admin" : "Nurse Practitioner";

        const fallbackForm = {
          full_name: defaultName,
          title: defaultTitle,
          email: myEmail,
          phone: "(555) 234-5678",
          license_number: "NP-95021080",
        };
        const fallbackId = `staff-demo-${myEmail.replace(/[^a-z0-9]/gi, "-")}`;
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
        const { error } = await supabase
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

  const saveTemplate = async (
    type: StaffMessageType,
    enabled: boolean,
    template: string,
    delayMinutes: number | null,
    label: string,
    setBusy: (b: boolean) => void,
  ) => {
    if (!staffId) return;
    const tpl = template.trim();
    if (tpl.length === 0 || tpl.length > 320) {
      toast.error("Message must be 1–320 characters");
      return;
    }
    setBusy(true);
    try {
      await upsertStaffMessageTemplate({
        staff_id: staffId,
        message_type: type,
        enabled,
        template: tpl,
        delay_minutes: delayMinutes,
        config: {},
      });
      toast.success(`${label} saved`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const saveCheckin = () =>
    saveTemplate("checkin", checkinEnabled, checkinTemplate, null, "Check-in text settings", setSavingCheckin);

  const saveReview = () => {
    const hrs = Math.max(1, Math.min(336, Math.floor(reviewDelayHours || 72)));
    return saveTemplate("review", reviewEnabled, reviewTemplate, hrs * 60, "Review request settings", setSavingReview);
  };

  const saveRebook = () => {
    const wks = Math.max(1, Math.min(52, Math.floor(rebookWeeks || 4)));
    return saveTemplate("rebook", rebookEnabled, rebookTemplate, wks * 7 * 24 * 60, "Rebook reminder settings", setSavingRebook);
  };

  const savePhoto = () => {
    const days = Math.max(1, Math.min(60, Math.floor(photoDays || 14)));
    return saveTemplate("photo", photoEnabled, photoTemplate, days * 24 * 60, "Photo request settings", setSavingPhoto);
  };


  const previewFirstName = (form.full_name || "Kiem").trim().split(/\s+/)[0];
  const fillPreview = (tpl: string) => tpl
    .replace(/\{\{clientFirstName\}\}/g, "Sarah")
    .replace(/\{\{providerFirstName\}\}/g, previewFirstName)
    .replace(/\{\{reviewUrl\}\}/g, "https://g.page/r/...")
    .replace(/\{\{feedbackUrl\}\}/g, "https://bookrka.com/feedback/abc123")
    .replace(/\{\{uploadUrl\}\}/g, "https://bookrka.com/photos/abc123");
  const preview = fillPreview(checkinTemplate);
  const reviewPreview = fillPreview(reviewTemplate);
  const rebookPreview = fillPreview(rebookTemplate);
  const photoPreview = fillPreview(photoTemplate);

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



      {staffId && (
        <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="font-serif text-lg">Automatic post-visit check-in text</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Send a personable text from you to every client after their appointment. Only sent to clients who opted in to SMS.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Enable auto check-in</div>
              <div className="text-xs text-muted-foreground">Turn off to stop sending check-ins from your account.</div>
            </div>
            <Switch checked={checkinEnabled} onCheckedChange={setCheckinEnabled} />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea
              className="mt-1.5"
              rows={4}
              maxLength={320}
              value={checkinTemplate}
              onChange={(e) => setCheckinTemplate(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use <code>{"{{clientFirstName}}"}</code> and <code>{"{{providerFirstName}}"}</code>. STOP footer is added automatically.
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Preview</div>
            <div className="text-sm whitespace-pre-wrap">{preview}</div>
          </div>

          <Button onClick={saveCheckin} disabled={savingCheckin} className="rounded-full">
            {savingCheckin && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save check-in settings
          </Button>
        </div>
      )}

      {staffId && (
        <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="font-serif text-lg">Google review request</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A few days after a visit, ask opted-in clients to rate. 5-star ratings auto-redirect to Google; lower ratings stay private so you can reach out.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Enable review request</div>
              <div className="text-xs text-muted-foreground">One time per appointment.</div>
            </div>
            <Switch checked={reviewEnabled} onCheckedChange={setReviewEnabled} />
          </div>
          <div>
            <Label>Send after (hours)</Label>
            <Input className="mt-1.5" type="number" min={1} max={336}
              value={reviewDelayHours}
              onChange={(e) => setReviewDelayHours(Number(e.target.value))} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea className="mt-1.5" rows={4} maxLength={320}
              value={reviewTemplate}
              onChange={(e) => setReviewTemplate(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use <code>{"{{clientFirstName}}"}</code>, <code>{"{{providerFirstName}}"}</code>, <code>{"{{feedbackUrl}}"}</code> (recommended — routes 5★ to Google, lower ratings stay private) or <code>{"{{reviewUrl}}"}</code> for the direct Google link.
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Preview</div>
            <div className="text-sm whitespace-pre-wrap">{reviewPreview}</div>
          </div>
          <Button onClick={saveReview} disabled={savingReview} className="rounded-full">
            {savingReview && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save review settings
          </Button>
        </div>
      )}

      {staffId && (
        <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="font-serif text-lg">Rebook reminder</h2>
            <p className="text-sm text-muted-foreground mt-1">
              When a client is due for their next visit, send a friendly nudge. Skipped automatically if they've already rebooked.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Enable rebook reminder</div>
              <div className="text-xs text-muted-foreground">One time per completed appointment.</div>
            </div>
            <Switch checked={rebookEnabled} onCheckedChange={setRebookEnabled} />
          </div>
          <div>
            <Label>Send after (weeks)</Label>
            <Input className="mt-1.5" type="number" min={1} max={52}
              value={rebookWeeks}
              onChange={(e) => setRebookWeeks(Number(e.target.value))} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea className="mt-1.5" rows={4} maxLength={320}
              value={rebookTemplate}
              onChange={(e) => setRebookTemplate(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use <code>{"{{clientFirstName}}"}</code> and <code>{"{{providerFirstName}}"}</code>.
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Preview</div>
            <div className="text-sm whitespace-pre-wrap">{rebookPreview}</div>
          </div>
          <Button onClick={saveRebook} disabled={savingRebook} className="rounded-full">
            {savingRebook && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save rebook settings
          </Button>
        </div>
      )}

      {staffId && (
        <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="font-serif text-lg">Photo upload request</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A couple weeks after a visit, invite opted-in clients to upload a healing/result photo straight to their chart.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Enable photo request</div>
              <div className="text-xs text-muted-foreground">One time per appointment.</div>
            </div>
            <Switch checked={photoEnabled} onCheckedChange={setPhotoEnabled} />
          </div>
          <div>
            <Label>Send after (days)</Label>
            <Input className="mt-1.5" type="number" min={1} max={60}
              value={photoDays}
              onChange={(e) => setPhotoDays(Number(e.target.value))} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea className="mt-1.5" rows={4} maxLength={320}
              value={photoTemplate}
              onChange={(e) => setPhotoTemplate(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use <code>{"{{clientFirstName}}"}</code>, <code>{"{{providerFirstName}}"}</code>, <code>{"{{uploadUrl}}"}</code>.
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Preview</div>
            <div className="text-sm whitespace-pre-wrap">{photoPreview}</div>
          </div>
          <Button onClick={savePhoto} disabled={savingPhoto} className="rounded-full">
            {savingPhoto && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save photo settings
          </Button>
        </div>
      )}
    </div>
  );
}
