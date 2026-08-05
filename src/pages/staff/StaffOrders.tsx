import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Pill, ArrowLeft, Check, X, CheckCircle2, FileCheck, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getDynamicProfileName } from "@/lib/userProfile";
import { MdSignatureBoard } from "@/components/clinical/MdSignatureBoard";

export interface PrescriptionOrder {
  id: string;
  patient: string;
  client_email?: string;
  prescriber: string;
  type: string;
  detail: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  signed_by?: string;
  signed_at?: string;
}

export const INITIAL_DEMO_ORDERS: PrescriptionOrder[] = [
  {
    id: "ord-01",
    patient: "Rajnandani Sinnghaniya",
    client_email: "rajnandani@gmail.com",
    prescriber: "Kiem Vukadinovic, NP",
    type: "Topical Script",
    detail: "Hydroquinone 4% + Tretinoin 0.05% Custom Cream",
    date: "Today",
    status: "pending",
  },
  {
    id: "ord-02",
    patient: "Tony Stark",
    client_email: "tony@stark.com",
    prescriber: "Thomas, NP",
    type: "Prophylactic Script",
    detail: "Valacyclovir 500mg PO BID x 3 days (Post-Lip Filler)",
    date: "Today",
    status: "pending",
  },
];

export function getStoredOrders(): PrescriptionOrder[] {
  try {
    const raw = localStorage.getItem("rka_demo_prescription_orders");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem("rka_demo_prescription_orders", JSON.stringify(INITIAL_DEMO_ORDERS));
    return INITIAL_DEMO_ORDERS;
  } catch {
    return INITIAL_DEMO_ORDERS;
  }
}

export function saveStoredOrders(orders: PrescriptionOrder[]) {
  try {
    localStorage.setItem("rka_demo_prescription_orders", JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent("rka_orders_updated"));
  } catch (e) {
    console.warn("Failed to save stored prescription orders", e);
  }
}

export default function StaffOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mdName = getDynamicProfileName(user, "Medical Director") + " (MD)";

  const [orders, setOrders] = useState<PrescriptionOrder[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [signingOrder, setSigningOrder] = useState<PrescriptionOrder | null>(null);
  const [signatureText, setSignatureText] = useState<string>("");
  const [signaturePng, setSignaturePng] = useState<string>("");
  const [signingBusy, setSigningBusy] = useState(false);

  const loadOrders = () => {
    setOrders(getStoredOrders());
  };

  useEffect(() => {
    loadOrders();
    const handleUpdate = () => loadOrders();
    window.addEventListener("rka_orders_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("rka_orders_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const handleApproveClick = (ord: PrescriptionOrder) => {
    setSigningOrder(ord);
    setSignatureText(mdName);
  };

  const confirmSigning = () => {
    if (!signingOrder || !signatureText.trim()) return;
    setSigningBusy(true);

    const sig = signatureText.trim();
    const updated = orders.map((o) =>
      o.id === signingOrder.id
        ? {
            ...o,
            status: "approved" as const,
            signed_by: sig,
            signed_at: new Date().toISOString(),
          }
        : o
    );

    saveStoredOrders(updated);
    setOrders(updated);
    setSigningBusy(false);
    setSigningOrder(null);
    toast.success(`Prescription authorized & e-signed by ${sig}!`);
  };

  const handleRejectClick = (id: string) => {
    const updated = orders.map((o) => (o.id === id ? { ...o, status: "rejected" as const } : o));
    saveStoredOrders(updated);
    setOrders(updated);
    toast.error("Prescription request rejected");
  };

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const approvedOrders = orders.filter((o) => o.status === "approved");

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/staff/today")} className="h-7 px-2 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Dashboard
            </Button>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 font-medium text-[10px]">
              Prescription Governance
            </Badge>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium tracking-tight">Prescription Approvals & E-Signature</h1>
          <p className="text-xs text-muted-foreground">
            Authorize prescription requests, topical compound scripts, and medication refills submitted by clinical staff.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "pending" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Pending ({pendingOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "approved" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Approved & E-Signed ({approvedOrders.length})
          </button>
        </div>
      </div>

      {/* Main Prescription Approval Card */}
      <Card className="p-5 border border-border bg-card shadow-2xs space-y-4 rounded-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-serif text-lg font-medium tracking-tight flex items-center gap-2">
              <Pill className="h-4.5 w-4.5 text-amber-600" /> {activeTab === "pending" ? "Pending Prescription Authorizations" : "Approved & E-Signed Prescriptions"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Topical compounds, skin treatment scripts, and oral medications requiring Medical Director authorization.</p>
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold">
            {activeTab === "pending" ? `${pendingOrders.length} Pending` : `${approvedOrders.length} Approved`}
          </Badge>
        </div>

        {activeTab === "pending" ? (
          pendingOrders.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
              <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto" />
              <p className="text-xs font-semibold text-foreground">No pending prescription authorizations.</p>
              <p className="text-[11px] text-muted-foreground">Prescription requests submitted by clinical injectors will appear here for review and e-signature.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((ord) => (
                <div key={ord.id} className="p-4 rounded-xl border border-border bg-card hover:border-amber-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]" variant="outline">
                        {ord.type || "Prescription"}
                      </Badge>
                      <span className="font-semibold text-foreground text-sm">{ord.detail}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Patient: <strong className="text-foreground">{ord.patient}</strong> • Prescribed by {ord.prescriber} • {ord.date}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10 px-3 font-medium" onClick={() => handleRejectClick(ord.id)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                    <Button size="sm" className="h-8 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 font-medium shadow-2xs" onClick={() => handleApproveClick(ord)}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve & E-Sign
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : approvedOrders.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
            <Pill className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-semibold text-foreground">No approved prescription records on file.</p>
            <p className="text-[11px] text-muted-foreground">Approved scripts will display here with Supervising Physician e-signatures.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvedOrders.map((ord) => (
              <div key={ord.id} className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-emerald-500/20 text-emerald-800 border-emerald-500/30 text-[10px] uppercase font-bold" variant="outline">
                      <ShieldCheck className="h-3 w-3 mr-1" /> E-Signed & Authorized
                    </Badge>
                    <span className="font-semibold text-foreground text-sm">{ord.detail}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Patient: <strong className="text-foreground">{ord.patient}</strong> • Prescribed by {ord.prescriber}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    Authorized by: {ord.signed_by || mdName} {ord.signed_at ? `on ${new Date(ord.signed_at).toLocaleString()}` : ""}
                  </div>
                </div>

                <Badge variant="outline" className="bg-emerald-600 text-white border-0 text-xs px-3 py-1 font-semibold">
                  Authorized Script
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* E-Signature Modal Dialog */}
      <Dialog open={!!signingOrder} onOpenChange={(open) => !open && setSigningOrder(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" /> Confirm Prescription Authorization
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review prescription details below and sign on the signature board using mouse, touchpad, or stylus.
            </DialogDescription>
          </DialogHeader>

          {signingOrder && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <div className="font-semibold text-sm text-foreground">{signingOrder.detail}</div>
                <div>Patient: <strong>{signingOrder.patient}</strong></div>
                <div>Prescribing Clinician: {signingOrder.prescriber}</div>
                <div>Script Category: {signingOrder.type}</div>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-emerald-600" /> Supervising Physician Attestation
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  "I have reviewed the clinical necessity for this medication request and hereby authorize & e-sign this prescription under California Medical Board guidelines."
                </p>
              </div>

              {/* Interactive Touchpad / Mouse / Stylus Signature Board */}
              <MdSignatureBoard
                directorName={mdName}
                accentColor="emerald"
                onSignatureComplete={({ name, signaturePng }) => {
                  setSignatureText(name);
                  setSignaturePng(signaturePng);
                }}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSigningOrder(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs"
              onClick={confirmSigning}
              disabled={!signatureText.trim() || signingBusy}
            >
              {signingBusy ? "Signing..." : "Confirm & E-Sign Prescription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
