import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, FileEdit, Send, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

interface AmendmentRequest {
  id: string;
  recordType: string;
  requestedText: string;
  reason: string;
  submittedAt: string;
  status: "pending" | "under_review" | "approved" | "denied";
}

export function PatientAmendmentModal({ userEmail }: { userEmail: string }) {
  const STORAGE_KEY = `rka_patient_amendments_${userEmail?.toLowerCase()}`;
  const [requests, setRequests] = useState<AmendmentRequest[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [recordType, setRecordType] = useState("Clinical Note / Chart Entry");
  const [currentText, setCurrentText] = useState("");
  const [requestedText, setRequestedText] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedText.trim() || !reason.trim()) {
      toast.error("Please provide both the requested amendment and rationale.");
      return;
    }
    setSubmitting(true);

    const newReq: AmendmentRequest = {
      id: `amd-${Date.now()}`,
      recordType,
      requestedText: requestedText.trim(),
      reason: reason.trim(),
      submittedAt: new Date().toISOString(),
      status: "pending",
    };

    const updated = [newReq, ...requests];
    setRequests(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    setSubmitting(false);
    setCurrentText("");
    setRequestedText("");
    setReason("");
    toast.success("Amendment request submitted! Our Privacy Officer will review within 60 days per HIPAA §164.526.");
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
            If you believe information in your medical record is incorrect or incomplete, you have the right to request an amendment.
          </p>
        </div>
        <FileEdit className="h-8 w-8 text-primary/40 shrink-0" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="recordType" className="text-xs">Record Category</Label>
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
              placeholder="e.g. Existing note date or statement..."
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              className="mt-1.5 text-xs h-9"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="requestedText" className="text-xs">Requested Correction / Amendment</Label>
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
          <Label htmlFor="reason" className="text-xs">Rationale for Request</Label>
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
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Your Submitted Requests</h4>
          <div className="space-y-2.5">
            {requests.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-background p-3.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{r.recordType}</span>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                    <Clock className="h-3 w-3 mr-1" /> Pending Review
                  </Badge>
                </div>
                <p className="text-muted-foreground"><strong className="text-foreground">Requested:</strong> {r.requestedText}</p>
                <p className="text-muted-foreground"><strong className="text-foreground">Reason:</strong> {r.reason}</p>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                  Submitted: {new Date(r.submittedAt).toLocaleDateString()} · Privacy Officer SLA: 60 Days
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
