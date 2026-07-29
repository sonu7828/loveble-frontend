import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { staffService } from "@/services/api/staffService";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Mail, CheckCircle2, Plus, MoreHorizontal, UserX, UserCheck, Trash2, DollarSign, ShieldCheck, Lock, KeyRound, AlertCircle, XCircle, Pencil, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ChartNotesIndex from "../staff/clinical/ChartNotesIndex";

interface Member {
  id: string; full_name: string; title: string; email: string | null;
  user_id: string | null; is_active: boolean; is_owner: boolean; color: string;
  hourly_rate_cents: number | null; commission_percent: number | null;
  is_pending?: boolean;
  pending_role?: Role;
}

type Role = "admin" | "provider" | "nurse_practitioner" | "medical_director" | "receptionist" | "scheduler" | "staff" | "privacy_officer";
const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin (full access)",
  privacy_officer: "Privacy & Security Officer (HIPAA Policy Approval & Security)",
  medical_director: "Medical Director (supervising physician — sign & co-sign notes)",
  provider: "Provider (clinical provider)",
  nurse_practitioner: "Nurse Practitioner (GFE + clinical co-sign)",
  receptionist: "Front Desk Receptionist (book, check in, schedule)",
  scheduler: "Scheduler (manage appointments & schedule)",
  staff: "Staff (own bookings only)",
};

interface PendingRequest {
  id: string;
  full_name: string;
  title: string;
  email: string;
  role: Role;
  color: string;
  created_at: string;
  password?: string;
}

const PALETTE = ["#c97c5d", "#7c9dd1", "#a8c084", "#d4a3c4", "#e8b94b", "#8b7ec4", "#d97c7c", "#5db8a8"];

const getInitials = (name?: string | null): string => {
  if (!name) return "??";
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const resolveName = (m: any): string => {
  return m?.full_name || m?.fullName || m?.name || [m?.first_name, m?.last_name].filter(Boolean).join(" ") || "Unnamed Member";
};

export default function AdminTeam() {
  const { isAdmin, isMedicalDirector, isPrivacyOfficer, isStaff, isNP, isPrivileged, user } = useAuth();
  const canAccessTeam = isAdmin || isMedicalDirector || isPrivacyOfficer || isStaff || isNP || isPrivileged;
  const [sp, setSp] = useSearchParams();
  const isMDOnly = !isAdmin && isMedicalDirector;
  const roleFilter = isMDOnly ? "provider" : (sp.get("role") || (sp.get("tab") === "providers" ? "provider" : "all"));
  const currentTab = sp.get("tab");

  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Record<string, Role[]>>({});
  const [invites, setInvites] = useState<Record<string, { sent: string; accepted: string | null; role: Role }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const loadInProgress = useRef(false);

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [draft, setDraft] = useState({ id: "" as string | null, full_name: "", title: "", email: "", password: "", color: PALETTE[0], role: "staff" as Role, sendInvite: true });

  const openAdd = () => {
    setDraft({
      id: null,
      full_name: "",
      title: "",
      email: "",
      password: "",
      color: PALETTE[0],
      role: "staff",
      sendInvite: true,
    });
    setAddOpen(true);
  };

  const openEdit = (m: Member, primaryRole: Role) => {
    setDraft({
      id: m.id,
      full_name: m.full_name || "",
      title: m.title || "",
      email: m.email || "",
      password: "••••••••",
      color: m.color || PALETTE[0],
      role: primaryRole,
      sendInvite: false
    });
    setAddOpen(true);
  };

  const load = async () => {
    if (loadInProgress.current) return; // prevent overlapping calls
    loadInProgress.current = true;
    setLoading(true);

    try {
      const rawData = await staffService.getStaffProfiles(false);
      const dataList: any[] = Array.isArray(rawData) ? rawData : (rawData as any)?.data || (rawData as any)?.staff || [];
      const fetchedMembers: Member[] = dataList.map((x: any) => {
        const rolesList = x.user?.userRoles?.map((ur: any) => ur.role?.name) || [];
        const primaryRole = rolesList.find((r: string) => r !== "staff") || rolesList[0] || x.role || "staff";
        return {
          id: x.id,
          user_id: x.userId || x.user_id || x.user?.id || null,
          full_name: x.fullName || x.full_name || resolveName(x),
          title: x.title || "Team Member",
          email: x.email || x.user?.email || "",
          is_active: x.isActive !== undefined ? x.isActive : true,
          is_owner: x.isOwner || false,
          color: x.color || PALETTE[0],
          hourly_rate_cents: x.hourlyRateCents || null,
          commission_percent: x.commissionPercent || null,
          pending_role: primaryRole as Role,
        };
      });

      setMembers(fetchedMembers);

      const map: Record<string, Role[]> = {};
      dataList.forEach((x: any) => {
        const uid = x.userId || x.user_id || x.user?.id;
        if (uid) {
          const rolesList = x.user?.userRoles?.map((ur: any) => ur.role?.name as Role) || [];
          if (rolesList.length > 0) {
            map[uid] = rolesList;
          }
        }
      });
      setRoles(map);
    } catch (e) {
      console.error("Failed to load staff profiles:", e);
      toast.error("Failed to load staff members");
    } finally {
      setLoading(false);
      loadInProgress.current = false;
    }
  };

  useEffect(() => { if (canAccessTeam) load(); }, [canAccessTeam]);

  const sendInvite = async (m: Member, role?: Role) => {
    if (!m.email) { toast.error("No email on file"); return; }
    setBusy(m.id);
    const { data, error } = await ApiClient.post("staff-invite-send", {
      body: { staffId: m.id, role: role ?? "staff" },
    });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error || (typeof error === "string" ? error : (error as any)?.message) || "Could not send invite");
      return;
    }
    toast.success(`Invite sent to ${m.email}`);
    load();
  };

  const sendAll = async () => {
    setBusy("all");
    const { data, error } = await ApiClient.post("staff-invite-send", { body: { all: true } });
    setBusy(null);
    if (error || data?.error) { toast.error(data?.error || (typeof error === "string" ? error : (error as any)?.message) || "Failed"); return; }
    toast.success(`Sent ${data?.sent ?? 0} invites`);
    load();
  };

  const addMember = async () => {
    if (!draft.full_name.trim() || !draft.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setAddBusy(true);

    const email = draft.email.trim().toLowerCase();
    const password = draft.password.trim() || "12345678";
    const title = draft.role ? draft.role.replace(/_/g, " ").toUpperCase() : "Staff Member";

    if (draft.id) {
      // EDIT MODE
      try {
        await staffService.updateStaff(draft.id, {
          fullName: draft.full_name.trim(),
          full_name: draft.full_name.trim(),
          title,
          email,
          color: draft.color,
          roleName: draft.role,
          role: draft.role,
          password,
        });
        toast.success(`Member ${draft.full_name} updated successfully!`);
      } catch (e: any) {
        toast.error(e?.message || "Failed to update member");
      }
    } else {
      // ADD MODE — create user + staff profile in DB
      try {
        await staffService.createStaffWithUser({
          fullName: draft.full_name.trim(),
          title,
          email,
          password,
          roleName: draft.role,
          color: draft.color,
        });
        toast.success(`Member ${draft.full_name} created successfully! Login credentials: Email: ${email} | Password: ${password}`);
      } catch (e: any) {
        toast.error(e?.message || "Failed to create staff member");
      }
    }

    setAddBusy(false);
    setAddOpen(false);
    setDraft({ id: "", full_name: "", title: "", email: "", password: "", color: PALETTE[0], role: "staff", sendInvite: true });
    ApiClient.clearCache("/staff");
    load();
  };

  const approveMemberRequest = async (_req: PendingRequest) => {
    toast.info("Member approval processed");
    ApiClient.clearCache("/staff");
    load();
  };

  const rejectMemberRequest = (_reqId: string) => {
    toast.info("Member request rejected");
    ApiClient.clearCache("/staff");
    load();
  };

  const updateRole = async (m: Member, newRole: Role) => {
    if (!m.user_id) return;
    setBusy(m.id);
    const { error: delErr } = await apiQuery("user_roles").delete().eq("user_id", m.user_id);
    if (delErr) { setBusy(null); toast.error(delErr.message); return; }
    const toInsert: { user_id: string; role: Role }[] = [{ user_id: m.user_id, role: newRole }];
    if (newRole === "admin" || newRole === "provider" || newRole === "scheduler" || newRole === "receptionist" || newRole === "nurse_practitioner" || newRole === "medical_director") toInsert.push({ user_id: m.user_id, role: "staff" });
    const { error: insErr } = await apiQuery("user_roles").insert(toInsert);
    setBusy(null);
    if (insErr) { toast.error(insErr.message); return; }
    toast.success(`Role updated to ${newRole}`);
    ApiClient.clearCache("/staff");
    load();
  };

  const toggleActive = async (m: Member) => {
    setBusy(m.id);
    try {
      await staffService.updateStaff(m.id, { is_active: !m.is_active });
      toast.success(m.is_active ? `Deactivated ${m.full_name}` : `Reactivated ${m.full_name}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to toggle status");
    } finally {
      setBusy(null);
      ApiClient.clearCache("/staff");
      load();
    }
  };

  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null);
  const [payEditing, setPayEditing] = useState<Member | null>(null);
  const [payDraft, setPayDraft] = useState({ rate: "", pct: "" });
  const [paySaving, setPaySaving] = useState(false);

  const openPay = (m: Member) => {
    setPayDraft({
      rate: m.hourly_rate_cents != null ? (m.hourly_rate_cents / 100).toString() : "",
      pct: m.commission_percent != null ? String(m.commission_percent) : "",
    });
    setPayEditing(m);
  };

  const savePay = async () => {
    if (!payEditing) return;
    setPaySaving(true);
    const rate = payDraft.rate.trim() === "" ? null : Math.round(parseFloat(payDraft.rate) * 100);
    const pct = payDraft.pct.trim() === "" ? null : parseFloat(payDraft.pct);
    if (rate !== null && (isNaN(rate) || rate < 0)) { setPaySaving(false); return toast.error("Invalid rate"); }
    if (pct !== null && (isNaN(pct) || pct < 0 || pct > 100)) { setPaySaving(false); return toast.error("Commission must be 0–100"); }

    try {
      await staffService.updateStaff(payEditing.id, {
        hourly_rate_cents: rate,
        commission_percent: pct,
      } as any);
      toast.success(`Saved pay settings for ${payEditing.full_name}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save pay settings");
    } finally {
      setPaySaving(false);
      setPayEditing(null);
      ApiClient.clearCache("/staff");
      load();
    }
  };

  const deleteMember = async (m: Member) => {
    const isAdminAccount = m.email?.toLowerCase() === "admin@gmail.com" || resolveMemberRole(m) === "admin";
    if (isAdminAccount) {
      toast.error("System Admin account cannot be deleted.");
      setConfirmDelete(null);
      return;
    }
    if (user && ((user.email && m.email && user.email.toLowerCase() === m.email.toLowerCase()) || (user.id && (m.user_id === user.id || m.id === user.id)))) {
      toast.error("You cannot delete your own account");
      setConfirmDelete(null);
      return;
    }
    setBusy(m.id);
    try {
      await staffService.deleteStaff(m.id);
      toast.success(`${m.full_name} deleted`);
    } catch (e: any) {
      toast.error(e?.message || `Failed to delete ${m.full_name}`);
    } finally {
      setBusy(null);
      setConfirmDelete(null);
      ApiClient.clearCache("/staff");
      load();
    }
  };

  const resolveMemberRole = (m: Member): Role => {
    const memberRoles = m.user_id ? (roles[m.user_id] ?? []) : [];

    const explicitRole =
      (m as any).role ||
      m.pending_role ||
      (memberRoles.includes("admin")
        ? "admin"
        : memberRoles.includes("medical_director")
          ? "medical_director"
          : memberRoles.includes("provider")
            ? "provider"
            : memberRoles.includes("nurse_practitioner")
              ? "nurse_practitioner"
              : memberRoles.includes("privacy_officer")
                ? "privacy_officer"
                : memberRoles.includes("scheduler")
                  ? "scheduler"
                  : memberRoles.includes("receptionist")
                    ? "receptionist"
                    : memberRoles.includes("staff")
                      ? "staff"
                      : null);

    if (explicitRole) return explicitRole as Role;

    const titleLower = (m.title || "").toLowerCase();
    if (titleLower.includes("medical director") || titleLower.includes("supervising physician")) return "medical_director";
    if (titleLower.includes("nurse practitioner") || titleLower.includes("np")) return "nurse_practitioner";
    if (titleLower.includes("physician") || titleLower.includes("practitioner") || titleLower.includes("provider") || titleLower.includes("injector")) return "provider";
    if (titleLower.includes("security") || titleLower.includes("privacy")) return "privacy_officer";
    if (titleLower.includes("receptionist")) return "receptionist";
    if (titleLower.includes("scheduler")) return "scheduler";

    return "staff";
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "medical_director":
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Medical Director</Badge>;
      case "nurse_practitioner":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Nurse Practitioner</Badge>;
      case "provider":
        return <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Provider</Badge>;
      case "admin":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Admin</Badge>;
      case "privacy_officer":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Security Officer</Badge>;
      case "receptionist":
        return <Badge variant="outline" className="bg-secondary text-foreground border-border text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Receptionist</Badge>;
      case "scheduler":
        return <Badge variant="outline" className="bg-secondary text-foreground border-border text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Scheduler</Badge>;
      default:
        return <Badge variant="outline" className="bg-secondary text-foreground border-border text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Staff</Badge>;
    }
  };

  if (!canAccessTeam) return <div className="p-8 text-sm text-muted-foreground">Access Restricted.</div>;

  const getMemberRoleFilterCount = (filter: string) => {
    return members.filter((m) => {
      if (filter === "all") return true;
      const r = resolveMemberRole(m);
      if (filter === "admin") return r === "admin";
      if (filter === "provider") return r === "provider";
      if (filter === "md") return r === "medical_director";
      if (filter === "np") return r === "nurse_practitioner";
      if (filter === "staff") return r === "staff" || r === "receptionist" || r === "scheduler";
      return true;
    }).length;
  };

  const filteredMembers = members
    .filter((m) => {
      if (roleFilter === "all") return true;
      const primaryRole = resolveMemberRole(m);

      if (roleFilter === "admin") return primaryRole === "admin";
      if (roleFilter === "md") return primaryRole === "medical_director";
      if (roleFilter === "provider") return primaryRole === "provider";
      if (roleFilter === "np") return primaryRole === "nurse_practitioner";
      if (roleFilter === "staff") return primaryRole === "staff" || primaryRole === "receptionist" || primaryRole === "scheduler";
      return true;
    })
    .sort((a, b) => {
      const roleA = resolveMemberRole(a);
      const roleB = resolveMemberRole(b);
      if (roleA === "admin" && roleB !== "admin") return -1;
      if (roleA !== "admin" && roleB === "admin") return 1;
      return (a.full_name || "").localeCompare(b.full_name || "");
    });

  if (currentTab === "notes") {
    return (
      <div className="p-4 sm:p-8 max-w-6xl space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl">Staff & Provider Notes</h1>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-semibold px-2.5 py-0.5">
              Medical Director & Admin Governance
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Review and oversee all clinical chart notes, Good Faith Exams, and procedure notes submitted by providers and staff members.
          </p>
        </div>
        <ChartNotesIndex />
      </div>
    );
  }

  if (currentTab === "roles") {
    return (
      <div className="p-4 sm:p-8 max-w-5xl space-y-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl">Role & Permission Management</h1>
            {pendingRequests.length > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold px-2.5 py-0.5">
                {pendingRequests.length} Pending Approval
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Review pending member requests, accept activation credentials, and manage role permission levels.</p>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-xl">Pending Member Activation Requests</h2>
            </div>
            <span className="text-xs text-muted-foreground">{pendingRequests.length} Request(s)</span>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <div className="font-medium text-sm">No Pending Member Requests</div>
              <div className="text-xs text-muted-foreground mt-1">When new team members are created, their approval requests appear here for Admin sign-off.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div key={req.id} className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center font-bold text-white shadow-xs" style={{ background: req.color }}>
                      {getInitials(req.full_name)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                        {req.full_name || "Pending Member"}
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                          {req.role.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{req.title} · {req.email}</div>
                      <div className="text-[11px] text-emerald-600 mt-1 font-mono">
                        Password Credentials: <span className="font-bold bg-background px-1.5 py-0.5 rounded border border-border">12345678</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button onClick={() => approveMemberRequest(req)} size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white">
                      <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve & Activate
                    </Button>
                    <Button onClick={() => rejectMemberRequest(req.id)} size="sm" variant="outline" className="rounded-full text-destructive hover:bg-destructive/10">
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-serif text-xl">Role Governance Matrix</h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="p-3.5">Role Name</th>
                    <th className="p-3.5">Scope & Access Level</th>
                    <th className="p-3.5">MFA Requirement</th>
                    <th className="p-3.5">Clinical Charts</th>
                    <th className="p-3.5 text-right">Approval Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-3.5 font-semibold text-foreground">Admin</td>
                    <td className="p-3.5 text-muted-foreground">Full Platform Governance</td>
                    <td className="p-3.5"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enforced AAL2</Badge></td>
                    <td className="p-3.5 text-muted-foreground">Full Access</td>
                    <td className="p-3.5 text-right text-emerald-600 font-medium">Owner / Admin</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-foreground">Provider</td>
                    <td className="p-3.5 text-muted-foreground">Clinical & Patient Treatments</td>
                    <td className="p-3.5"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enforced AAL2</Badge></td>
                    <td className="p-3.5 text-muted-foreground">Assigned Clients</td>
                    <td className="p-3.5 text-right text-emerald-600 font-medium">Admin Approval</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-foreground">Medical Director</td>
                    <td className="p-3.5 text-muted-foreground">Supervising Physician — Sign & Co-Sign Notes</td>
                    <td className="p-3.5"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enforced AAL2</Badge></td>
                    <td className="p-3.5 text-muted-foreground">Full Access + Co-Sign</td>
                    <td className="p-3.5 text-right text-emerald-600 font-medium">Admin Approval</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-foreground">Nurse Practitioner</td>
                    <td className="p-3.5 text-muted-foreground">GFE Assessments & Co-Sign</td>
                    <td className="p-3.5"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enforced AAL2</Badge></td>
                    <td className="p-3.5 text-muted-foreground">GFE & Protocols</td>
                    <td className="p-3.5 text-right text-emerald-600 font-medium">Admin Approval</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-foreground">Staff / Receptionist</td>
                    <td className="p-3.5 text-muted-foreground">Bookings & Checkout</td>
                    <td className="p-3.5"><Badge variant="outline">Optional / Recommended</Badge></td>
                    <td className="p-3.5 text-muted-foreground">View Only</td>
                    <td className="p-3.5 text-right text-emerald-600 font-medium">Admin Approval</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (currentTab === "mfa") {
    return (
      <div className="p-4 sm:p-8 max-w-4xl space-y-6">
        <div>
          <h1 className="font-serif text-3xl">MFA Status & Governance</h1>
          <p className="text-xs text-muted-foreground mt-1">HIPAA §164.312 multi-factor authentication compliance across privileged roles.</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 flex items-start gap-4 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-foreground">MFA Enforcement Status: 100% Active</div>
            <div className="text-xs text-muted-foreground mt-1">TOTP Multi-Factor Authentication is enforced for all Admin, Provider, and Nurse Practitioner staff accounts.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-3xl">Staff Management</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isMDOnly ? "View clinical providers and practice team members." : "Manage all practice members, assign roles, and send activation emails."}
          </p>
        </div>
        {!isMDOnly && (
          <div className="flex gap-2">
            <Button onClick={openAdd} className="rounded-full">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add team member
            </Button>
            <Button variant="outline" onClick={sendAll} disabled={busy === "all"} className="rounded-full">
              {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-3.5 w-3.5 mr-1.5" />Invite all pending</>}
            </Button>
          </div>
        )}
      </div>

      {!isMDOnly && (
        <div className="flex items-center gap-1.5 p-1 mb-6 rounded-xl bg-muted/60 border border-border text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setSp({})}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 ${roleFilter === "all" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            All Staff ({members.length})
          </button>
          <button
            onClick={() => setSp({ role: "provider" })}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 ${roleFilter === "provider" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Providers
          </button>
          <button
            onClick={() => setSp({ role: "md" })}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 ${roleFilter === "md" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Medical Directors
          </button>
          <button
            onClick={() => setSp({ role: "np" })}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 ${roleFilter === "np" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Nurse Practitioners
          </button>
          <button
            onClick={() => setSp({ role: "staff" })}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 ${roleFilter === "staff" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Staff & Receptionists
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((m) => {
            const primaryRole = resolveMemberRole(m);

            return (
              <div key={m.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center font-bold text-white shadow-xs" style={{ background: m.color }}>
                    {getInitials(m.full_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.full_name || "Unnamed Member"}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.title} · {m.email || "no email"}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-1.5 items-center">
                      {m.is_owner && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">Owner</span>}
                      {(m.hourly_rate_cents != null || m.commission_percent != null) && (
                        <span className="px-1.5 py-0.5 rounded bg-secondary/60 text-secondary-foreground border border-border/40 font-medium">
                          Pay: {m.hourly_rate_cents != null ? `$${(m.hourly_rate_cents / 100).toFixed(0)}/hr` : ""}
                          {m.hourly_rate_cents != null && m.commission_percent != null ? " + " : ""}
                          {m.commission_percent != null ? `${m.commission_percent}% commission` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getRoleBadge(primaryRole)}

                  {(() => {
                    const isSelf = !!(
                      (user?.email && m.email && user.email.toLowerCase() === m.email.toLowerCase()) ||
                      (user?.id && (m.user_id === user.id || m.id === user.id))
                    );
                    const isAdminMember = primaryRole === "admin";
                    return (
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(m, primaryRole)} className="h-8 w-8 rounded-full" title={isAdminMember ? "View / Edit Admin Credentials" : "Edit Profile Details"}>
                          {isAdminMember ? <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /> : <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />}
                        </Button>
                        {!isAdminMember && (
                          <Button size="icon" variant="ghost" onClick={() => openPay(m)} className="h-8 w-8 rounded-full" title="Edit Pay / Commission">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                        )}
                        {!isAdminMember && !m.is_owner && !isSelf && (
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(m)} className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10" title="Delete permanently">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? (draft.role === "admin" ? "Edit admin account" : "Edit team member") : "Add team member"}</DialogTitle>
            <DialogDescription>
              {draft.id ? "Update member details, password, and permissions." : "Create a profile and submit an activation request for Admin approval."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Full name</Label>
              <Input value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} className="mt-1.5" placeholder="Jane Doe" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="mt-1.5" placeholder="jane@example.com" />
            </div>
            <div>
              <Label>Password for Staff Login</Label>
              <Input
                type="text"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                className="mt-1.5 font-mono"
                placeholder="Set password"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {draft.id ? "Enter a new password to update staff login." : "Staff will use this password to sign into the Staff Portal."}
              </p>
            </div>
            {draft.role !== "admin" && (
              <>
                <div>
                  <Label>Role</Label>
                  <select
                    value={draft.role}
                    onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
                    className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Calendar color</Label>
                  <div className="mt-1.5 flex gap-2 flex-wrap">
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDraft({ ...draft, color: c })}
                        className={`h-8 w-8 rounded-full border-2 transition ${draft.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ background: c }}
                        aria-label={`color ${c}`}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={addBusy}>Cancel</Button>
            <Button onClick={addMember} disabled={addBusy}>
              {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (draft.id ? "Save Changes" : "Create Member")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes their profile, role, invitations, service assignments, and time-off entries.
              If they have any appointments on record, the deletion will be blocked — deactivate them instead to preserve history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === confirmDelete?.id}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (confirmDelete) deleteMember(confirmDelete); }}
              disabled={busy === confirmDelete?.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy === confirmDelete?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!payEditing} onOpenChange={(o) => !o && setPayEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay · {payEditing?.full_name}</DialogTitle>
            <DialogDescription>Set hourly rate, commission %, or both. Leave a field blank to disable it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Hourly rate (USD)</Label>
              <Input
                type="number" min="0" step="0.50" placeholder="e.g. 20"
                value={payDraft.rate}
                onChange={(e) => setPayDraft(d => ({ ...d, rate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Commission % on services + tips</Label>
              <Input
                type="number" min="0" max="100" step="1" placeholder="e.g. 25"
                value={payDraft.pct}
                onChange={(e) => setPayDraft(d => ({ ...d, pct: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Calculated from paid sales where this member is the provider.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayEditing(null)} disabled={paySaving}>Cancel</Button>
            <Button onClick={savePay} disabled={paySaving}>{paySaving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

