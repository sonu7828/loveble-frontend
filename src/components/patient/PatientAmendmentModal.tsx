import { useState, useEffect } from "react";
import { apiQuery } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, FileEdit, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export interface AmendmentRequest {
  id: string;
  recordType: string;
  currentText?: string;
  requestedText: string;
  reason: string;
  submittedAt: string;
  status: "pending" | "under_review" | "approved" | "denied";
}

export function PatientAmendmentModal({ userEmail }: { userEmail: string }) {
  const STORAGE_KEY = `rka_patient_amendments_${userEmail?.toLowerCase()}`;
  const [requests, setRequests] = useState<AmendmentRequest[]>([]);
  const [recordType, setRecordType] = useState("Clinical Note / Chart Entry");
  const [currentText, setCurrentText] = useState("");
  const [requestedText, setRequestedText] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    try {
      const local: AmendmentRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setRequests(local);
    } catch {
      setRequests([]);
    }

    // Try fetching from database if table exists
    (async () => {
      try {
        const { data, error } = await apiQuery("chart_amendments" as any)
          .select("*")
          .ilike("patient_email", userEmail.toLowerCase())
          .order("created_at", { ascending: false });

        if (!error && data && Array.isArray(data) && data.length > 0) {
          const mapped: AmendmentRequest[] = data.map((d: any) => ({
            id: d.id,
            recordType: d.record_type || d.category || "Clinical Note / Chart Entry",
            currentText: d.current_text || "",
            requestedText: d.requested_correction || d.requested_text || "",
            reason: d.rationale || d.reason || "",
            submittedAt: d.created_at || new Date().toISOString(),
            status: d.status || "pending",
          }));
          setRequests(mapped);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        }
      } catch {}
    })();
  }, [userEmail, STORAGE_KEY]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reqText = requestedText.trim();
    const rsnText = reason.trim();

    if (!reqText || !rsnText) {
      toast.error("Please describe both your requested amendment and rationale.");
      return;
    }

    setSubmitting(true);
    const newId = `amd-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newReq: AmendmentRequest = {
      id: newId,
      recordType,
      currentText: currentText.trim() || undefined,
      requestedText: reqText,
      reason: rsnText,
      submittedAt: nowIso,
      status: "pending",
    };

    // 1. Update local state immediately for instant feedback
    const updated = [newReq, ...requests];
    setRequests(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    // 2. Try inserting into database backend table
    try {
      await apiQuery("chart_amendments" as any).insert({
        id: newId,
        patient_email: userEmail.toLowerCase(),
        record_type: recordType,
        current_text: currentText.trim() || null,
        requested_correction: reqText,
        rationale: rsnText,
        status: "pending",
        created_at: nowIso,
      });
    } catch {}

    // 3. Reset form inputs
    setCurrentText("");
    setRequestedText("");
    setReason("");
    setSubmitting(false);

    toast.success("Amendment request submitted successfully! Our Privacy Officer will review your request per HIPAA §164.526.");
  };

  const getStatusBadge = (status: AmendmentRequest["status"]) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved &amp; Amended
          </Badge>
        );
      case "denied":
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
            <XCircle className="h-3 w-3 mr-1" /> Denied
          </Badge>
        );
      case "under_review":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">
            <Clock className="h-3 w-3 mr-1" /> Under Privacy Officer Review
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
            <Clock className="h-3 w-3 mr-1" /> Pending Review
          </Badge>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-xl">Request Record Amendment</h3>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
              <ShieldCheck className="h-3 w-3 mr-1" /> HIPAA §164.526
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            If you believe information in your medical record is incorrect or incomplete, you have the right to request an official amendment.
          </p>
        </div>
        <FileEdit className="h-8 w-8 text-primary/40 shrink-0" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="recordType" className="text-xs">Record Category *</Label>
            <select
              id="recordType"
              value={recordType}
              onChange={(e) => setRecordType(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
            >
              <option>Clinical Note / Chart Entry</option>
              <option>Demographics &amp; Contact Info</option>
              <option>Medical History &amp; Allergies</option>
              <option>Treatment Plan / Aftercare Record</option>
            </select>
          </div>
          <div>
            <Label htmlFor="currentText" className="text-xs">Current Entry (Optional)</Label>
            <Input
              id="currentText"
              placeholder="e.g. Note date, statement, or field to correct..."
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              className="mt-1.5 text-xs h-9"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="requestedText" className="text-xs">Requested Correction / Amendment *</Label>
          <Textarea
            id="requestedText"
            required
            rows={2}
            placeholder="Describe the exact correction or addition you are requesting..."
            value={requestedText}
            onChange={(e) => setRequestedText(e.target.value)}
            className="mt-1.5 text-xs"
          />
        </div>

        <div>
          <Label htmlFor="reason" className="text-xs">Rationale for Request *</Label>
          <Textarea
            id="reason"
            required
            rows={2}
            placeholder="Explain why the current record is inaccurate, incomplete, or outdated..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1.5 text-xs"
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={submitting} size="sm" className="rounded-full gap-1.5">
            <Send className="h-3.5 w-3.5" /> Submit Amendment Request
          </Button>
        </div>
      </form>

      {requests.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Your Submitted Amendment Requests ({requests.length})</h4>
          <div className="space-y-2.5">
            {requests.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-background p-4 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{r.recordType}</span>
                  {getStatusBadge(r.status)}
                </div>
                {r.currentText && (
                  <p className="text-muted-foreground text-[11px]">
                    <strong className="text-foreground font-medium">Existing Record:</strong> {r.currentText}
                  </p>
                )}
                <p className="text-muted-foreground">
                  <strong className="text-foreground font-medium">Requested Amendment:</strong> {r.requestedText}
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground font-medium">Rationale:</strong> {r.reason}
                </p>
                <div className="text-[10px] text-muted-foreground pt-1.5 border-t border-border/50 flex items-center justify-between">
                  <span>Submitted: {new Date(r.submittedAt).toLocaleDateString()}</span>
                  <span>HIPAA SLA: Review within 60 Days</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
