import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchApptServiceNames, combinedServiceLabel } from "@/lib/apptServices";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import {
  Loader2, ArrowLeft, CalendarPlus, Mail, Phone, Cake, MapPin,
  CreditCard, FileCheck2, FileX2, AlertCircle, ExternalLink, UserPlus, Pencil,
  Ban, ShieldCheck, ShieldAlert, Trash2, Receipt, Download, Stethoscope,
  FilePlus, FileText, ChevronRight, ShoppingCart,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ClientCardsOnFile } from "@/components/ClientCardsOnFile";
import { ClientRewardsCard } from "@/components/staff/ClientRewardsCard";
import { ClientAvatar } from "@/components/ClientAvatar";
import { ClientIdDocuments } from "@/components/ClientIdDocuments";
import { ClientTreatmentPlansCard } from "@/components/staff/ClientTreatmentPlansCard";
import { ClientUploadedPhotosCard } from "@/components/staff/ClientUploadedPhotosCard";
import { InternalStaffNoteCard } from "@/components/clinical/InternalStaffNoteCard";
import { ClientPerksCard } from "@/components/staff/ClientPerksCard";
import { ClientExternalDisclosuresCard } from "@/components/staff/ClientExternalDisclosuresCard";
import { useAuth } from "@/hooks/useAuth";
import { parseLocalDate } from "@/lib/utils";


type Appt = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  service_id: string;
  staff_id: string;
  location_id: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string;
  client_dob: string | null;
  client_notes: string | null;
  stripe_payment_method_id: string | null;
  stripe_customer_id: string | null;
  no_show_charged_at: string | null;
};

const statusColor = (s: string) =>
  s === "approved" ? "bg-success-soft text-success-soft-foreground" :
  s === "completed" ? "bg-success-soft text-success-soft-foreground" :
  s === "pending" ? "bg-warning-soft text-warning-soft-foreground" :
  s === "denied" || s === "no_show" ? "bg-destructive-soft text-destructive-soft-foreground" :
  "bg-secondary text-muted-foreground";

const fmtMoney = (cents: number) =>
  cents === 0 ? "—" : `$${(cents / 100).toFixed(2)}`;

export default function StaffClientDetail() {
  const { email = "" } = useParams();
  const decodedEmail = decodeURIComponent(email).toLowerCase();
  const navigate = useNavigate();
  const { isNP, isAdmin } = useAuth();
  const [recentNote, setRecentNote] = useState<{ id: string; status: string; created_at: string; service_name: string | null; category: string | null } | null>(null);
  const [noteCount, setNoteCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [services, setServices] = useState<Record<string, { name: string; price_cents: number | null }>>({});
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [apsvMap, setApsvMap] = useState<Record<string, string[]>>({});
  const [profile, setProfile] = useState<any>(null);
  const [signed, setSigned] = useState<{ id: string; signed_at: string; signed_full_name: string; consent_form_id: string; appointment_id: string }[]>([]);
  const [forms, setForms] = useState<Record<string, string>>({});
  const [imported, setImported] = useState<any>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", email: "", phone: "", dob: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [blocked, setBlocked] = useState<{ reason: string | null } | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [receipts, setReceipts] = useState<{ id: string; paid_at: string | null; total_cents: number; payment_method: string | null; receipt_url: string | null; location_id: string }[]>([]);
  const [regenSaleId, setRegenSaleId] = useState<string | null>(null);
  const [gfe, setGfe] = useState<{ id: string; expires_at: string; signed_at: string } | null>(null);
  

  useEffect(() => {
    if (!decodedEmail) return;
    // HIPAA audit: record PHI read when opening a client chart
    void import("@/lib/phiAudit").then(({ logPhiAccess }) =>
      logPhiAccess({ resourceType: "client_profile", clientEmail: decodedEmail, action: "view" })
    );
    (async () => {
      setLoading(true);
      const [{ data: ap }, { data: prof }, { data: imp }] = await Promise.all([
        supabase.from("appointments").select("*").ilike("client_email", decodedEmail).order("start_at", { ascending: false }),
        supabase.from("client_profiles").select("*").ilike("email", decodedEmail).maybeSingle(),
        supabase.from("imported_clients").select("*").ilike("email", decodedEmail).maybeSingle(),
      ]);
      const list = (ap ?? []) as Appt[];
      setAppts(list);
      setProfile(prof);
      setImported(imp);

      const sids = [...new Set(list.map(a => a.service_id))];
      const stids = [...new Set(list.map(a => a.staff_id))];
      const lids = [...new Set(list.map(a => a.location_id))];
      const apids = list.map(a => a.id);

      const [{ data: sv }, { data: st }, { data: loc }, { data: sg }] = await Promise.all([
        sids.length ? supabase.from("services").select("id, name, price_cents").in("id", sids) : Promise.resolve({ data: [] as any[] }),
        stids.length ? supabase.from("staff_profiles").select("id, full_name").in("id", stids) : Promise.resolve({ data: [] as any[] }),
        lids.length ? supabase.from("locations").select("id, name").in("id", lids) : Promise.resolve({ data: [] as any[] }),
        apids.length ? supabase.from("consent_signatures").select("id, signed_at, signed_full_name, consent_form_id, appointment_id").in("appointment_id", apids).order("signed_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
      ]);

      setServices(Object.fromEntries((sv ?? []).map((s: any) => [s.id, { name: s.name, price_cents: s.price_cents }])));
      setStaff(Object.fromEntries((st ?? []).map((s: any) => [s.id, s.full_name])));
      setLocations(Object.fromEntries((loc ?? []).map((l: any) => [l.id, l.name])));
      setSigned(sg ?? []);
      setApsvMap(await fetchApptServiceNames(apids));

      const fids = [...new Set((sg ?? []).map((s: any) => s.consent_form_id))];
      if (fids.length) {
        const { data: ff } = await supabase.from("consent_forms").select("id, title").in("id", fids);
        setForms(Object.fromEntries((ff ?? []).map((f: any) => [f.id, f.title])));
      }

      const { data: salesData } = await supabase
        .from("sales")
        .select("id, paid_at, total_cents, refunded_amount_cents, payment_method, receipt_url, location_id")
        .ilike("client_email", decodedEmail)
        .in("status", ["paid", "partially_refunded", "refunded"])
        .order("paid_at", { ascending: false });
      setReceipts((salesData ?? []) as any);

      const { data: gfeData } = await supabase
        .from("gfe_records")
        .select("id, expires_at, signed_at")
        .ilike("client_email", decodedEmail)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setGfe(gfeData ?? null);

      const { data: noteRows, count: nc } = await supabase
        .from("clinical_notes")
        .select("id, status, created_at, service_name, category", { count: "exact" })
        .ilike("client_email", decodedEmail)
        .order("created_at", { ascending: false })
        .limit(1);
      setRecentNote(((noteRows ?? [])[0] as any) ?? null);
      setNoteCount(nc ?? 0);



      setLoading(false);
    })();
  }, [decodedEmail]);

  useEffect(() => {
    if (!decodedEmail) return;
    (async () => {
      const { data } = await supabase.from("blocked_clients").select("reason").eq("email", decodedEmail).maybeSingle();
      setBlocked(data ?? null);
    })();
  }, [decodedEmail]);

  const head = appts[0] ?? null;
  const display = head ?? imported ?? profile;

  const stats = useMemo(() => {
    const total = appts.length;
    const completed = appts.filter(a => ["completed", "approved"].includes(a.status) && new Date(a.start_at) < new Date()).length;
    const noShows = appts.filter(a => a.status === "no_show").length;
    const cancelled = appts.filter(a => a.status === "cancelled").length;
    const upcoming = appts.filter(a => new Date(a.start_at) >= new Date() && ["approved", "pending"].includes(a.status)).length;
    const ltv = (receipts ?? []).reduce((sum: number, r: any) => sum + ((r.total_cents ?? 0) - (r.refunded_amount_cents ?? 0)), 0);

    const firstSeen = appts.length ? appts[appts.length - 1].start_at : null;
    const cardOnFile = appts.some(a => !!a.stripe_payment_method_id);
    const lastVisit = appts.find(a => new Date(a.start_at) < new Date()) ?? null;
    return { total, completed, noShows, cancelled, upcoming, ltv, firstSeen, cardOnFile, lastVisit };
  }, [appts, services, receipts]);

  const upcomingAppts = appts.filter(a => new Date(a.start_at) >= new Date() && ["approved", "pending"].includes(a.status));
  const pastAppts = appts.filter(a => !(new Date(a.start_at) >= new Date() && ["approved", "pending"].includes(a.status)));

  const fullName = display
    ? `${display.client_first_name ?? display.first_name ?? ""} ${display.client_last_name ?? display.last_name ?? ""}`.trim() || decodedEmail
    : decodedEmail;
  const phone = display?.client_phone ?? display?.phone ?? null;
  const dob = display?.client_dob ?? display?.dob ?? null;

  const newApptUrl = () => {
    const p = new URLSearchParams();
    if (display?.client_first_name || display?.first_name) p.set("firstName", display.client_first_name ?? display.first_name);
    if (display?.client_last_name || display?.last_name) p.set("lastName", display.client_last_name ?? display.last_name);
    p.set("email", decodedEmail);
    if (phone) p.set("phone", phone);
    if (dob) p.set("dob", dob);
    return `/staff/appointments/new?${p.toString()}`;
  };

  const sendInvite = async () => {
    setSendingInvite(true);
    try {
      const { error } = await supabase.functions.invoke("staff-send-client-invite", {
        body: { recipientEmail: decodedEmail, clientName: display?.client_first_name ?? display?.first_name ?? "" },
      });
      if (error) throw error;
      toast.success(`Invite sent to ${decodedEmail}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send invite");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleBlock = async () => {
    const reason = await promptDialog({
      title: `Block ${fullName}?`,
      description: `${decodedEmail} will not be able to book.\n\nOptional reason (staff only):`,
      placeholder: "Reason (optional)",
      confirmLabel: "Block client",
    });
    if (reason === null) return;
    setBusyAction(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("blocked_clients").upsert(
        { email: decodedEmail, reason: reason || null, blocked_by: u.user?.id ?? null },
        { onConflict: "email" },
      );
      if (error) throw error;
      setBlocked({ reason: reason || null });
      toast.success(`Blocked ${decodedEmail}`);
    } catch (e: any) { toast.error(e.message ?? "Failed to block"); }
    finally { setBusyAction(false); }
  };

  const handleUnblock = async () => {
    if (!(await confirmDialog({ title: `Unblock ${decodedEmail}?`, description: "They will be able to book again.", confirmLabel: "Unblock" }))) return;
    setBusyAction(true);
    try {
      const { error } = await supabase.from("blocked_clients").delete().eq("email", decodedEmail);
      if (error) throw error;
      setBlocked(null);
      toast.success(`Unblocked ${decodedEmail}`);
    } catch (e: any) { toast.error(e.message ?? "Failed to unblock"); }
    finally { setBusyAction(false); }
  };
  const handleDelete = async () => {
    if (appts.length > 0) {
      toast.error("Can't delete: client has appointment history. Block them instead.");
      return;
    }
    if (!imported?.id) {
      toast.error("Nothing to delete for this client.");
      return;
    }
    if (!(await confirmDialog({
      title: `Delete ${fullName}?`,
      description: `Permanently remove ${decodedEmail} from your client list.\n\nThis cannot be undone.`,
      destructive: true,
      confirmLabel: "Delete client",
    }))) return;
    setBusyAction(true);
    try {
      const { error } = await supabase.from("imported_clients").delete().eq("id", imported.id);
      if (error) throw error;
      toast.success("Client deleted");
      navigate("/staff/clients");
    } catch (e: any) { toast.error(e.message ?? "Failed to delete"); }
    finally { setBusyAction(false); }
  };

  const openEdit = () => {
    setEditForm({
      first_name: display?.client_first_name ?? display?.first_name ?? "",
      last_name: display?.client_last_name ?? display?.last_name ?? "",
      email: decodedEmail,
      phone: phone ?? "",
      dob: dob ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const first = editForm.first_name.trim();
    const last = editForm.last_name.trim();
    const email = editForm.email.trim().toLowerCase();
    const phoneVal = editForm.phone.trim();
    const dobVal = editForm.dob.trim();
    if (!first || !last) { toast.error("First and last name are required"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error("Enter a valid email"); return; }
    setSavingEdit(true);
    try {
      // Update all appointments for this client
      if (appts.length) {
        const { error: aerr } = await supabase
          .from("appointments")
          .update({
            client_first_name: first,
            client_last_name: last,
            client_email: email,
            client_phone: phoneVal || null,
            client_dob: dobVal || null,
          })
          .in("id", appts.map(a => a.id));
        if (aerr) throw aerr;
      }
      if (profile?.id) {
        const { error: perr } = await supabase
          .from("client_profiles")
          .update({ first_name: first, last_name: last, email, phone: phoneVal || null, dob: dobVal || null })
          .eq("id", profile.id);
        if (perr) throw perr;
      }
      if (imported?.id) {
        const { error: ierr } = await supabase
          .from("imported_clients")
          .update({ first_name: first, last_name: last, email, phone: phoneVal || null, dob: dobVal || null })
          .eq("id", imported.id);
        if (ierr) throw ierr;
      }
      toast.success("Client updated");
      setEditOpen(false);
      if (email !== decodedEmail) {
        navigate(`/staff/clients/${encodeURIComponent(email)}`, { replace: true });
      } else {
        // refresh local state
        setAppts(prev => prev.map(a => ({ ...a, client_first_name: first, client_last_name: last, client_email: email, client_phone: phoneVal, client_dob: dobVal || null })));
        if (profile) setProfile({ ...profile, first_name: first, last_name: last, email, phone: phoneVal, dob: dobVal || null });
        if (imported) setImported({ ...imported, first_name: first, last_name: last, email, phone: phoneVal, dob: dobVal || null });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const initials = fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "—";

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Back
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4 min-w-0">
          <ClientAvatar
            clientEmail={decodedEmail}
            avatarPath={(imported as any)?.avatar_path ?? (profile as any)?.avatar_path ?? null}
            editable
            size={56}
            fallbackInitials={initials}
            onChange={(path) => {
              if (imported) setImported({ ...imported, avatar_path: path } as any);
              if (profile) setProfile({ ...profile, avatar_path: path } as any);
            }}
          />

          <div className="min-w-0">
            <h1 className="font-serif text-2xl sm:text-3xl truncate">{fullName}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
              <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{decodedEmail}</span>
              {phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>}
              {dob && <span className="inline-flex items-center gap-1"><Cake className="h-3 w-3" />{format(parseLocalDate(dob) ?? new Date(dob), "MMM d, yyyy")}</span>}
              {profile && <span className="inline-flex items-center gap-1 text-success-soft-foreground"><FileCheck2 className="h-3 w-3" />Account active</span>}
              {gfe && new Date(gfe.expires_at) > new Date() ? (
                <Link to={`/staff/clinical/gfe/${gfe.id}`} className="inline-flex items-center gap-1 text-success-soft-foreground hover:underline">
                  <Stethoscope className="h-3 w-3" />GFE active · expires {format(new Date(gfe.expires_at), "MMM d, yyyy")}
                </Link>
              ) : (
                <Link to={`/staff/clinical/clients/${encodeURIComponent(decodedEmail)}`} className="inline-flex items-center gap-1 text-warning-soft-foreground hover:underline">
                  <Stethoscope className="h-3 w-3" />{gfe ? "GFE expired — renew" : "GFE required (NP only)"}
                </Link>
              )}
              {profile?.is_lead && (
                <span className="inline-flex items-center gap-1 text-warning-soft-foreground" title={profile.lead_source ? `Source: ${profile.lead_source}` : undefined}>
                  <UserPlus className="h-3 w-3" />Lead{profile.lead_captured_at ? ` · captured ${format(new Date(profile.lead_captured_at), "MMM d, yyyy")}` : ""}
                </span>
              )}
              {blocked && <span className="inline-flex items-center gap-1 text-destructive-soft-foreground"><Ban className="h-3 w-3" />Blocked{blocked.reason ? ` — ${blocked.reason}` : ""}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link to={newApptUrl()}>
            <Button className="rounded-full gap-1.5"><CalendarPlus className="h-3.5 w-3.5" /> Book appointment</Button>
          </Link>
          <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={openEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit details
          </Button>
          {!profile && (
            <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={sendInvite} disabled={sendingInvite}>
              {sendingInvite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Invite to portal
            </Button>
          )}
          {profile?.is_lead && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5"
              onClick={async () => {
                setBusyAction(true);
                try {
                  const { error } = await supabase.from("client_profiles")
                    .update({ is_lead: false })
                    .eq("id", profile.id);
                  if (error) throw error;
                  setProfile({ ...profile, is_lead: false });
                  toast.success("Lead marked as converted");
                } catch (e: any) {
                  toast.error(e.message ?? "Could not mark converted");
                } finally { setBusyAction(false); }
              }}
              disabled={busyAction}
            >
              Mark converted
            </Button>
          )}
          {blocked ? (
            <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={handleUnblock} disabled={busyAction}>
              <ShieldCheck className="h-3.5 w-3.5" /> Unblock
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-destructive-soft-foreground hover:text-destructive-soft-foreground" onClick={handleBlock} disabled={busyAction}>
              <Ban className="h-3.5 w-3.5" /> Block
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 text-destructive-soft-foreground hover:text-destructive-soft-foreground disabled:opacity-50"
            onClick={handleDelete}
            disabled={busyAction || appts.length > 0 || !imported?.id}
            title={appts.length > 0 ? "Has appointment history — block instead" : !imported?.id ? "Nothing to delete" : "Delete client"}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Lifetime value" value={fmtMoney(stats.ltv)} hint={`${stats.completed} visits`} />
        <StatCard label="Upcoming" value={String(stats.upcoming)} hint={stats.upcoming ? "appointments" : "none scheduled"} />
        <StatCard label="No-shows" value={String(stats.noShows)} tone={stats.noShows > 0 ? "warn" : "default"} />
        <StatCard
          label="Card on file"
          value={stats.cardOnFile ? "Yes" : "No"}
          tone={stats.cardOnFile ? "good" : "default"}
          icon={<CreditCard className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Alerts */}
      {(stats.noShows > 0 || !stats.cardOnFile) && (
        <div className="space-y-2 mb-6">
          {stats.noShows > 0 && (
            <Alert tone="warn" icon={<AlertCircle className="h-4 w-4" />}>
              {stats.noShows} prior no-show{stats.noShows > 1 ? "s" : ""}. Confirm card on file before booking.
            </Alert>
          )}
          {!stats.cardOnFile && stats.total > 0 && (
            <Alert tone="warn" icon={<CreditCard className="h-4 w-4" />}>
              No card on file. They will need to add one at next booking.
            </Alert>
          )}
        </div>
      )}

      <ClientPerksCard clientEmail={decodedEmail} />

      {profile?.id && (
        <InternalStaffNoteCard
          profileId={profile.id}
          initialNote={profile.internal_staff_note}
          updatedAt={profile.internal_note_updated_at}
          onSaved={(note, at) => setProfile({ ...profile, internal_staff_note: note, internal_note_updated_at: at })}
        />
      )}


      {/* Chart panel — primary entry point for clinical documentation */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground inline-flex items-center gap-1.5">
            <Stethoscope className="h-3 w-3" /> Clinical chart
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-full gap-1.5">
            <Link to={`/staff/clinical/clients/${encodeURIComponent(decodedEmail)}`}>
              Open chart{noteCount > 0 ? ` · ${noteCount} note${noteCount === 1 ? "" : "s"}` : ""} <ChevronRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        {/* GFE status line in plain English */}
        <div className="flex items-start gap-2 text-sm mb-4">
          {gfe && new Date(gfe.expires_at) > new Date() ? (
            <>
              <ShieldCheck className="h-4 w-4 text-success-soft-foreground mt-0.5 shrink-0" />
              <span className="text-muted-foreground">
                GFE on file · valid for {differenceInDays(new Date(gfe.expires_at), new Date())} more day{differenceInDays(new Date(gfe.expires_at), new Date()) === 1 ? "" : "s"}
                {" — "}
                <Link to={`/staff/clinical/gfe/${gfe.id}`} className="text-foreground underline-offset-2 hover:underline">view</Link>
              </span>
            </>
          ) : gfe ? (
            <>
              <ShieldAlert className="h-4 w-4 text-warning-soft-foreground mt-0.5 shrink-0" />
              <span className="text-warning-soft-foreground">GFE expired {formatDistanceToNow(new Date(gfe.expires_at))} ago. {isNP || isAdmin ? "Renew before next procedure." : "An NP must renew before next procedure."}</span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-4 w-4 text-warning-soft-foreground mt-0.5 shrink-0" />
              <span className="text-warning-soft-foreground">No GFE on file. {isNP || isAdmin ? "Required before any injectable procedure." : "An NP must conduct one before any procedure."}</span>
            </>
          )}
        </div>

        {/* Most recent chart note (if any) */}
        {recentNote && (
          <Link to={`/staff/clinical/notes/${recentNote.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 mb-4 hover:bg-secondary/40 transition">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">Last note: {recentNote.service_name ?? recentNote.category ?? "Chart note"}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(recentNote.created_at), "MMM d, yyyy")} · <span className="capitalize">{recentNote.status}</span></div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        )}

        {/* Primary action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-full gap-1.5"
            onClick={() => {
              const f = display?.client_first_name ?? display?.first_name ?? "";
              const l = display?.client_last_name ?? display?.last_name ?? "";
              const p = display?.client_phone ?? display?.phone ?? "";
              const loc = appts[0]?.location_id ?? "";
              const qs = new URLSearchParams({
                first: f, last: l, email: decodedEmail,
                ...(p ? { phone: p } : {}),
                ...(loc ? { locationId: loc } : {}),
              }).toString();
              navigate(`/staff/checkout?${qs}`);
            }}
          >
            <ShoppingCart className="h-4 w-4" /> New sale
          </Button>
          <Button
            variant="outline"
            className="rounded-full gap-1.5"
            onClick={() => navigate(`/staff/clinical/notes/new?email=${encodeURIComponent(decodedEmail)}&first=${encodeURIComponent(display?.client_first_name ?? display?.first_name ?? "")}&last=${encodeURIComponent(display?.client_last_name ?? display?.last_name ?? "")}`)}
          >
            <FilePlus className="h-4 w-4" /> New chart note
          </Button>
          {(isNP || isAdmin) && (!gfe || new Date(gfe.expires_at) <= new Date()) && (
            <Button
              variant="outline"
              className="rounded-full gap-1.5"
              onClick={() => navigate(`/staff/clinical/gfe/new?email=${encodeURIComponent(decodedEmail)}&first=${encodeURIComponent(display?.client_first_name ?? display?.first_name ?? "")}&last=${encodeURIComponent(display?.client_last_name ?? display?.last_name ?? "")}`)}
            >
              <ShieldCheck className="h-4 w-4" /> Conduct GFE
            </Button>
          )}
          {(isNP || isAdmin) && (
            <Button
              variant="outline"
              className="rounded-full gap-1.5"
              onClick={() => {
                const f = display?.client_first_name ?? display?.first_name ?? "";
                const l = display?.client_last_name ?? display?.last_name ?? "";
                const d = display?.client_dob ?? display?.dob ?? "";
                navigate(`/staff/clinical/encounters/new?email=${encodeURIComponent(decodedEmail)}&first=${encodeURIComponent(f)}&last=${encodeURIComponent(l)}&dob=${encodeURIComponent(d ?? "")}`);
              }}
            >
              <FileText className="h-4 w-4" /> Start protocol visit
            </Button>
          )}
        </div>
      </div>




      <div className="mb-6">
        <ClientIdDocuments email={decodedEmail} />
      </div>

      <div className="mb-6">
        <ClientCardsOnFile
          email={decodedEmail}
          defaultName={fullName}
          defaultPhone={phone ?? ""}
        />
      </div>

      <div className="mb-6">
        <ClientRewardsCard clientEmail={decodedEmail} />
      </div>

      <div className="mb-6">
        <ClientTreatmentPlansCard clientEmail={decodedEmail} />
      </div>

      <div className="mb-6">
        <ClientUploadedPhotosCard clientEmail={decodedEmail} />
      </div>




      <Tabs defaultValue="history">
        <TabsList className="rounded-full">
          <TabsTrigger value="history" className="rounded-full">History ({stats.total})</TabsTrigger>
          <TabsTrigger value="consents" className="rounded-full">Consents ({signed.length})</TabsTrigger>
          <TabsTrigger value="billing" className="rounded-full">Billing ({receipts.length})</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-full">Notes</TabsTrigger>
          <TabsTrigger value="disclosures" className="rounded-full">HIPAA Disclosures</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4 space-y-4">
          {upcomingAppts.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Upcoming</h3>
              <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                {upcomingAppts.map(a => (
                  <ApptRow key={a.id} a={a} services={services} staff={staff} locations={locations} apsvMap={apsvMap} />
                ))}
              </div>
            </div>
          )}
          {pastAppts.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Past</h3>
              <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                {pastAppts.map(a => (
                  <ApptRow key={a.id} a={a} services={services} staff={staff} locations={locations} apsvMap={apsvMap} />
                ))}
              </div>
            </div>
          )}
          {appts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No appointments yet. Use "Book appointment" above to schedule one.
            </div>
          )}
        </TabsContent>

        <TabsContent value="consents" className="mt-4">
          {signed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
              <FileX2 className="h-4 w-4" /> No signed consents on file.
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
              {signed.map(s => (
                <Link key={s.id} to={`/staff/appointments/${s.appointment_id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/30 transition">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{forms[s.consent_form_id] ?? "Consent"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Signed by {s.signed_full_name} · {format(new Date(s.signed_at), "MMM d, yyyy h:mm a")}
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="billing" className="mt-4 space-y-6">
          <CreditsPanel clientEmail={decodedEmail} />
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Receipts</h3>
            {receipts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
                <Receipt className="h-4 w-4" /> No paid receipts yet.
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
                {receipts.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">
                        {fmtMoney(r.total_cents)}
                        <span className="ml-2 text-xs text-muted-foreground uppercase tracking-wider">
                          {r.payment_method ?? "—"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {r.paid_at ? format(new Date(r.paid_at), "MMM d, yyyy h:mm a") : "—"}
                        {locations[r.location_id] ? ` · ${locations[r.location_id]}` : ""}
                        <span className="ml-2 font-mono">#{r.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                    {r.receipt_url ? (
                      <a
                        href={r.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary/40 transition"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </a>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={regenSaleId === r.id}
                        onClick={async () => {
                          setRegenSaleId(r.id);
                          try {
                            const { data, error } = await supabase.functions.invoke(
                              "generate-sale-receipt-pdf",
                              { body: { saleId: r.id } },
                            );
                            if (error) throw error;
                            if (data?.url) {
                              setReceipts(prev => prev.map(x => x.id === r.id ? { ...x, receipt_url: data.url } : x));
                              toast.success("Receipt PDF generated");
                            }
                          } catch (e: any) {
                            toast.error(e?.message ?? "Failed to generate PDF");
                          } finally {
                            setRegenSaleId(null);
                          }
                        }}
                      >
                        {regenSaleId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Generate PDF"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>



        <TabsContent value="notes" className="mt-4 space-y-3">
          {head?.client_notes ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Latest booking notes</div>
              <p className="text-sm whitespace-pre-wrap">{head.client_notes}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No notes from client.
            </div>
          )}
          {imported?.notes && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Import notes</div>
              <p className="text-sm whitespace-pre-wrap">{imported.notes}</p>
            </div>
          )}
          {stats.firstSeen && (
            <div className="text-xs text-muted-foreground">
              First seen: {format(new Date(stats.firstSeen), "MMM d, yyyy")}
            </div>
          )}
        </TabsContent>

        <TabsContent value="disclosures" className="mt-4 space-y-4">
          <ClientExternalDisclosuresCard clientEmail={decodedEmail} />
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit client details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First name</Label>
                <Input className="mt-1.5" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input className="mt-1.5" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input className="mt-1.5" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              <p className="text-[11px] text-muted-foreground mt-1">Note: this updates the client record everywhere but does not change their sign-in email if they have a portal account.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input className="mt-1.5" type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div>
                <Label>Date of birth</Label>
                <Input className="mt-1.5" type="date" value={editForm.dob} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const StatCard = ({ label, value, hint, tone = "default", icon }: {
  label: string; value: string; hint?: string;
  tone?: "default" | "good" | "warn"; icon?: React.ReactNode;
}) => {
  const toneCls =
    tone === "good" ? "text-success-soft-foreground" :
    tone === "warn" ? "text-warning-soft-foreground" : "";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
        {icon}{label}
      </div>
      <div className={`font-serif text-2xl mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
};

const Alert = ({ children, tone, icon }: { children: React.ReactNode; tone: "warn"; icon: React.ReactNode }) => (
  <div className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${
    tone === "warn" ? "bg-warning-soft border-warning/30 text-warning-soft-foreground" : ""
  }`}>
    <span className="mt-0.5">{icon}</span>
    <div>{children}</div>
  </div>
);

const ApptRow = ({ a, services, staff, locations, apsvMap }: {
  a: Appt;
  services: Record<string, { name: string; price_cents: number | null }>;
  staff: Record<string, string>;
  locations: Record<string, string>;
  apsvMap: Record<string, string[]>;
}) => (
  <Link to={`/staff/appointments/${a.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/30 transition">
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-sm truncate">{combinedServiceLabel(a.id, apsvMap, services[a.service_id]?.name ?? "Service")}</span>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor(a.status)}`}>
          {a.status.replace("_", " ")}
        </span>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>{format(new Date(a.start_at), "EEE, MMM d, yyyy · h:mm a")}</span>
        {staff[a.staff_id] && <span>with {staff[a.staff_id]}</span>}
        {locations[a.location_id] && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{locations[a.location_id]}</span>}
      </div>
    </div>
    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  </Link>
);

type ServiceOpt = { id: string; name: string; price_cents: number; price_note: string | null };

function CreditsPanel({ clientEmail }: { clientEmail: string }) {
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<{ id: string; amount_cents: number; reason: string; note: string | null; created_at: string; kind?: string; service_label?: string | null; units?: number | null; redeemed_at?: string | null }[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"dollar" | "service_free" | "service_value">("dollar");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Referral thank-you");
  const [note, setNote] = useState("");
  const [serviceId, setServiceId] = useState<string>("");
  const [units, setUnits] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [{ data: bal }, { data: hist }, { data: svc }] = await Promise.all([
      supabase.from("client_credit_balances" as any).select("balance_cents").eq("client_email", clientEmail).maybeSingle(),
      supabase.from("client_credits").select("id, amount_cents, reason, note, created_at, kind, service_label, units, redeemed_at").ilike("client_email", clientEmail).order("created_at", { ascending: false }),
      supabase.from("services").select("id, name, price_cents, price_note").eq("is_active", true).order("name"),
    ]);
    setBalance((bal as any)?.balance_cents ?? 0);
    setHistory((hist as any) ?? []);
    setServices(((svc as any) ?? []).filter((s: ServiceOpt) => !!s));
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientEmail]);

  const selectedService = services.find(s => s.id === serviceId);
  const computedServiceValueCents = (() => {
    if (!selectedService) return 0;
    const u = Number(units);
    if (Number.isFinite(u) && u > 0) return Math.round(u * selectedService.price_cents);
    return selectedService.price_cents;
  })();
  const computedLabel = selectedService
    ? (units && Number(units) > 0 ? `${units} units ${selectedService.name}` : `Free ${selectedService.name}`)
    : "";

  const submit = async () => {
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    let payload: any = {
      client_email: clientEmail,
      reason: reason.trim(),
      note: note.trim() || null,
      issued_by: session?.user?.id ?? null,
      kind,
    };
    if (kind === "dollar") {
      const n = Number(amount);
      if (!Number.isFinite(n) || n === 0) { toast.error("Enter a non-zero dollar amount"); return; }
      payload.amount_cents = Math.round(n * 100);
    } else {
      if (!selectedService) { toast.error("Pick a service"); return; }
      payload.service_id = selectedService.id;
      payload.service_label = computedLabel;
      payload.units = units && Number(units) > 0 ? Math.round(Number(units)) : null;
      payload.amount_cents = computedServiceValueCents;
    }
    setSaving(true);
    const { error } = await supabase.from("client_credits").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Credit issued");
    setOpen(false); setAmount(""); setNote(""); setReason("Referral thank-you");
    setKind("dollar"); setServiceId(""); setUnits("");
    refresh();
  };

  const renderHistoryAmount = (c: typeof history[number]) => {
    if (c.kind && c.kind !== "dollar") {
      return (
        <span className={`text-sm shrink-0 ${c.redeemed_at ? "text-muted-foreground line-through" : "text-success-soft-foreground font-medium"}`}>
          {c.service_label || "Service credit"}
        </span>
      );
    }
    return (
      <span className={`font-mono text-sm shrink-0 ${c.amount_cents >= 0 ? "text-success-soft-foreground" : "text-warning-soft-foreground"}`}>
        {c.amount_cents >= 0 ? "+" : "−"}${(Math.abs(c.amount_cents) / 100).toFixed(2)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Account balance</div>
          <div className={`font-serif text-2xl mt-1 ${balance > 0 ? "text-success-soft-foreground" : balance < 0 ? "text-warning-soft-foreground" : ""}`}>
            ${(balance / 100).toFixed(2)}
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full">Issue credit</Button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
      ) : history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No credit activity yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {history.map(c => (
            <div key={c.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {c.reason}
                  {c.kind && c.kind !== "dollar" && (
                    <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {c.redeemed_at ? "Redeemed" : "Service credit · available"}
                    </span>
                  )}
                </div>
                {c.note && <div className="text-xs text-muted-foreground mt-0.5">{c.note}</div>}
                <div className="text-[11px] text-muted-foreground font-mono mt-1">{format(new Date(c.created_at), "MMM d, yyyy h:mm a")}</div>
              </div>
              {renderHistoryAmount(c)}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-background rounded-2xl border border-border p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-xl">Issue account credit</h3>

            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "dollar", label: "Dollar" },
                { v: "service_free", label: "Free service" },
                { v: "service_value", label: "Service $ value" },
              ] as const).map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setKind(o.v)}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    kind === o.v ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {kind === "dollar" ? (
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (USD)</label>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="25.00 (use negative to debit)"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" autoFocus />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Service</label>
                  <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Pick a service…</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — ${(s.price_cents / 100).toFixed(0)}{s.price_note ? ` ${s.price_note}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Units (optional)</label>
                  <input type="number" min="0" step="1" value={units} onChange={(e) => setUnits(e.target.value)}
                    placeholder="e.g. 40 for 40 units of Neurotoxin"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </div>
                {selectedService && (
                  <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                    <div><span className="text-muted-foreground">Label:</span> <span className="font-medium">{computedLabel}</span></div>
                    <div><span className="text-muted-foreground">Estimated value:</span> <span className="font-mono">${(computedServiceValueCents / 100).toFixed(2)}</span></div>
                    <div className="text-muted-foreground italic">
                      {kind === "service_free"
                        ? "At checkout: fully zeroes out the matching service line (up to this value)."
                        : "At checkout: applies this fixed dollar amount as a discount."}
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Reason</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option>Referral thank-you</option>
                <option>Google review reward</option>
                <option>Service goodwill</option>
                <option>Promotion</option>
                <option>Refund</option>
                <option>Adjustment</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Note (optional)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                Issue credit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

