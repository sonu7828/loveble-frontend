import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, FileSignature, Download, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/usePageMeta";

type Row = {
  protocol_id: string;
  slug: string;
  title: string;
  category: string;
  version: number;
  renewal_months: number;
  summary: string | null;
  signature_id: string | null;
  signed_at: string | null;
  expires_at: string | null;
  pdf_path: string | null;
  status: "missing" | "current" | "expiring" | "expired" | "superseded";
};

const CATEGORY_LABELS: Record<string, string> = {
  injectable: "Injectables",
  device: "Devices & Energy",
  wellness: "Wellness / GLP-1",
  emergency: "Emergency",
  general: "General",
};

function statusBadge(s: Row["status"]) {
  switch (s) {
    case "current": return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Signed</Badge>;
    case "expiring": return <Badge className="bg-amber-100 text-amber-900 border-amber-200">Expiring</Badge>;
    case "expired": return <Badge className="bg-red-100 text-red-800 border-red-200">Expired</Badge>;
    case "superseded": return <Badge className="bg-blue-100 text-blue-800 border-blue-200">New version</Badge>;
    case "missing": return <Badge className="bg-red-100 text-red-800 border-red-200">Required</Badge>;
  }
}

type Tab = "todo" | "all" | "injectable" | "device" | "wellness" | "emergency" | "general";

export default function MyCompliance() {
  usePageMeta({ title: "My Compliance · Radiantilyk Aesthetic", description: "Sign and review your compliance protocols." });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>("todo");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: protocols } = await supabase
        .from("compliance_protocols")
        .select("id, slug, title, category, version, renewal_months, summary")
        .eq("is_active", true)
        .order("category")
        .order("title");

      const { data: sigs } = await supabase
        .from("compliance_signatures")
        .select("id, protocol_id, protocol_version, signed_at, expires_at, pdf_path, status")
        .eq("staff_user_id", user.id)
        .order("signed_at", { ascending: false });

      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const result: Row[] = (protocols ?? []).map((p) => {
        const sig = (sigs ?? []).find(
          (s) => s.protocol_id === p.id && s.protocol_version === p.version && s.status === "active",
        );
        let status: Row["status"] = "missing";
        if (sig) {
          if (sig.expires_at && new Date(sig.expires_at).getTime() < now) status = "expired";
          else if (sig.expires_at && new Date(sig.expires_at).getTime() - now < thirtyDays) status = "expiring";
          else status = "current";
        } else {
          const prior = (sigs ?? []).find((s) => s.protocol_id === p.id && s.protocol_version !== p.version);
          if (prior) status = "superseded";
        }
        return {
          protocol_id: p.id, slug: p.slug, title: p.title, category: p.category,
          version: p.version, renewal_months: p.renewal_months, summary: p.summary,
          signature_id: sig?.id ?? null, signed_at: sig?.signed_at ?? null,
          expires_at: sig?.expires_at ?? null, pdf_path: sig?.pdf_path ?? null,
          status,
        };
      });

      const order = { missing: 0, expired: 1, superseded: 2, expiring: 3, current: 4 };
      result.sort((a, b) => order[a.status] - order[b.status] || a.title.localeCompare(b.title));
      setRows(result);
      setLoading(false);
    })();
  }, []);

  async function downloadPdf(r: Row) {
    if (!r.pdf_path) return;
    setDownloadingId(r.signature_id);
    const { data, error } = await supabase.storage
      .from("compliance-signatures")
      .createSignedUrl(r.pdf_path, 300);
    setDownloadingId(null);
    if (error || !data?.signedUrl) { toast.error("Could not generate download link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  const counts = {
    todo: rows.filter((r) => ["missing", "expired", "superseded"].includes(r.status)).length,
    expiring: rows.filter((r) => r.status === "expiring").length,
    current: rows.filter((r) => r.status === "current").length,
  };

  const categoriesPresent = useMemo(() => {
    const set = new Set(rows.map((r) => r.category));
    return (["injectable", "device", "wellness", "emergency", "general"] as const).filter((c) => set.has(c));
  }, [rows]);

  const visible = useMemo(() => {
    if (tab === "todo") return rows.filter((r) => ["missing", "expired", "superseded", "expiring"].includes(r.status));
    if (tab === "all") return rows;
    return rows.filter((r) => r.category === tab);
  }, [rows, tab]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "todo", label: "Action needed", count: counts.todo + counts.expiring },
    { key: "all", label: "All", count: rows.length },
    ...categoriesPresent.map((c) => ({ key: c as Tab, label: CATEGORY_LABELS[c] ?? c })),
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">My Compliance</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Sign the protocols that apply to what you provide. Your signature is legally binding under E-SIGN/UETA.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card><CardContent className="p-3 sm:p-4"><div className="text-xl sm:text-2xl font-semibold">{counts.todo}</div><div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide leading-tight">To sign</div></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4"><div className="text-xl sm:text-2xl font-semibold">{counts.expiring}</div><div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide leading-tight">Expiring 30d</div></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4"><div className="text-xl sm:text-2xl font-semibold">{counts.current}</div><div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide leading-tight">Current</div></CardContent></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"
            }`}
          >
            {t.label}{t.count != null && <span className="opacity-70 ml-1">({t.count})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : visible.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {tab === "todo" ? "🎉 You're all caught up — nothing to sign right now." : "Nothing here."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const open = expanded[r.protocol_id];
            const urgent = r.status === "missing" || r.status === "expired" || r.status === "superseded";
            return (
              <Card
                key={r.protocol_id}
                className={urgent ? "border-red-200" : r.status === "expiring" ? "border-amber-200" : ""}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm sm:text-base font-medium">
                        {r.category === "emergency" && <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />}
                        <span className="truncate">{r.title}</span>
                      </div>
                      <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                        {r.signed_at
                          ? <>Signed {new Date(r.signed_at).toLocaleDateString()}{r.expires_at && <> · expires {new Date(r.expires_at).toLocaleDateString()}</>}</>
                          : <>Renews every {r.renewal_months} mo</>}
                      </div>
                    </div>
                    <div className="shrink-0">{statusBadge(r.status)}</div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    {(urgent || r.status === "expiring") ? (
                      <Button asChild size="sm" className="h-8">
                        <Link to={`/staff/compliance/sign/${r.protocol_id}`}>
                          <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                          {r.status === "missing" ? "Sign now" : "Re-sign"}
                        </Link>
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Current
                      </span>
                    )}
                    {r.pdf_path && (
                      <Button variant="outline" size="sm" onClick={() => downloadPdf(r)} disabled={downloadingId === r.signature_id} className="h-8">
                        {downloadingId === r.signature_id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                        PDF
                      </Button>
                    )}
                    {r.summary && (
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [r.protocol_id]: !open }))}
                        className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {open ? <>Hide details <ChevronUp className="h-3 w-3" /></> : <>Details <ChevronDown className="h-3 w-3" /></>}
                      </button>
                    )}
                  </div>

                  {open && r.summary && (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-3 pt-3 border-t border-border whitespace-pre-line">
                      {r.summary}
                    </p>
                  )}
                  {r.signature_id && !r.pdf_path && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> PDF generating — refresh in a moment
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
