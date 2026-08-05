import { confirmDialog, promptDialog } from "@/components/ui/confirm";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { fetchApptServiceNames, combinedServiceLabel } from "@/lib/apptServices";
import { format } from "date-fns";
import { Loader2, Search, Download, Send, Upload, CalendarPlus, MoreHorizontal, UserPlus, Ban, Trash2, ShieldOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type ImportRow = {
  first_name: string; last_name: string; email: string;
  phone: string | null; dob: string | null; gender: string | null; notes?: string;
};

type ImportedClient = { first_name: string; last_name: string; email: string; phone: string | null; dob: string | null; gender: string | null; notes?: string } & { id: string; invited_at: string | null };

export default function StaffClients() {
  const { canSeeAll, staffId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [imported, setImported] = useState<ImportedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    // Honor ⌘F / palette deep-link: auto-focus the search box on landing.
    if (searchParams.get("focus") === "1") {
      searchRef.current?.focus();
      searchRef.current?.select();
      const next = new URLSearchParams(searchParams);
      next.delete("focus");
      setSearchParams(next, { replace: true });
    }
    if (searchParams.get("new") === "1") {
      setAddClientOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [accountFilter, setAccountFilter] = useState<"all" | "has" | "missing" | "leads">("all");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{ rows: ImportRow[]; incomplete: number; duplicates: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [blockedEmails, setBlockedEmails] = useState<Set<string>>(new Set());
  const [accountEmails, setAccountEmails] = useState<Set<string>>(new Set());
  const [leadEmails, setLeadEmails] = useState<Set<string>>(new Set());
  const [leads, setLeads] = useState<Array<{ email: string; first_name: string | null; last_name: string | null; phone: string | null; lead_captured_at: string | null; lead_source: string | null }>>([]);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const [clientProfiles, setClientProfiles] = useState<any[]>([]);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addClientDraft, setAddClientDraft] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    dob: "",
  });
  const [addClientBusy, setAddClientBusy] = useState(false);

  const reloadAccounts = async () => {
    const { data } = await apiQuery("client_profiles").select("email, is_lead, first_name, last_name, phone, dob, lead_captured_at, lead_source, created_at").limit(5000);
    const localClients: any[] = JSON.parse(localStorage.getItem("rka_demo_clients") || "[]");
    const cpList = [...(data ?? []), ...localClients];

    setClientProfiles(cpList);
    setAccountEmails(new Set(cpList.map((r: any) => (r.email || "").toLowerCase())));
    const leadRows = cpList.filter((r: any) => r.is_lead);
    setLeadEmails(new Set(leadRows.map((r: any) => (r.email || "").toLowerCase())));
    setLeads(leadRows.map((r: any) => ({
      email: (r.email || "").toLowerCase(),
      first_name: r.first_name,
      last_name: r.last_name,
      phone: r.phone,
      lead_captured_at: r.lead_captured_at,
      lead_source: r.lead_source,
    })));
  };

  const reloadBlocked = async () => {
    const { data } = await apiQuery("blocked_clients").select("email");
    setBlockedEmails(new Set((data ?? []).map((r: any) => (r.email || "").toLowerCase())));
  };

  const reloadImported = async () => {
    // Paginate so we don't silently truncate at 2k
    const all: ImportedClient[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 20000; from += PAGE) {
      const { data, error } = await apiQuery("imported_clients")
        .select("id, first_name, last_name, email, phone, dob, gender, notes, invited_at")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as ImportedClient[]));
      if (data.length < PAGE) break;
    }
    setImported(all);
  };

  useEffect(() => {
    const loadAppointmentsPaged = async () => {
      const all: any[] = [];
      const PAGE = 1000;
      for (let from = 0; from < 50000; from += PAGE) {
        let qy = apiQuery("appointments")
          .select("id, client_first_name, client_last_name, client_email, client_phone, client_dob, status, start_at, service_id, staff_id")
          .order("start_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (!canSeeAll && staffId) qy = qy.eq("staff_id", staffId);
        const { data, error } = await qy;
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
      }
      return { data: all };
    };
    Promise.all([loadAppointmentsPaged(), reloadImported(), reloadBlocked(), reloadAccounts()]).then(async ([appts]) => {
      const list = appts.data ?? [];
      const sids = [...new Set(list.map((a) => a.service_id))];
      const apptIds = list.map((a) => a.id);
      const [{ data: svcs }, apsvMap] = await Promise.all([
        sids.length ? apiQuery("services").select("id, name").in("id", sids) : Promise.resolve({ data: [] as any[] }),
        fetchApptServiceNames(apptIds),
      ]);
      setItems(list.map((a) => ({
        ...a,
        service_name: combinedServiceLabel(a.id, apsvMap, svcs?.find((s: any) => s.id === a.service_id)?.name ?? "—"),
      })));
      setLoading(false);
    });
  }, [canSeeAll, staffId]);

  const completeClients = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of items) {
      const email = (a.client_email || "").trim().toLowerCase();
      if (!email) continue;
      if (!a.client_first_name || !a.client_last_name || !a.client_phone || !a.client_dob) continue;
      if (!map.has(email)) {
        map.set(email, {
          first_name: a.client_first_name, last_name: a.client_last_name,
          email: a.client_email, phone: a.client_phone, dob: a.client_dob,
        });
      }
    }
    return [...map.values()];
  }, [items]);

  const exportCsv = () => {
    const all = [
      ...imported.filter((i: any) => i.phone && i.dob && i.gender).map((i: any) => ({
        first_name: i.first_name, last_name: i.last_name, email: i.email,
        phone: i.phone, dob: i.dob, gender: i.gender,
      })),
    ];
    const dedupe = new Map<string, any>();
    for (const c of all) {
      const k = c.email.toLowerCase();
      if (!dedupe.has(k)) dedupe.set(k, c);
    }
    const rows = [...dedupe.values()];
    if (!rows.length) { toast.error("No complete client records to export"); return; }
    const header = ["first_name", "last_name", "email", "phone", "dob", "gender"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...rows.map((c) => [c.first_name, c.last_name, c.email, c.phone, c.dob, c.gender])]
      .map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} clients`);
  };

  const sendInvite = async (client: { first_name: string; email: string }, importedId?: string) => {
    setSendingEmail(client.email);
    try {
      const { error } = await ApiClient.post("staff-send-client-invite", {
        body: {
          recipientEmail: client.email,
          clientName: client.first_name,
        },
      });
      if (error) throw error;
      if (importedId) {
        await apiQuery("imported_clients").update({ invited_at: new Date().toISOString() }).eq("id", importedId);
        await reloadImported();
      }
      toast.success(`Invite sent to ${client.email}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send invite");
    } finally {
      setSendingEmail(null);
    }
  };

  const parseCsv = (text: string): ImportRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return [];
    // Simple CSV parser supporting quoted fields
    const parseLine = (line: string): string[] => {
      const out: string[] = []; let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQ) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') inQ = false;
          else cur += ch;
        } else {
          if (ch === '"') inQ = true;
          else if (ch === ",") { out.push(cur); cur = ""; }
          else cur += ch;
        }
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));
    const iFirst = idx(["firstname", "first", "fname", "givenname"]);
    const iLast = idx(["lastname", "last", "lname", "surname", "familyname"]);
    const iName = idx(["name", "fullname"]);
    const iEmail = idx(["email", "emailaddress", "e-mail"]);
    const iPhone = idx(["phone", "phonenumber", "mobile", "cell", "tel"]);
    const iDob = idx(["dob", "dateofbirth", "birthday", "birthdate"]);
    const iGender = idx(["gender", "sex"]);
    const iNotes = idx(["notes", "note", "comments"]);
    if (iEmail < 0) throw new Error("CSV must have an 'email' column");

    const normGender = (v: string): string | null => {
      const s = v.trim().toLowerCase();
      if (!s) return null;
      if (["f", "female", "woman", "w"].includes(s)) return "female";
      if (["m", "male", "man"].includes(s)) return "male";
      if (["nb", "non-binary", "nonbinary", "enby"].includes(s)) return "non-binary";
      if (["other", "o"].includes(s)) return "other";
      if (["prefer not to say", "prefernottosay", "n/a", "na", "undisclosed", "notdisclosed"].includes(s.replace(/\s+/g, ""))) return "undisclosed";
      return s.slice(0, 30);
    };

    const rows: ImportRow[] = [];
    for (let li = 1; li < lines.length; li++) {
      const cols = parseLine(lines[li]);
      const email = (cols[iEmail] || "").toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      let first = iFirst >= 0 ? cols[iFirst] : "";
      let last = iLast >= 0 ? cols[iLast] : "";
      if ((!first || !last) && iName >= 0) {
        const parts = (cols[iName] || "").trim().split(/\s+/);
        first = first || parts[0] || "";
        last = last || parts.slice(1).join(" ") || "";
      }
      if (!first || !last) continue;
      const phoneRaw = iPhone >= 0 ? (cols[iPhone] || "").trim() : "";
      const phoneDigits = phoneRaw.replace(/\D/g, "");
      const phone = phoneDigits.length >= 7 ? phoneRaw.slice(0, 40) : null;
      let dob: string | null = null;
      if (iDob >= 0 && cols[iDob]) {
        const d = new Date(cols[iDob]);
        if (!isNaN(d.getTime())) dob = d.toISOString().slice(0, 10);
      }
      const gender = iGender >= 0 ? normGender(cols[iGender] || "") : null;
      rows.push({
        first_name: first.slice(0, 60),
        last_name: last.slice(0, 60),
        email,
        phone,
        dob,
        gender,
        notes: iNotes >= 0 ? cols[iNotes]?.slice(0, 500) || undefined : undefined,
      });
    }
    return rows;
  };

  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      const lineCount = text.split(/\r?\n/).filter((l) => l.trim().length).length;
      const totalDataRows = Math.max(0, lineCount - 1); // minus header
      const all = parseCsv(text);
      const incomplete = Math.max(0, totalDataRows - all.length);
      // Dedupe by email within file
      const seen = new Set<string>();
      const rows = all.filter((r) => {
        if (seen.has(r.email)) return false;
        seen.add(r.email); return true;
      });
      const duplicates = all.length - rows.length;
      if (!rows.length) {
        toast.error(`No valid rows. ${incomplete} skipped (missing first name, last name, or a valid email).`);
        return;
      }
      setImportPreview({ rows, incomplete, duplicates });
    } catch (e: any) {
      toast.error(e.message ?? "Could not read CSV");
    }
  };

  const confirmImport = async () => {
    if (!importPreview?.rows.length) return;
    setImporting(true);
    try {
      const { user } = await authService.getSession();
      const payload = importPreview.rows.map((r) => ({ ...r, imported_by: user?.id ?? null }));
      const { error, count } = await apiQuery
        .from("imported_clients")
        .upsert(payload, { onConflict: "email", ignoreDuplicates: false, count: "exact" });
      if (error) throw error;

      // Sync to GoHighLevel (best-effort, batched)
      ApiClient.post("ghl-sync-contact", {
        body: {
          contacts: payload.map((r) => ({
            email: r.email,
            firstName: r.first_name,
            lastName: r.last_name,
            phone: r.phone,
            dob: r.dob,
            source: "rkabook csv import",
            tags: ["rkabook", "imported"],
          })),
        },
      }).catch((e) => console.error("ghl sync failed", e));

      toast.success(`Imported ${count ?? payload.length} clients`);
      setImportPreview(null);
      setImportOpen(false);
      await reloadImported();
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const [backfilling, setBackfilling] = useState(false);
  const backfillToGhl = async () => {
    if (!(await confirmDialog({ title: "Push all clients to CRM?", description: "Sends every current client (booked + imported). This may take a moment.", confirmLabel: "Push all" }))) return;
    setBackfilling(true);
    try {
      const seen = new Set<string>();
      const contacts: any[] = [];
      for (const a of items) {
        const e = (a.client_email || "").toLowerCase();
        if (!e || seen.has(e)) continue;
        seen.add(e);
        contacts.push({
          email: e, firstName: a.client_first_name, lastName: a.client_last_name,
          phone: a.client_phone, dob: a.client_dob,
          source: "rkabook backfill", tags: ["rkabook", "backfill", "booking"],
        });
      }
      for (const i of imported) {
        const e = i.email.toLowerCase();
        if (!e || seen.has(e)) continue;
        seen.add(e);
        contacts.push({
          email: e, firstName: i.first_name, lastName: i.last_name,
          phone: i.phone, dob: i.dob,
          source: "rkabook backfill", tags: ["rkabook", "backfill", "imported"],
        });
      }
      // Send in chunks of 50
      let ok = 0, fail = 0;
      for (let i = 0; i < contacts.length; i += 50) {
        const chunk = contacts.slice(i, i + 50);
        const { data, error } = await ApiClient.post("ghl-sync-contact", { body: { contacts: chunk } });
        if (error) { fail += chunk.length; continue; }
        for (const r of (data?.results ?? [])) r.ok ? ok++ : fail++;
      }
      toast.success(`Synced ${ok} to CRM${fail ? ` (${fail} failed)` : ""}`);
    } catch (e: any) {
      toast.error(e.message ?? "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  };

  const [bulkInviting, setBulkInviting] = useState(false);
  const bulkInviteUnclaimed = async () => {
    setBulkInviting(true);
    try {
      const { data: dry, error: dryErr } = await ApiClient.post("staff-bulk-invite-clients", {
        body: { dryRun: true },
      });
      if (dryErr) throw dryErr;
      const n = dry?.toInvite ?? 0;
      if (!n) { toast.info("No unclaimed clients to invite — everyone already has an account."); return; }
      if (!(await confirmDialog({ title: `Send ${n} activation invite${n === 1 ? "" : "s"}?`, description: "Sent only to clients who haven't signed up yet. Invites are de-duplicated, safe to re-run.", confirmLabel: "Send invites" }))) return;
      const { data, error } = await ApiClient.post("staff-bulk-invite-clients", { body: {} });
      if (error) throw error;
      toast.success(`Queued ${data?.sent ?? 0} invites${data?.failed ? ` (${data.failed} failed)` : ""}`);
    } catch (e: any) {
      toast.error(e.message ?? "Bulk invite failed");
    } finally {
      setBulkInviting(false);
    }
  };

  const blockClient = async (c: { email: string; first_name: string; last_name: string }) => {
    if (!c.email) { toast.error("No email on file"); return; }
    const reason = await promptDialog({
      title: `Block ${c.first_name} ${c.last_name}?`,
      description: `${c.email} will not be able to book.\n\nOptional reason (staff only):`,
      placeholder: "Reason (optional)",
      confirmLabel: "Block client",
    });
    if (reason === null) return;
    setBusyEmail(c.email);
    try {
      const { user } = await authService.getSession();
      const { error } = await apiQuery("blocked_clients").upsert(
        { email: c.email.toLowerCase(), reason: reason || null, blocked_by: user?.id ?? null },
        { onConflict: "email" },
      );
      if (error) throw error;
      await reloadBlocked();
      toast.success(`Blocked ${c.email}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to block");
    } finally { setBusyEmail(null); }
  };

  const unblockClient = async (email: string) => {
    if (!(await confirmDialog({ title: `Unblock ${email}?`, description: "They will be able to book again.", confirmLabel: "Unblock" }))) return;
    setBusyEmail(email);
    try {
      const { error } = await apiQuery("blocked_clients").delete().eq("email", email.toLowerCase());
      if (error) throw error;
      await reloadBlocked();
      toast.success(`Unblocked ${email}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to unblock");
    } finally { setBusyEmail(null); }
  };

  const deleteClient = async (c: { email: string; first_name: string; last_name: string; imported_id?: string | null }) => {
    const name = `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email;
    if (!(await confirmDialog({
      title: `Delete ${name}?`,
      description: `Permanently remove ${c.email || name} from your patient directory.\n\nThis cannot be undone.`,
      destructive: true,
      confirmLabel: "Delete client",
    }))) return;

    const emailLower = (c.email || "").toLowerCase();
    setBusyEmail(c.email);
    try {
      if (c.imported_id) {
        await apiQuery("imported_clients").delete().eq("id", c.imported_id);
      }
      if (emailLower) {
        await apiQuery("client_profiles").delete().eq("email", emailLower);
        await apiQuery("appointments").delete().eq("client_email", emailLower);

        // Clear from browser local storage keys
        for (const key of ["rka_demo_clients", "rka_demo_client_profiles", "rka_demo_appointments", "rka_imported_clients"]) {
          try {
            const arr: any[] = JSON.parse(localStorage.getItem(key) || "[]");
            const next = arr.filter((x: any) =>
              (x.email || x.client_email || "").toLowerCase() !== emailLower &&
              (!c.imported_id || x.id !== c.imported_id)
            );
            localStorage.setItem(key, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }
      }

      await Promise.all([reloadImported(), reloadBlocked(), reloadAccounts()]);
      toast.success("Client deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    } finally {
      setBusyEmail(null);
    }
  };


  const newApptUrl = (c: { first_name?: string; last_name?: string; email?: string; phone?: string; dob?: string | null }) => {
    const p = new URLSearchParams();
    if (c.first_name) p.set("firstName", c.first_name);
    if (c.last_name) p.set("lastName", c.last_name);
    if (c.email) p.set("email", c.email);
    if (c.phone) p.set("phone", c.phone);
    if (c.dob) p.set("dob", c.dob);
    return `/staff/appointments/new?${p.toString()}`;
  };

  // Unified client list — one row per email, regardless of source.
  // Booked clients show their most-recent appointment; imported-only show "Imported".
  type UnifiedClient = {
    key: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    dob: string | null;
    appt_count: number;
    last_appt: { id: string; status: string; service_name: string; start_at: string } | null;
    imported_id: string | null;
    invited_at: string | null;
    sort_at: number;
  };

  const allClients = useMemo<UnifiedClient[]>(() => {
    const map = new Map<string, UnifiedClient>();
    for (const a of items) {
      const email = (a.client_email || "").trim().toLowerCase();
      const key = email || `__id_${a.id}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          first_name: a.client_first_name ?? "",
          last_name: a.client_last_name ?? "",
          email: a.client_email ?? "",
          phone: a.client_phone ?? null,
          dob: a.client_dob ?? null,
          appt_count: 1,
          last_appt: { id: a.id, status: a.status, service_name: a.service_name, start_at: a.start_at },
          imported_id: null,
          invited_at: null,
          sort_at: new Date(a.start_at).getTime(),
        });
      } else {
        existing.appt_count += 1;
      }
    }
    for (const cp of clientProfiles) {
      const email = (cp.email || "").trim().toLowerCase();
      if (!email) continue;
      if (!map.has(email)) {
        map.set(email, {
          key: email,
          first_name: cp.first_name || "Client",
          last_name: cp.last_name || "",
          email: cp.email,
          phone: cp.phone ?? null,
          dob: cp.dob ?? null,
          appt_count: 0,
          last_appt: null,
          imported_id: null,
          invited_at: null,
          sort_at: cp.created_at ? new Date(cp.created_at).getTime() : 0,
        });
      }
    }
    for (const i of imported) {
      const key = i.email.trim().toLowerCase();
      if (map.has(key)) continue;
      map.set(key, {
        key, first_name: i.first_name, last_name: i.last_name, email: i.email,
        phone: i.phone ?? null, dob: i.dob ?? null,
        appt_count: 0, last_appt: null,
        imported_id: i.id, invited_at: i.invited_at,
        sort_at: 0,
      });
    }
    // Pull in lead-only profiles (abandoned bookings) that have no appointment
    // and no imported row yet — so staff can still see and text them.
    for (const l of leads) {
      const key = l.email.trim().toLowerCase();
      if (!key || map.has(key)) continue;
      map.set(key, {
        key,
        first_name: l.first_name ?? "",
        last_name: l.last_name ?? "",
        email: l.email,
        phone: l.phone ?? null,
        dob: null,
        appt_count: 0,
        last_appt: null,
        imported_id: null,
        invited_at: null,
        sort_at: l.lead_captured_at ? new Date(l.lead_captured_at).getTime() : 0,
      });
    }
    return [...map.values()].sort((a, b) => b.sort_at - a.sort_at || (a.last_name || "").localeCompare(b.last_name || ""));
  }, [items, imported, leads, clientProfiles]);

  const handleAddClient = async () => {
    if (!addClientDraft.first_name.trim() || !addClientDraft.email.trim()) {
      toast.error("First name and email are required");
      return;
    }

    if (addClientDraft.phone) {
      const digits = addClientDraft.phone.replace(/\D/g, "");
      if (digits.length > 0 && digits.length !== 10) {
        toast.error("Phone number must be exactly 10 digits");
        return;
      }
    }

    if (addClientDraft.dob) {
      const today = new Date().toISOString().slice(0, 10);
      const yearStr = addClientDraft.dob.split("-")[0];
      const year = parseInt(yearStr, 10);
      if (addClientDraft.dob > today) {
        toast.error("Date of birth cannot be in the future");
        return;
      }
      if (isNaN(year) || yearStr.length !== 4 || year < 1900 || year > new Date().getFullYear()) {
        toast.error("Please enter a valid 4-digit birth year (1900 - present)");
        return;
      }
    }

    setAddClientBusy(true);
    const newClient = {
      id: `client-${Date.now()}`,
      first_name: addClientDraft.first_name.trim(),
      last_name: addClientDraft.last_name.trim(),
      email: addClientDraft.email.trim().toLowerCase(),
      phone: addClientDraft.phone.replace(/\D/g, "").slice(0, 10) || null,
      dob: addClientDraft.dob.trim() || null,
      created_at: new Date().toISOString(),
    };

    const localClients: any[] = JSON.parse(localStorage.getItem("rka_demo_clients") || "[]");
    localClients.push(newClient);
    localStorage.setItem("rka_demo_clients", JSON.stringify(localClients));

    try {
      await apiQuery("client_profiles").insert(newClient);
    } catch (e) {}

    toast.success(`Client ${newClient.first_name} ${newClient.last_name} created successfully!`);
    setAddClientBusy(false);
    setAddClientOpen(false);
    setAddClientDraft({ first_name: "", last_name: "", email: "", phone: "", dob: "" });
    reloadAccounts();
  };

  const matchesQuery = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const filtered = allClients.filter((c) => {
    if (!matchesQuery(`${c.first_name} ${c.last_name} ${c.email} ${c.phone ?? ""}`)) return false;
    if (accountFilter === "all") return true;
    if (accountFilter === "leads") return !!c.email && leadEmails.has(c.email.toLowerCase());
    const has = !!c.email && accountEmails.has(c.email.toLowerCase());
    return accountFilter === "has" ? has : !has;
  });

  const accountsCount = allClients.filter((c) => c.email && accountEmails.has(c.email.toLowerCase())).length;
  const missingCount = allClients.filter((c) => !c.email || !accountEmails.has(c.email.toLowerCase())).length;
  const leadsCount = allClients.filter((c) => c.email && leadEmails.has(c.email.toLowerCase())).length;
  const totalComplete = completeClients.length + imported.filter((i) => i.phone && i.dob).length;

  const statusColor = (s: string) =>
    s === "approved" ? "bg-success-soft text-success-soft-foreground" :
    s === "pending" ? "bg-warning-soft text-warning-soft-foreground" :
    s === "denied" || s === "no_show" ? "bg-destructive-soft text-destructive-soft-foreground" :
    "bg-secondary text-muted-foreground";

  const initials = (f: string, l: string) =>
    `${(f[0] ?? "").toUpperCase()}${(l[0] ?? "").toUpperCase()}` || "—";

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium">Clients</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {allClients.length} total · {accountsCount} with account · {missingCount} without
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAddClientOpen(true)} size="sm" className="rounded-full">
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add client
          </Button>
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className="pl-9 w-full sm:w-64" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setImportOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-2" /> Import from CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCsv}>
                <Download className="h-3.5 w-3.5 mr-2" /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={bulkInviteUnclaimed} disabled={bulkInviting}>
                {bulkInviting ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <UserPlus className="h-3.5 w-3.5 mr-2" />}
                Invite all unclaimed clients
              </DropdownMenuItem>
              <DropdownMenuItem onClick={backfillToGhl} disabled={backfilling}>
                {backfilling ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-2" />}
                Sync all to CRM
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs">
        {([["all", `All (${allClients.length})`], ["has", `Has account (${accountsCount})`], ["missing", `No account (${missingCount})`], ["leads", `Leads (${leadsCount})`]] as const).map(([k, lbl]) => (
          <button
            key={k}
            onClick={() => setAccountFilter(k)}
            className={`px-3 py-1.5 rounded-full border transition ${accountFilter === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground text-sm">
          {q ? "No clients match your search." : "No clients yet."}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {filtered.map((c) => {
            const fullName = `${c.first_name} ${c.last_name}`.trim() || c.email;
            const isImportedOnly = !c.last_appt;
            return (
              <div key={c.key} className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-secondary/30 transition">
                <Link
                  to={c.email ? `/staff/clients/${encodeURIComponent(c.email.toLowerCase())}` : "#"}
                  className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 -m-2 p-2 rounded-xl"
                >
                <div className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-medium shrink-0">
                  {initials(c.first_name, c.last_name)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{fullName}</span>
                    {c.email && accountEmails.has(c.email.toLowerCase()) ? (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-success-soft text-success-soft-foreground">
                        Account
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning-soft text-warning-soft-foreground">
                        No account
                      </span>
                    )}
                    {c.email && leadEmails.has(c.email.toLowerCase()) && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning-soft text-warning-soft-foreground" title="Started a booking but never completed it">
                        Lead · abandoned booking
                      </span>
                    )}
                    {blockedEmails.has(c.email.toLowerCase()) && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive-soft text-destructive-soft-foreground inline-flex items-center gap-1">
                        <Ban className="h-2.5 w-2.5" /> Blocked
                      </span>
                    )}
                    {isImportedOnly ? (
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${c.invited_at ? "bg-success-soft text-success-soft-foreground" : "bg-secondary text-muted-foreground"}`}>
                        {c.invited_at ? "Invited" : "Imported"}
                      </span>
                    ) : (
                      <>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor(c.last_appt!.status)}`}>
                          {c.last_appt!.status.replace("_", " ")}
                        </span>
                        {c.appt_count > 1 && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {c.appt_count} visits
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {c.email}{c.phone ? ` · ${c.phone}` : ""}
                  </div>
                  {c.last_appt && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      Last: {c.last_appt.service_name} · {format(new Date(c.last_appt.start_at), "MMM d, yyyy")}
                    </div>
                  )}
                </div>
                </Link>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Link to={newApptUrl(c)}>
                    <Button variant="outline" size="sm" className="rounded-full gap-1.5">
                      <CalendarPlus className="h-3.5 w-3.5" /> Book
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="rounded-full px-2">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {c.last_appt && (
                        <DropdownMenuItem asChild>
                          <Link to={`/staff/appointments/${c.last_appt.id}`}>
                            View last appointment
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={!c.email || sendingEmail === c.email}
                        onClick={() => sendInvite({ first_name: c.first_name, email: c.email }, c.imported_id ?? undefined)}
                      >
                        {sendingEmail === c.email ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <UserPlus className="h-3.5 w-3.5 mr-2" />}
                        {c.invited_at ? "Re-send invite" : "Send activation invite"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {blockedEmails.has(c.email.toLowerCase()) ? (
                        <DropdownMenuItem
                          disabled={busyEmail === c.email}
                          onClick={() => unblockClient(c.email)}
                        >
                          <ShieldOff className="h-3.5 w-3.5 mr-2" /> Unblock client
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          disabled={!c.email || busyEmail === c.email}
                          onClick={() => blockClient({ email: c.email, first_name: c.first_name, last_name: c.last_name })}
                          className="text-destructive-soft-foreground focus:text-destructive-soft-foreground"
                        >
                          <Ban className="h-3.5 w-3.5 mr-2" /> Block from booking
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={busyEmail === c.email}
                        onClick={() => deleteClient({ email: c.email, first_name: c.first_name, last_name: c.last_name, imported_id: c.imported_id })}
                        className="text-destructive focus:text-destructive text-destructive-soft-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete client
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setImportPreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import clients from CSV</DialogTitle>
            <DialogDescription>
              CSV must include <code>first_name</code>, <code>last_name</code>, and <code>email</code>. <code>phone</code>, <code>dob</code>, and <code>gender</code> are optional and imported when present. Rows missing a name or valid email are skipped. Duplicate emails are de-duplicated; re-importing the same email updates the existing record.
            </DialogDescription>
          </DialogHeader>

          {!importPreview ? (
            <div className="py-4">
              <Input type="file" accept=".csv,text/csv" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) onFile(f);
              }} />
            </div>
          ) : (
            <div className="py-2 text-sm">
              <p className="mb-2">
                Ready to import <strong>{importPreview.rows.length}</strong> client{importPreview.rows.length === 1 ? "" : "s"}.
                {importPreview.duplicates > 0 && <> Removed {importPreview.duplicates} duplicate email row(s).</>}
                {importPreview.incomplete > 0 && <> Skipped {importPreview.incomplete} row(s) missing required fields.</>}
              </p>
              <div className="max-h-64 overflow-auto border border-border rounded-md text-xs">
                <table className="w-full">
                  <thead className="bg-secondary"><tr>
                    <th className="text-left p-2">Name</th><th className="text-left p-2">Email</th><th className="text-left p-2">Phone</th><th className="text-left p-2">DOB</th><th className="text-left p-2">Gender</th>
                  </tr></thead>
                  <tbody>
                    {importPreview.rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2">{r.first_name} {r.last_name}</td>
                        <td className="p-2">{r.email}</td>
                        <td className="p-2">{r.phone}</td>
                        <td className="p-2">{r.dob}</td>
                        <td className="p-2">{r.gender}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importPreview.rows.length > 50 && (
                  <div className="p-2 text-muted-foreground">…and {importPreview.rows.length - 50} more</div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setImportOpen(false); setImportPreview(null); }}>Cancel</Button>
            {importPreview && (
              <Button onClick={confirmImport} disabled={importing} className="gap-2">
                {importing && <Loader2 className="h-3 w-3 animate-spin" />}
                Import {importPreview.rows.length}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a new client profile in your aesthetic EMR records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">First Name *</label>
                <Input
                  value={addClientDraft.first_name}
                  onChange={(e) => setAddClientDraft((d) => ({ ...d, first_name: e.target.value }))}
                  placeholder="Jane"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                <Input
                  value={addClientDraft.last_name}
                  onChange={(e) => setAddClientDraft((d) => ({ ...d, last_name: e.target.value }))}
                  placeholder="Doe"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email Address *</label>
              <Input
                type="email"
                value={addClientDraft.email}
                onChange={(e) => setAddClientDraft((d) => ({ ...d, email: e.target.value }))}
                placeholder="jane@example.com"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Phone Number (10 digits)</label>
                <Input
                  type="tel"
                  maxLength={10}
                  value={addClientDraft.phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setAddClientDraft((d) => ({ ...d, phone: digits }));
                  }}
                  placeholder="5550000000"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date of Birth</label>
                <Input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  min="1900-01-01"
                  value={addClientDraft.dob}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val) {
                      const parts = val.split("-");
                      if (parts[0] && parts[0].length > 4) {
                        parts[0] = parts[0].slice(0, 4);
                        val = parts.join("-");
                      }
                      const today = new Date().toISOString().slice(0, 10);
                      if (val > today) val = today;
                    }
                    setAddClientDraft((d) => ({ ...d, dob: val }));
                  }}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddClientOpen(false)} disabled={addClientBusy}>
              Cancel
            </Button>
            <Button onClick={handleAddClient} disabled={addClientBusy}>
              {addClientBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Create Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
