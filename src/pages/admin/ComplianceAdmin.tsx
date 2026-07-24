import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, X, Clock, Download, Mail } from "lucide-react";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";

type Protocol = { id: string; slug: string; title: string; category: string; version: number; renewal_months: number };
type Staff = { id: string; user_id: string | null; full_name: string; title: string | null };
type Sig = { id: string; protocol_id: string; protocol_version: number; staff_id: string; status: string; signed_at: string; expires_at: string | null; pdf_path: string | null };

export default function ComplianceAdmin() {
  usePageMeta({ title: "Compliance Admin · Radiantilyk Aesthetic" });
  const [loading, setLoading] = useState(true);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [sigs, setSigs] = useState<Sig[]>([]);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: s }, { data: sg }] = await Promise.all([
      supabase.from("compliance_protocols").select("id, slug, title, category, version, renewal_months").eq("is_active", true).order("category").order("title"),
      supabase.from("staff_profiles").select("id, user_id, full_name, title").not("user_id", "is", null).order("full_name"),
      supabase.from("compliance_signatures").select("id, protocol_id, protocol_version, staff_id, status, signed_at, expires_at, pdf_path"),
    ]);
    setProtocols((p ?? []) as Protocol[]);
    setStaff((s ?? []) as Staff[]);
    setSigs((sg ?? []) as Sig[]);
    setLoading(false);
  }

  function cellFor(staffId: string, protocol: Protocol) {
    const sig = sigs.find((x) => x.staff_id === staffId && x.protocol_id === protocol.id && x.protocol_version === protocol.version && x.status === "active");
    if (!sig) return { kind: "missing" as const };
    if (sig.expires_at && new Date(sig.expires_at).getTime() < Date.now()) return { kind: "expired" as const, sig };
    return { kind: "signed" as const, sig };
  }

  async function downloadPdf(sig: Sig) {
    if (!sig.pdf_path) { toast.error("PDF not generated yet"); return; }
    const { data } = await supabase.storage.from("compliance-signatures").createSignedUrl(sig.pdf_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function nudgeStaff(s: Staff) {
    toast.info(`Reminder queued for ${s.full_name}`);
    // Future: trigger SMS/email via edge function
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const summary = {
    totalRequired: protocols.length * staff.length,
    signed: sigs.filter((s) => s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now())).length,
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compliance Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">{summary.signed} of {summary.totalRequired} required signatures current.</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/staff/compliance">My Compliance</Link></Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Per-staff signature matrix</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 sticky left-0 bg-muted/40 z-10 min-w-[180px]">Staff</th>
                {protocols.map((p) => (
                  <th key={p.id} className="text-left p-3 font-medium min-w-[140px]">
                    <div className="text-xs leading-tight">{p.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">v{p.version}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 sticky left-0 bg-background z-10 border-r">
                    <div className="font-medium">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground">{s.title || "—"}</div>
                    <Button variant="ghost" size="sm" className="h-7 px-2 mt-1 text-xs" onClick={() => nudgeStaff(s)}>
                      <Mail className="h-3 w-3 mr-1" /> Remind
                    </Button>
                  </td>
                  {protocols.map((p) => {
                    const c = cellFor(s.id, p);
                    return (
                      <td key={p.id} className="p-3 align-top">
                        {c.kind === "signed" && (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" /><span className="text-xs">Signed</span></div>
                            <div className="text-[10px] text-muted-foreground">{new Date(c.sig.signed_at).toLocaleDateString()}</div>
                            {c.sig.pdf_path && (
                              <button onClick={() => downloadPdf(c.sig)} className="text-[10px] text-primary underline-offset-2 hover:underline flex items-center gap-1">
                                <Download className="h-3 w-3" /> PDF
                              </button>
                            )}
                          </div>
                        )}
                        {c.kind === "expired" && (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-amber-700"><Clock className="h-4 w-4" /><span className="text-xs">Expired</span></div>
                            <div className="text-[10px] text-muted-foreground">{c.sig.expires_at ? new Date(c.sig.expires_at).toLocaleDateString() : ""}</div>
                          </div>
                        )}
                        {c.kind === "missing" && (
                          <div className="flex items-center gap-1 text-red-600"><X className="h-4 w-4" /><span className="text-xs">Not signed</span></div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Protocol library</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {protocols.map((p) => {
            const signedCount = sigs.filter((s) => s.protocol_id === p.id && s.protocol_version === p.version && s.status === "active").length;
            return (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.category} · v{p.version} · renews every {p.renewal_months} mo · signed by {signedCount}/{staff.length}</div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

