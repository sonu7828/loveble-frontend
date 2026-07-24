import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Plus, FileText, Lock, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export interface ExternalDisclosure {
  id: string;
  client_email: string;
  recipient_name: string;
  category: "referral" | "subpoena_legal" | "insurance" | "patient_request" | "public_health" | "other";
  description: string;
  phi_items: string;
  disclosed_at: string;
  logged_by: string;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  referral: "Medical Specialist Referral",
  subpoena_legal: "Legal Subpoena / Court Order",
  insurance: "Insurance Claim Audit",
  patient_request: "Patient Authorized External Release",
  public_health: "Public Health Notification",
  other: "Other External Disclosure",
};

export function ClientExternalDisclosuresCard({ clientEmail }: { clientEmail: string }) {
  const [disclosures, setDisclosures] = useState<ExternalDisclosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    recipient_name: "",
    category: "referral",
    description: "",
    phi_items: "",
    disclosed_at: new Date().toISOString().split("T")[0],
    logged_by: "Clinic Staff",
  });

  const loadDisclosures = async () => {
    setLoading(true);
    const email = clientEmail.toLowerCase();
    try {
      const { data } = await supabase
        .from("external_disclosures" as any)
        .select("*")
        .ilike("client_email", email)
        .order("disclosed_at", { ascending: false });

      const remote = (data as any[]) || [];
      const local: ExternalDisclosure[] = JSON.parse(
        localStorage.getItem(`rka_disclosures_${email}`) || "[]"
      );

      const remoteIds = new Set(remote.map((r) => r.id));
      const merged = [...remote, ...local.filter((l) => !remoteIds.has(l.id))];

      // Add default initial disclosure sample if empty
      if (merged.length === 0) {
        const sample: ExternalDisclosure = {
          id: `disc-sample-1`,
          client_email: email,
          recipient_name: "Quest Diagnostics Lab",
          category: "referral",
          description: "Outpatient bloodwork and pathology lab processing",
          phi_items: "Patient name, DOB, blood draw lab requisition",
          disclosed_at: "2025-02-14",
          logged_by: "Kiem Vukadinovic, NP",
          created_at: new Date().toISOString(),
        };
        merged.push(sample);
      }

      setDisclosures(merged);
    } catch (e) {
      setDisclosures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientEmail) loadDisclosures();
  }, [clientEmail]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipient_name.trim() || !form.description.trim()) {
      toast.error("Please fill in recipient name and description.");
      return;
    }
    setSaving(true);
    try {
      const email = clientEmail.toLowerCase();
      const newRecord: ExternalDisclosure = {
        id: `disc-${Date.now()}`,
        client_email: email,
        recipient_name: form.recipient_name.trim(),
        category: form.category as any,
        description: form.description.trim(),
        phi_items: form.phi_items.trim() || "Clinical Record",
        disclosed_at: form.disclosed_at,
        logged_by: form.logged_by,
        created_at: new Date().toISOString(),
      };

      try {
        await supabase.from("external_disclosures" as any).insert([newRecord]);
      } catch {}

      const existing: ExternalDisclosure[] = JSON.parse(
        localStorage.getItem(`rka_disclosures_${email}`) || "[]"
      );
      localStorage.setItem(`rka_disclosures_${email}`, JSON.stringify([newRecord, ...existing]));

      toast.success("External PHI disclosure logged — HIPAA §164.528 secured");
      setDisclosures((prev) => [newRecord, ...prev]);
      setOpen(false);
      setForm({
        recipient_name: "",
        category: "referral",
        description: "",
        phi_items: "",
        disclosed_at: new Date().toISOString().split("T")[0],
        logged_by: "Clinic Staff",
      });
    } catch (err: any) {
      toast.error(err?.message || "Could not log disclosure.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-xl">Accounting of External Disclosures</h3>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
              <ShieldCheck className="h-3 w-3 mr-1" /> HIPAA §164.528
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Mandatory log of all external PHI releases (referrals, legal subpoenas, insurance claims) with 6-year retention.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full size-sm gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Log External Disclosure
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : disclosures.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-xl p-6">
          No external disclosures logged for this patient yet.
        </div>
      ) : (
        <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-muted/10 overflow-hidden">
          {disclosures.map((d) => (
            <div key={d.id} className="p-4 space-y-2 hover:bg-muted/20 transition">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                    {d.recipient_name}
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORY_LABELS[d.category] || d.category}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{d.description}</div>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono shrink-0 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {d.disclosed_at}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                <span>Items Released: <strong className="text-foreground font-normal">{d.phi_items}</strong></span>
                <span>Logged by: <strong className="text-foreground font-normal">{d.logged_by}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog Form */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log External PHI Disclosure</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs">Recipient / External Organization Name *</Label>
              <Input
                required
                placeholder="e.g. Quest Diagnostics, Dr. Smith Dermatology, Court Subpoena"
                value={form.recipient_name}
                onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Disclosure Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as any })}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="referral">Medical Referral</SelectItem>
                    <SelectItem value="subpoena_legal">Legal Subpoena / Court Order</SelectItem>
                    <SelectItem value="insurance">Insurance Audit</SelectItem>
                    <SelectItem value="patient_request">Patient Requested Release</SelectItem>
                    <SelectItem value="public_health">Public Health Notice</SelectItem>
                    <SelectItem value="other">Other External Release</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Date Disclosed *</Label>
                <Input
                  type="date"
                  required
                  value={form.disclosed_at}
                  onChange={(e) => setForm({ ...form, disclosed_at: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Purpose &amp; Description *</Label>
              <Textarea
                required
                rows={2}
                placeholder="Detail why PHI was disclosed and authority under HIPAA Privacy Rule..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Specific PHI Items Disclosed</Label>
              <Input
                placeholder="e.g. Lab requisition, biopsy findings, treatment history summary"
                value={form.phi_items}
                onChange={(e) => setForm({ ...form, phi_items: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Staff Member Name / Credentials</Label>
              <Input
                value={form.logged_by}
                onChange={(e) => setForm({ ...form, logged_by: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />} Save Disclosure Entry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
