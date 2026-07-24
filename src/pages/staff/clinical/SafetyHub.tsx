import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ShieldAlert, AlertOctagon, Eye, Activity, Bug, Droplet, Sparkles, ThermometerSun,
  Syringe, HeartPulse, Printer, FileText, Search,
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

const PROTOCOL_META: Record<string, { icon: any; tone: string; tag: string }> = {
  "complication-vascular-occlusion":   { icon: AlertOctagon, tone: "text-red-600",    tag: "EMERGENCY" },
  "complication-blindness-vision-change": { icon: Eye,       tone: "text-red-600",    tag: "EMERGENCY · 911" },
  "complication-anaphylaxis":          { icon: HeartPulse,   tone: "text-red-600",    tag: "EMERGENCY · 911" },
  "complication-vasovagal-syncope":    { icon: Activity,     tone: "text-amber-600",  tag: "Acute" },
  "complication-delayed-nodules":      { icon: Sparkles,     tone: "text-amber-600",  tag: "Delayed" },
  "complication-biofilm-infection":    { icon: Bug,          tone: "text-amber-600",  tag: "Infection" },
  "complication-tyndall-effect":       { icon: Droplet,      tone: "text-sky-600",    tag: "Aesthetic" },
  "complication-bruising-hematoma":    { icon: Syringe,      tone: "text-sky-600",    tag: "Common" },
  "complication-hsv-reactivation":     { icon: ThermometerSun, tone: "text-amber-600", tag: "Reactivation" },
};

type Protocol = {
  id: string; slug: string; title: string; current_version_id: string | null;
  version: { indication: string | null; patient_handout_md: string | null; regulatory_basis: string | null; signed_by_name: string | null; signed_at: string | null; version_number: number } | null;
};

export default function SafetyHub() {
  usePageMeta({ title: "Adverse Events & Safety · Staff" });
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [openVo, setOpenVo] = useState<any[]>([]);
  const [openAe, setOpenAe] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: ps } = await supabase
        .from("clinical_protocols")
        .select("id, slug, title, current_version_id")
        .like("slug", "complication-%")
        .order("title");
      const versionIds = (ps ?? []).map((p: any) => p.current_version_id).filter(Boolean);
      const { data: vs } = versionIds.length
        ? await supabase.from("clinical_protocol_versions")
            .select("id, indication, patient_handout_md, regulatory_basis, signed_by_name, signed_at, version_number")
            .in("id", versionIds)
        : { data: [] as any[] };
      const vMap = new Map((vs ?? []).map((v: any) => [v.id, v]));
      setProtocols((ps ?? []).map((p: any) => ({ ...p, version: vMap.get(p.current_version_id) ?? null })));

      const [{ data: vo }, { data: ae }] = await Promise.all([
        supabase.from("vo_protocol_runs").select("*").eq("status", "active").order("started_at", { ascending: false }),
        supabase.from("adverse_events").select("*").in("outcome", ["ongoing", "improving"]).order("event_date", { ascending: false }).limit(20),
      ]);
      setOpenVo(vo ?? []);
      setOpenAe(ae ?? []);
    })();
  }, []);

  const filtered = useMemo(
    () => protocols.filter(p => !q || p.title.toLowerCase().includes(q.toLowerCase()) || (p.version?.indication ?? "").toLowerCase().includes(q.toLowerCase())),
    [protocols, q]
  );

  const printBinder = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Radiantilyk Aesthetic — Adverse Events & Safety Binder</title>
<style>
  body{font-family:Georgia,serif;color:#111;max-width:740px;margin:40px auto;padding:0 24px;line-height:1.5}
  h1{font-size:28px;border-bottom:2px solid #111;padding-bottom:8px}
  h2{font-size:20px;margin-top:36px;page-break-before:always;border-top:1px solid #999;padding-top:14px}
  h2:first-of-type{page-break-before:auto;border-top:0}
  h3{font-size:14px;margin-top:18px;text-transform:uppercase;letter-spacing:.04em;color:#333}
  ul{padding-left:22px} li{margin:4px 0}
  .meta{font-size:12px;color:#555;margin-bottom:8px}
  .sig{margin-top:60px;border-top:1px solid #111;padding-top:8px;font-size:12px}
  .cover{text-align:center;padding:60px 0}
  .cover h1{border:0;font-size:34px}
  .cover p{color:#444}
  .auth{font-size:11px;color:#555;margin-top:16px;font-style:italic}
  @media print { h2{page-break-before:always} }
</style></head><body>
<div class="cover">
  <h1>Adverse Events &amp; Safety</h1>
  <p style="font-size:18px">Complication Protocols — Injectables</p>
  <p>Radiantilyk Aesthetic · San Jose &amp; San Mateo</p>
  <p class="meta">Generated ${new Date().toLocaleDateString()}</p>
  <p class="auth">Authored by Kiem Vukadinovic, NP — Founder &amp; Nurse Practitioner.<br/>Medical Director: Dr. Fobi, MD — Supervising Physician.<br/>Aligned with CA Board of Registered Nursing standardized procedures (CCR §1474) and CA Medical Board guidance for medical spas.</p>
</div>
${protocols.map(p => `
  <h2>${p.title}</h2>
  <div class="meta">Version ${p.version?.version_number ?? 1} · Signed ${p.version?.signed_at ? new Date(p.version.signed_at).toLocaleDateString() : "—"} by ${p.version?.signed_by_name ?? "Kiem Vukadinovic, NP"}</div>
  ${(p.version?.patient_handout_md ?? "")
    .replace(/^## .+\n/, "")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^\*\*(.+?)\*\*\s*(.*)$/gm, "<p><strong>$1</strong> $2</p>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>")
    .replace(/^---$/gm, "<hr/>")
  }
  <div class="sig">
    Nurse Practitioner (Author): Kiem Vukadinovic, NP &nbsp;&nbsp; Signature: ______________________________ &nbsp; Date: ___________
    <br/><br/>
    Medical Director (Supervising Physician): Dr. Fobi, MD &nbsp;&nbsp; Signature: ______________________________ &nbsp; Date: ___________
  </div>
`).join("")}
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl flex items-center gap-2"><ShieldAlert className="h-7 w-7" /> Adverse Events &amp; Safety</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Board-aligned complication protocols, vascular-occlusion command center, and active adverse-event log.
            Authored by Kiem Vukadinovic, NP — Founder & Nurse Practitioner. Medical Director: Dr. Fobi, MD.
            Aligned with CA BRN standardized procedures (CCR §1474) and CA Medical Board guidance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/staff/clinical/adverse-events"><FileText className="h-4 w-4 mr-1.5" />AE log</Link></Button>
          <Button onClick={printBinder}><Printer className="h-4 w-4 mr-1.5" />Print safety binder</Button>
        </div>
      </header>

      {openVo.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2"><CardTitle className="text-base text-destructive">🚨 Active VO protocols ({openVo.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {openVo.map(r => (
              <Link key={r.id} to={`/staff/clinical/vo/${r.id}`} className="block p-3 rounded-md border border-destructive/40 hover:bg-destructive/5">
                <div className="font-medium">{r.client_first_name} {r.client_last_name}</div>
                <div className="text-xs text-muted-foreground">Started {new Date(r.started_at).toLocaleString()}{r.region && ` · ${r.region}`}{r.product_suspected && ` · ${r.product_suspected}`}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search protocols…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => {
          const meta = PROTOCOL_META[p.slug] ?? { icon: FileText, tone: "text-muted-foreground", tag: "" };
          const Icon = meta.icon;
          return (
            <Link key={p.id} to={p.current_version_id ? `/staff/clinical/protocols/${p.current_version_id}` : `/staff/clinical/protocols/history/${p.id}`} className="block rounded-2xl border bg-card p-4 hover:shadow-md transition">
              <div className="flex items-start gap-3">
                <Icon className={`h-6 w-6 mt-0.5 ${meta.tone}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium leading-tight">{p.title}</h3>
                    {meta.tag && <Badge variant={meta.tag.includes("EMERGENCY") ? "destructive" : "secondary"} className="text-[10px]">{meta.tag}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{p.version?.indication}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">v{p.version?.version_number ?? 1} · {p.version?.signed_by_name ?? "unsigned"}</p>
                </div>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">No matching protocols.</div>}
      </div>

      {openAe.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Open adverse events ({openAe.length})</CardTitle></CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {openAe.map(r => (
              <Link key={r.id} to={`/staff/clinical/clients/${encodeURIComponent(r.client_email)}`} className="block p-3 hover:bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{r.client_first_name} {r.client_last_name} <span className="text-muted-foreground font-normal">· {String(r.event_type).replace(/_/g," ")}</span></div>
                  <Badge variant={r.severity === "severe" || r.severity === "life_threatening" ? "destructive" : "outline"}>{String(r.severity).replace(/_/g," ")}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{new Date(r.event_date).toLocaleString()}{r.body_region && ` · ${r.body_region}`}{r.product_involved && ` · ${r.product_involved}`}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
