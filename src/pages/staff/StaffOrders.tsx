import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pill, Activity, Stethoscope, ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function StaffOrders() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const activeTab = sp.get("tab") || "rx";

  const handleTabChange = (val: string) => {
    setSp({ tab: val });
  };

  const [orders, setOrders] = useState<any[]>([]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/staff/today")} className="h-7 px-2 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Dashboard
            </Button>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 font-medium text-[10px]">
              Prescriptions & Orders
            </Badge>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium tracking-tight">Orders & Prescription Approvals</h1>
          <p className="text-xs text-muted-foreground">
            Authorize prescription requests, topical compounds, and diagnostic lab & imaging order requisitions.
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex w-full overflow-x-auto justify-start bg-muted/60 p-1 rounded-xl gap-1 border border-border no-scrollbar">
          <TabsTrigger value="rx" className="gap-2 text-xs rounded-lg whitespace-nowrap shrink-0">
            <Pill className="h-3.5 w-3.5" /> Prescription Approvals (0)
          </TabsTrigger>
          <TabsTrigger value="labs" className="gap-2 text-xs rounded-lg whitespace-nowrap shrink-0">
            <Activity className="h-3.5 w-3.5" /> Lab & Imaging Orders (0)
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Prescription Approvals */}
        <TabsContent value="rx" className="mt-6">
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <Pill className="h-4 w-4 text-amber-600" /> Prescription Approval Queue
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Topical scripts, oral medications, and compounding refills submitted for authorization.</p>
              </div>
              <Badge variant="outline" className="text-[10px]">0 Pending Rx</Badge>
            </div>

            <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
              <Pill className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-medium text-foreground">No pending prescription authorizations.</p>
              <p className="text-[11px] text-muted-foreground">Prescription requests from clinical staff will appear here with Approve and Reject actions.</p>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Lab & Imaging Orders */}
        <TabsContent value="labs" className="mt-6">
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <Activity className="h-4 w-4 text-sky-600" /> Lab & Diagnostic Imaging Requisitions
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Blood chemistry panels, thyroid screens, and diagnostic imaging requisitions.</p>
              </div>
              <Badge variant="outline" className="text-[10px]">0 Pending Labs</Badge>
            </div>

            <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
              <Activity className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-medium text-foreground">No pending lab or imaging orders.</p>
              <p className="text-[11px] text-muted-foreground">Lab requisitions submitted for patient workups will display here.</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
