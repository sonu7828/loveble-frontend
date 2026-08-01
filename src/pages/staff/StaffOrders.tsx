import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pill, ArrowLeft, Check, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function StaffOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);

  const handleOrderAction = (id: string, action: "approve" | "reject") => {
    setOrders(prev => prev.filter(o => o.id !== id));
    toast.success(`Prescription ${action === "approve" ? "approved & e-signed" : "rejected"}`);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/staff/today")} className="h-7 px-2 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Dashboard
            </Button>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 font-medium text-[10px]">
              Prescription Governance
            </Badge>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium tracking-tight">Prescription Approvals</h1>
          <p className="text-xs text-muted-foreground">
            Authorize prescription requests, topical compound scripts, and medication refills submitted by clinical staff.
          </p>
        </div>
      </div>

      {/* Main Prescription Approval Card */}
      <Card className="p-5 border border-border bg-card shadow-2xs space-y-4 rounded-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-serif text-lg font-medium tracking-tight flex items-center gap-2">
              <Pill className="h-4.5 w-4.5 text-amber-600" /> Prescription Approval Queue
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Topical compounds, skin treatment scripts, and oral medications requiring Medical Director authorization.</p>
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold">{orders.length} Pending</Badge>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto" />
            <p className="text-xs font-semibold text-foreground">No pending prescription authorizations.</p>
            <p className="text-[11px] text-muted-foreground">Prescription requests submitted by clinical injectors will appear here for review and e-signature.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((ord) => (
              <div key={ord.id} className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]" variant="outline">
                      {ord.type || "Prescription"}
                    </Badge>
                    <span className="font-semibold text-foreground">{ord.detail}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Patient: <strong className="text-foreground">{ord.patient}</strong> • Prescribed by {ord.prescriber} • {ord.date}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2.5 font-medium" onClick={() => handleOrderAction(ord.id, "reject")}>
                    <X className="h-3.5 w-3.5 mr-1" /> Reject
                  </Button>
                  <Button size="sm" className="h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 font-medium" onClick={() => handleOrderAction(ord.id, "approve")}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Approve & Sign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
