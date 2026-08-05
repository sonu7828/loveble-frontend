import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileCheck, FileText, Stethoscope, Search, RefreshCw, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clinicalService, CosignQueueItem } from "@/services/api/clinicalService";
import { useAuth } from "@/hooks/useAuth";

export default function StaffClinicalReviews() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { isNP, isMedicalDirector, loading: authLoading } = useAuth();
  const activeTab = sp.get("tab") || "pending";

  const handleTabChange = (val: string) => {
    setSp({ tab: val });
  };

  const [notes, setNotes] = useState<CosignQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await clinicalService.getCosignQueue();
      setNotes(data);
    } catch (e: any) {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchQueue();
  }, [authLoading]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/staff/today")} className="h-7 px-2 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Dashboard
            </Button>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 font-medium text-[10px]">
              Clinical Governance
            </Badge>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium tracking-tight">Clinical Reviews & Co-Signatures</h1>
          <p className="text-xs text-muted-foreground">
            Review and e-sign clinical chart notes, Good Faith Exams (GFE), and procedure notes submitted by RNs and NPs.
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full sm:w-auto justify-start bg-muted/60 p-1 rounded-xl gap-1 border border-border">
          <TabsTrigger value="pending" className="gap-2 text-xs rounded-lg">
            <FileText className="h-3.5 w-3.5" /> Pending Notes ({notes.length})
          </TabsTrigger>
          <TabsTrigger value="sign" className="gap-2 text-xs rounded-lg">
            <FileCheck className="h-3.5 w-3.5" /> Sign Notes ({notes.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Pending Notes */}
        <TabsContent value="pending" className="mt-6">
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-600" /> Pending Clinical Chart Notes
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Chart notes submitted by injectors requiring supervising physician review.</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{notes.length} Notes Pending</Badge>
            </div>

            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-medium">
                    <tr>
                      <th className="p-3">Patient Name</th>
                      <th className="p-3">Provider / Injector</th>
                      <th className="p-3">Procedure & Service</th>
                      <th className="p-3">Submitted Date</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : notes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FileCheck className="h-8 w-8 text-muted-foreground/40" />
                            <span className="font-medium text-xs text-foreground">No pending clinical notes to review.</span>
                            <span className="text-[11px] text-muted-foreground">Chart notes submitted by clinical staff will populate here for review.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      notes.map((item) => {
                        const noteId = item.note?.id || item.noteId;
                        const patientName = item.note?.patient ? `${item.note.patient.firstName} ${item.note.patient.lastName}` : (item.note?.patient?.email || "—");
                        const dateStr = item.requestedAt ? new Date(item.requestedAt).toLocaleDateString() : "—";
                        return (
                          <tr key={item.id} className="hover:bg-muted/30 transition">
                            <td className="p-3 font-semibold text-foreground">{patientName}</td>
                            <td className="p-3 text-muted-foreground">{item.author?.fullName || "RN Injector"}</td>
                            <td className="p-3 text-muted-foreground">SOAP Note</td>
                            <td className="p-3 text-muted-foreground">{dateStr}</td>
                            <td className="p-3 text-right">
                              <Button size="sm" asChild className="h-7 text-xs bg-purple-600 text-white hover:bg-purple-700">
                                <Link to={`/staff/clinical/notes/${noteId}`}>Review Note</Link>
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Sign Notes */}
        <TabsContent value="sign" className="mt-6">
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-purple-600" /> Sign Notes & E-Sign Queue
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Approved notes ready for final Medical Director electronic signature.</p>
              </div>
              <Badge variant="outline" className="text-[10px]">0 Notes to Sign</Badge>
            </div>

            <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
              <FileCheck className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-medium text-foreground">No notes awaiting signature.</p>
              <p className="text-[11px] text-muted-foreground">Approved clinical notes will queue here for batch e-signing.</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
