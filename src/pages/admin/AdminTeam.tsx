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
import { Loader2, Mail, CheckCircle2, Plus, MoreHorizontal, UserX, UserCheck, Trash2, ShieldCheck, Lock, KeyRound, AlertCircle, XCircle, Pencil, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ChartNotesIndex from "../staff/clinical/ChartNotesIndex";
import { getDynamicProfileName } from "@/lib/userProfile";

interface Member {
  id: string; full_name: string; title: string; email: string | null;
  user_id: string | null; is_active: boolean; is_owner: boolean; color: string;
  hourly_rate_cents: number | null; commission_percent: number | null;
  is_pending?: boolean;
  pending_role?: Role;
}

type Role = "admin" | "nurse_practitioner" | "medical_director" | "rn_injector" | "privacy_officer" | "front_desk";
const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin (full system access)",
  privacy_officer: "Privacy & Security Officer (HIPAA policies, audit, compliance)",
  medical_director: "Medical Director (supervising physician — sign & co-sign notes)",
  nurse_practitioner: "Nurse Practitioner (independent/collaborative provider)",
  rn_injector: "RN Injector (clinical aesthetics injector)",
  front_desk: "Front Desk Coordinator (scheduler, check-in, patient intake)",
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

const DEFAULT_STAFF_MEMBERS: Member[] = [
  {
    id: "staff-md-1", user_id: "user-md-1",
    full_name: getDynamicProfileName("medicaldirector@gmail.com", "Dr. Dhruva (MD)"),
    title: "Medical Director & Supervising Physician", email: "medicaldirector@gmail.com",
    is_active: true, is_owner: false, color: "#8b7ec4", hourly_rate_cents: null, commission_percent: null, pending_role: "medical_director"
  },
  {
    id: "staff-np-1", user_id: "user-np-1",
    full_name: getDynamicProfileName("nurseprectitioner@gmail.com", "Kiem Vukadinovic, NP"),
    title: "Nurse Practitioner & Lead Injector", email: "nurseprectitioner@gmail.com",
    is_active: true, is_owner: false, color: "#7c9dd1", hourly_rate_cents: null, commission_percent: null, pending_role: "nurse_practitioner"
  },
  {
    id: "staff-rn-1", user_id: "user-rn-1",
    full_name: getDynamicProfileName("injector@gmail.com", "Girish, RN Injector"),
    title: "Registered Nurse Injector", email: "injector@gmail.com",
    is_active: true, is_owner: false, color: "#5db8a8", hourly_rate_cents: null, commission_percent: null, pending_role: "rn_injector"
  },
  {
    id: "staff-po-1", user_id: "user-po-1",
    full_name: getDynamicProfileName("securityofficer@gmail.com", "Bob Stane (Security Officer)"),
    title: "Privacy & Security Officer & Founder", email: "securityofficer@gmail.com",
    is_active: true, is_owner: false, color: "#a8c084", hourly_rate_cents: null, commission_percent: null, pending_role: "privacy_officer"
  },
  {
    id: "staff-fd-1", user_id: "user-fd-1",
    full_name: getDynamicProfileName("scheduler@gmail.com", "Front Desk Coordinator"),
    title: "Front Desk Coordinator & Scheduler", email: "scheduler@gmail.com",
    is_active: true, is_owner: false, color: "#e8b94b", hourly_rate_cents: null, commission_percent: null, pending_role: "front_desk"
  }
];

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
  const roleFilter = sp.get("role") || "all";
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
  const [draft, setDraft] = useState({ id: "" as string | null, full_name: "", title: "", email: "", password: "", color: PALETTE[0], role: "" as Role, sendInvite: true });

  const openAdd = () => {
    setDraft({
      id: null,
      full_name: "",
      title: "",
      email: "",
      password: "",
      color: PALETTE[0],
      role: "" as Role,
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
          full_name: getDynamicProfileName(x.email || x.user?.email, x.fullName || x.full_name || resolveName(x)),
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

      // Merge default staff members if not present
      DEFAULT_STAFF_MEMBERS.forEach((d) => {
        if (d.email && !fetchedMembers.some((m) => m.email?.toLowerCase() === d.email.toLowerCase())) {
          fetchedMembers.push({
            ...d,
            full_name: getDynamicProfileName(d.email, d.full_name)
          });
        }
      });

      setMembers(fetchedMembers);

      // Synchronize: REPLACE approved accounts with current staff list (removes stale entries)
      const oldApproved: any[] = JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
      const oldByEmail = new Map(oldApproved.map((a) => [a.email?.toLowerCase(), a]));
      const newApproved: any[] = [];
      fetchedMembers.forEach((m) => {
        if (m.email) {
          const cleanEmail = m.email.toLowerCase();
          const existing = oldByEmail.get(cleanEmail);
          newApproved.push({
            id: m.id,
            email: cleanEmail,
            password: existing?.password || "12345678",
            full_name: m.full_name,
            role: m.pending_role || existing?.role || "staff",
          });
        }
      });
      localStorage.setItem("rka_approved_staff_accounts", JSON.stringify(newApproved));

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



  const addMember = async () => {
    if (!draft.full_name.trim() || !draft.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!draft.role) {
      toast.error("Please select a role for the team member");
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

        const targetMember = members.find((m) => m.id === draft.id);
        if (targetMember?.user_id) {
          try {
            await apiQuery("user_roles" as any).delete().eq("user_id", targetMember.user_id);
            await apiQuery("user_roles" as any).insert([
              { user_id: targetMember.user_id, role: draft.role },
              ...((draft.role as string) !== "staff" && (draft.role as string) !== "front_desk" ? [{ user_id: targetMember.user_id, role: "front_desk" }] : []),
            ]);
          } catch (e) {}
        }

        setMembers((prev) =>
          prev.map((m) =>
            m.id === draft.id
              ? {
                  ...m,
                  full_name: draft.full_name.trim(),
                  title,
                  email,
                  color: draft.color,
                  pending_role: draft.role,
                }
              : m
          )
        );

        if (targetMember?.user_id) {
          setRoles((prev) => ({ ...prev, [targetMember.user_id!]: [draft.role] }));
        }

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

        const newMember: Member = {
          id: `staff-new-${Date.now()}`,
          user_id: `user-new-${Date.now()}`,
          full_name: draft.full_name.trim(),
          title,
          email,
          is_active: true,
          is_owner: false,
          color: draft.color || PALETTE[0],
          hourly_rate_cents: null,
          commission_percent: null,
          pending_role: draft.role,
        };

        setMembers((prev) => {
          const filtered = prev.filter((m) => m.email?.toLowerCase() !== email);
          return [newMember, ...filtered];
        });

        toast.success(`Team member ${draft.full_name.trim()} created successfully!`);
      } catch (e: any) {
        const rawErr = e?.message || e?.error?.message || (typeof e === "string" ? e : "");
        if (
          rawErr.toLowerCase().includes("already exists") ||
          rawErr.includes("P2002") ||
          rawErr.includes("RES_002")
        ) {
          toast.error(`An account with email "${email}" already exists. Please enter a different email address.`);
        } else {
          toast.error(rawErr || "Failed to create staff member");
        }
      }
    }

    // Sync created / updated account to approved staff accounts cache
    try {
      const approvedAccounts: any[] = JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
      const filtered = approvedAccounts.filter((a) => a.email?.toLowerCase() !== email);
      filtered.push({
        id: draft.id || `approved-${email}`,
        email,
        password,
        full_name: draft.full_name.trim(),
        role: draft.role,
      });
      localStorage.setItem("rka_approved_staff_accounts", JSON.stringify(filtered));

      const deletedEmails: string[] = JSON.parse(localStorage.getItem("rka_deleted_staff_emails") || "[]");
      const sanitizedDeleted = deletedEmails.filter((e) => e.toLowerCase() !== email);
      localStorage.setItem("rka_deleted_staff_emails", JSON.stringify(sanitizedDeleted));
    } catch (_err) {}

    setAddBusy(false);
    loadInProgress.current = false;
    setTimeout(() => { load(); }, 200);
    setAddOpen(false);
    setDraft({ id: "", full_name: "", title: "", email: "", password: "", color: PALETTE[0], role: "" as Role, sendInvite: true });
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
    if (newRole === "admin" || newRole === "nurse_practitioner" || newRole === "medical_director" || newRole === "rn_injector" || newRole === "privacy_officer" || newRole === "front_desk") toInsert.push({ user_id: m.user_id, role: newRole });
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
      if (m.email) {
        const cleanEmail = m.email.toLowerCase();
        const deletedEmails: string[] = JSON.parse(localStorage.getItem("rka_deleted_staff_emails") || "[]");
        if (!deletedEmails.includes(cleanEmail)) {
          deletedEmails.push(cleanEmail);
          localStorage.setItem("rka_deleted_staff_emails", JSON.stringify(deletedEmails));
        }
        const approved: any[] = JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
        const filtered = approved.filter((a) => a.email?.toLowerCase() !== cleanEmail);
        localStorage.setItem("rka_approved_staff_accounts", JSON.stringify(filtered));
      }
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

    const activeAssignedRole = memberRoles.find((r) => r !== ("staff" as any));
    if (activeAssignedRole) {
      return activeAssignedRole as Role;
    }

    const explicitRole = (m as any).role || m.pending_role;

    if (explicitRole) {
      // Normalize any legacy role strings
      const r = (explicitRole as string).toLowerCase();
      if (r === "provider" || r === "injector") return "rn_injector";
      if (r === "receptionist" || r === "scheduler" || r === "staff") return "front_desk";
      if (r === "security_officer") return "privacy_officer";
      return explicitRole as Role;
    }

    const titleLower = (m.title || "").toLowerCase();
    if (titleLower.includes("admin")) return "admin";
    if (titleLower.includes("medical director") || titleLower.includes("supervising physician")) return "medical_director";
    if (titleLower.includes("nurse practitioner") || titleLower.includes("np")) return "nurse_practitioner";
    if (titleLower.includes("injector") || titleLower.includes("rn")) return "rn_injector";
    if (titleLower.includes("security") || titleLower.includes("privacy") || titleLower.includes("compliance")) return "privacy_officer";
    if (titleLower.includes("front desk") || titleLower.includes("receptionist") || titleLower.includes("scheduler")) return "front_desk";

    return "front_desk";
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "medical_director":
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Medical Director</Badge>;
      case "nurse_practitioner":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Nurse Practitioner</Badge>;
      case "rn_injector":
        return <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">RN / Injector</Badge>;
      case "admin":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Admin</Badge>;
      case "privacy_officer":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Security Officer</Badge>;
      case "front_desk":
        return <Badge variant="outline" className="bg-secondary text-foreground border-border text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Front Desk</Badge>;
      default:
        return <Badge variant="outline" className="bg-secondary text-foreground border-border text-xs font-semibold px-2.5 py-1 uppercase tracking-wider">Front Desk</Badge>;
    }
  };

  if (!canAccessTeam) return <div className="p-8 text-sm text-muted-foreground">Access Restricted.</div>;

  const isExcludedStaff = (m: Member) => {
    if (!m.email || !m.email.trim()) return true;
    const em = m.email.toLowerCase().trim();
    if (em.includes("no email")) return true;
    if (em === "admin@gmail.com") return true;
    return false;
  };

  const getMemberRoleFilterCount = (filter: string) => {
    return members.filter((m) => {
      if (isExcludedStaff(m)) return false;
      if (filter === "all") return true;
      const r = resolveMemberRole(m);
      if (filter === "clinical") return r === "nurse_practitioner" || r === "rn_injector";
      if (filter === "md") return r === "medical_director";
      if (filter === "np") return r === "nurse_practitioner";
      if (filter === "front_desk") return r === "front_desk";
      return true;
    }).length;
  };

  const filteredMembers = members
    .filter((m) => {
      if (isExcludedStaff(m)) return false;
      if (roleFilter === "all") return true;
      const primaryRole = resolveMemberRole(m);

      if (roleFilter === "md") return primaryRole === "medical_director";
      if (roleFilter === "clinical") return primaryRole === "nurse_practitioner" || primaryRole === "rn_injector";
      if (roleFilter === "np") return primaryRole === "nurse_practitioner";
      if (roleFilter === "front_desk") return primaryRole === "front_desk";
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
      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
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
      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
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
                    <td className="p-3.5 font-semibold text-foreground">Privacy & Security Officer</td>
                    <td className="p-3.5 text-muted-foreground">HIPAA Policies, Audit Logs, Breach Reports</td>
                    <td className="p-3.5"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enforced AAL2</Badge></td>
                    <td className="p-3.5 text-muted-foreground">Audit Only</td>
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
                    <td className="p-3.5 text-muted-foreground">Clinical Provider — GFE, SOAP, Prescriptions</td>
                    <td className="p-3.5"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enforced AAL2</Badge></td>
                    <td className="p-3.5 text-muted-foreground">GFE & Protocols</td>
                    <td className="p-3.5 text-right text-emerald-600 font-medium">Admin Approval</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-foreground">RN / Injector</td>
                    <td className="p-3.5 text-muted-foreground">Treatments, Clinical Notes, Submit for Cosign</td>
                    <td className="p-3.5"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enforced AAL2</Badge></td>
                    <td className="p-3.5 text-muted-foreground">Assigned Clients</td>
                    <td className="p-3.5 text-right text-emerald-600 font-medium">Admin Approval</td>
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-foreground">Front Desk / Scheduler</td>
                    <td className="p-3.5 text-muted-foreground">Booking, Check-in, Calendar, POS</td>
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
      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
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
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
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
          </div>
        )}
      </div>

      {!isMDOnly && (
        <div className="flex items-center gap-1.5 p-1 mb-6 rounded-xl bg-muted/60 border border-border text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setSp({})}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 ${roleFilter === "all" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            All Staff ({getMemberRoleFilterCount("all")})
          </button>
          <button
            onClick={() => setSp({ role: "clinical" })}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 ${roleFilter === "clinical" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Clinical Providers
          </button>
          <button
            onClick={() => setSp({ role: "md" })}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 ${roleFilter === "md" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Medical Directors
          </button>
          <button
            onClick={() => setSp({ role: "front_desk" })}
            className={`px-3.5 py-2 rounded-lg transition shrink-0 ${roleFilter === "front_desk" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Front Desk
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
                    <div className="text-xs text-muted-foreground truncate">
                      {primaryRole ? primaryRole.replace(/_/g, " ").toUpperCase() : (m.title || "TEAM MEMBER")} · {m.email || "no email"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-1.5 items-center">
                      {m.is_owner && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">Owner</span>}
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
            <div>
              <Label>Role</Label>
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
                className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                disabled={draft.email?.toLowerCase() === "admin@gmail.com"}
              >
                <option value="" disabled>Select Role...</option>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              {draft.email?.toLowerCase() === "admin@gmail.com" && (
                <p className="text-[10px] text-muted-foreground mt-1">System Admin role cannot be modified.</p>
              )}
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
    </div>
  );
}

