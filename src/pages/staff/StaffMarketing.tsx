import { useEffect, useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Megaphone, Send, Users, Pencil, Plus, Pause, Play, Archive, ImageIcon, X, Upload, Eye, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Campaign = {
  id: string;
  slug: string;
  name: string;
  subject: string;
  preview_text: string | null;
  body_markdown: string;
  cta_label: string | null;
  cta_url: string | null;
  audience_type: "everyone" | "all_clients" | "lapsed" | "win_back" | "vip";
  audience_params: any;
  status: "draft" | "active" | "paused" | "archived";
  recurrence: "once" | "daily" | "weekly" | "monthly" | "every_3_weeks";
  cooldown_days: number;
  scheduled_at: string | null;
  last_run_at: string | null;
  created_at: string;
  hero_image_url: string | null;
};

const blank = (): Partial<Campaign> => ({
  name: "",
  slug: "",
  subject: "",
  preview_text: "",
  body_markdown: "Hi {{first_name}},\n\nWe'd love to see you again. Use code GLOW15 for 15% off your next visit through Sunday.\n\n- Neurotoxins\n- Filler refresh\n- HydraFacial\n\nWith warmth,\nThe RKA team",
  cta_label: "Book your visit",
  cta_url: "https://bookrka.com/book",
  audience_type: "win_back",
  audience_params: { days_from: 60, days_to: 120 },
  status: "draft",
  recurrence: "once",
  cooldown_days: 30,
});

export default function StaffMarketing() {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenImage, setAiGenImage] = useState(true);
  const [aiDrafting, setAiDrafting] = useState(false);

  const draftWithAi = async () => {
    if (!editing) return;
    if (!aiPrompt.trim()) { toast.error("Describe what you want the newsletter to be about"); return; }
    setAiDrafting(true);
    const { data, error } = await supabase.functions.invoke("ai-draft-newsletter", {
      body: { prompt: aiPrompt, generateImage: aiGenImage },
    });
    setAiDrafting(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "AI draft failed"); return; }
    setEditing(prev => prev ? {
      ...prev,
      subject: data.draft.subject || prev.subject,
      preview_text: data.draft.preview_text || prev.preview_text,
      body_markdown: data.draft.body_markdown || prev.body_markdown,
      cta_label: data.draft.cta_label || prev.cta_label,
      cta_url: data.draft.cta_url || prev.cta_url,
      hero_image_url: data.hero_image_url || prev.hero_image_url,
    } : prev);
    toast.success(aiGenImage && data.hero_image_url ? "Draft + image ready" : "Draft ready");
  };

  const uploadHero = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please pick an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user?.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("marketing-assets").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { setUploading(false); toast.error(error.message); return; }
    const { data } = supabase.storage.from("marketing-assets").getPublicUrl(path);
    setEditing(prev => prev ? { ...prev, hero_image_url: data.publicUrl } : prev);
    setUploading(false);
    toast.success("Image uploaded");
  };

  const refresh = async () => {
    const { data } = await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as Campaign[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  if (authLoading) return <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!user || !isAdmin) return <Navigate to="/staff/today" replace />;

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.slug || !editing.subject || !editing.body_markdown) {
      toast.error("Name, slug, subject, and body are required");
      return;
    }
    setSaving(true);
    const payload: any = {
      ...editing,
      slug: editing.slug!.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      audience_params: editing.audience_params || {},
    };
    const { error } = editing.id
      ? await supabase.from("marketing_campaigns").update(payload).eq("id", editing.id)
      : await supabase.from("marketing_campaigns").insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(null);
    refresh();
  };

  const setStatus = async (c: Campaign, status: Campaign["status"]) => {
    const { error } = await supabase.from("marketing_campaigns").update({ status }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const run = async (c: Campaign, dryRun: boolean) => {
    setRunning(c.id);
    const { data, error } = await supabase.functions.invoke("run-marketing-campaign", {
      body: { campaignId: c.id, dryRun },
    });
    setRunning(null);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Failed"); return; }
    if (dryRun) {
      toast.success(`${data.eligible} eligible (of ${data.audienceSize} in audience, ${data.skipped} on cooldown)`);
    } else {
      toast.success(`Sent ${data.sent} · skipped ${data.skipped}${data.errors ? ` · ${data.errors} errors` : ""}`);
      refresh();
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl flex items-center gap-2"><Megaphone className="h-6 w-6" /> Marketing</h1>
          <p className="text-sm text-muted-foreground mt-1">Win-back, seasonal promos, VIP perks. Daily cron sends recurring campaigns at 9am Pacific.</p>
        </div>
        <Button onClick={() => setEditing(blank())} className="rounded-full gap-1.5"><Plus className="h-4 w-4" /> New campaign</Button>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          No campaigns yet. Click <strong>New campaign</strong> to create your first win-back or seasonal promo.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(c => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-serif text-lg">{c.name}</h3>
                    <StatusBadge status={c.status} />
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {audienceLabel(c)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {c.recurrence}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">{c.subject}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Cooldown {c.cooldown_days}d · {c.last_run_at ? `last run ${format(new Date(c.last_run_at), "MMM d, h:mm a")}` : "never run"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setPreviewCampaign(c)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Preview email
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => run(c, true)} disabled={running === c.id}>
                    {running === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Users className="h-3.5 w-3.5 mr-1" />}
                    Preview audience
                  </Button>
                  <Button size="sm" onClick={() => run(c, false)} disabled={running === c.id || c.status === "archived"}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Send now
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  {c.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => setStatus(c, "paused")}><Pause className="h-3.5 w-3.5" /></Button>
                  ) : c.status !== "archived" ? (
                    <Button size="sm" variant="outline" onClick={() => setStatus(c, "active")}><Play className="h-3.5 w-3.5" /></Button>
                  ) : null}
                  {c.status !== "archived" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(c, "archived")}><Archive className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => !saving && setEditing(null)}>
          <div className="bg-background rounded-2xl border border-border p-6 max-w-2xl w-full my-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-2xl">{editing.id ? "Edit campaign" : "New campaign"}</h2>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> Draft with AI</div>
              <p className="text-[12px] text-muted-foreground">Describe this month's newsletter — promotions, seasonal theme, new services, etc. AI will fill subject, body, and CTA in RKA's voice.</p>
              <Textarea rows={3} placeholder="e.g. June newsletter — summer skin prep, 15% off HydraFacial, welcome our new injector Maya" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={aiGenImage} onChange={(e) => setAiGenImage(e.target.checked)} />
                  Also generate a hero image
                </label>
                <Button size="sm" onClick={draftWithAi} disabled={aiDrafting} className="gap-1.5">
                  {aiDrafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {aiDrafting ? "Drafting…" : "Draft with AI"}
                </Button>
              </div>
            </div>


            <div className="grid grid-cols-2 gap-3">
              <Field label="Name (internal)">
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="Slug">
                <Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="winback-q1" />
              </Field>
            </div>

            <Field label="Subject line">
              <Input value={editing.subject ?? ""} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
            </Field>
            <Field label="Preview text (optional)">
              <Input value={editing.preview_text ?? ""} onChange={(e) => setEditing({ ...editing, preview_text: e.target.value })} />
            </Field>

            <Field label="Hero image / flyer (optional — shown at top of email)">
              {editing.hero_image_url ? (
                <div className="relative rounded-lg border border-border overflow-hidden bg-secondary/30">
                  <img src={editing.hero_image_url} alt="Hero" className="w-full max-h-56 object-contain" />
                  <button type="button"
                    onClick={() => setEditing({ ...editing, hero_image_url: null })}
                    className="absolute top-2 right-2 rounded-full bg-background/90 border border-border p-1.5 hover:bg-background">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 cursor-pointer hover:bg-secondary/40 text-sm text-muted-foreground">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>{uploading ? "Uploading…" : "Upload flyer or banner image (PNG/JPG, ≤5MB)"}</span>
                  <input type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHero(f); e.target.value = ""; }} />
                </label>
              )}
            </Field>

            <Field label="Body (Markdown — use {{first_name}} for personalization)">
              <Textarea rows={8} value={editing.body_markdown ?? ""} onChange={(e) => setEditing({ ...editing, body_markdown: e.target.value })} />
            </Field>


            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA label">
                <Input value={editing.cta_label ?? ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} />
              </Field>
              <Field label="CTA URL">
                <Input value={editing.cta_url ?? ""} onChange={(e) => setEditing({ ...editing, cta_url: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Audience">
                <select value={editing.audience_type ?? "win_back"}
                  onChange={(e) => setEditing({ ...editing, audience_type: e.target.value as any, audience_params: defaultParams(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="everyone">Everyone with an email (broadest)</option>
                  <option value="all_clients">All clients (ever booked)</option>
                  <option value="win_back">Win-back (visit window)</option>
                  <option value="lapsed">Lapsed (no visit in N days)</option>
                  <option value="vip">VIP (≥ N completed visits)</option>
                </select>
              </Field>
              <Field label="Recurrence">
                <select value={editing.recurrence ?? "once"}
                  onChange={(e) => setEditing({ ...editing, recurrence: e.target.value as any })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="once">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="every_3_weeks">Every 3 weeks</option>
                </select>
              </Field>
            </div>

            <AudienceParams type={editing.audience_type as any} params={editing.audience_params || {}}
              onChange={(p) => setEditing({ ...editing, audience_params: p })} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cooldown (days)">
                <Input type="number" value={String(editing.cooldown_days ?? 30)} onChange={(e) => setEditing({ ...editing, cooldown_days: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Status">
                <select value={editing.status ?? "draft"}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="draft">Draft</option>
                  <option value="active">Active (will run on schedule)</option>
                  <option value="paused">Paused</option>
                </select>
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />} Save campaign</Button>
            </div>
          </div>
        </div>
      )}
      {previewCampaign && (
        <EmailPreviewModal campaign={previewCampaign} onClose={() => setPreviewCampaign(null)} />
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" } as any)[c]);
}

function mdToHtml(md: string) {
  const blocks = md.replace(/\r\n/g, "\n").split(/\n{2,}/).filter(Boolean);
  const inline = (s: string) => escapeHtml(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" style="color:#b76e79;">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return blocks.map((b) => {
    const lines = b.split("\n");
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      return `<ul style="padding-left:20px;margin:0 0 12px;">${lines.map((l) => `<li style="margin-bottom:6px;">${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    return `<p style="margin:0 0 12px;line-height:1.6;color:#333;">${inline(b).replace(/\n/g, "<br/>")}</p>`;
  }).join("");
}

function renderCampaignHtml(campaign: Campaign, firstName: string) {
  const greeted = campaign.body_markdown.replace(/\{\{\s*first_name\s*\}\}/gi, firstName);
  const cta = campaign.cta_url
    ? `<div style="text-align:center;margin:24px 0;"><a href="${campaign.cta_url}" style="display:inline-block;background:#b76e79;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">${escapeHtml(campaign.cta_label || "Book now")}</a></div>`
    : "";
  const unsubUrl = `https://bookrka.com/unsubscribe?email=${encodeURIComponent("preview@example.com")}`;
  const preview = campaign.preview_text
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(campaign.preview_text)}</div>`
    : "";
  const hero = campaign.hero_image_url
    ? `<div style="margin:-32px -32px 24px;"><img src="${campaign.hero_image_url}" alt="" style="display:block;width:100%;max-width:560px;height:auto;border-top-left-radius:12px;border-top-right-radius:12px;"/></div>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#faf7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
${preview}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f5;padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px;max-width:560px;">
<tr><td>
  ${hero}
  <div style="text-align:center;margin-bottom:20px;"><img src="https://bookrka.com/rka-logo.webp" alt="Radiantilyk Aesthetic" width="84" height="84" style="border-radius:50%;display:inline-block;"/></div>
  <div style="text-align:center;font-family:Georgia,serif;font-size:18px;color:#b76e79;letter-spacing:2px;margin-bottom:24px;">RADIANTILYK AESTHETIC</div>
  <h1 style="font-family:Georgia,serif;color:#222;font-size:26px;margin:0 0 16px;">${escapeHtml(campaign.subject)}</h1>

  ${mdToHtml(greeted)}
  ${cta}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="color:#888;font-size:12px;text-align:center;margin:0;">
    Radiantilyk Aesthetic · San Jose<br/>
    <a href="${unsubUrl}" style="color:#888;">Unsubscribe</a>
  </p>
</td></tr></table></td></tr></table></body></html>`;
}

function EmailPreviewModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const [firstName, setFirstName] = useState("Jane");
  const html = useMemo(() => renderCampaignHtml(campaign, firstName), [campaign, firstName]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl border border-border w-full max-w-3xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-serif text-xl">Email preview: {campaign.name}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-4 border-b border-border flex items-center gap-3">
          <label className="text-sm text-muted-foreground shrink-0">Preview as:</label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="w-40"
          />
          <span className="text-xs text-muted-foreground ml-auto">Use {'{{first_name}}'} in body for personalization</span>
        </div>
        <div className="flex-1 bg-muted overflow-hidden">
          <iframe
            title="Email preview"
            srcDoc={html}
            style={{ width: "100%", height: "100%", border: "none" }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}

function defaultParams(type: string): any {
  if (type === "win_back") return { days_from: 60, days_to: 120 };
  if (type === "lapsed") return { days_inactive: 180 };
  if (type === "vip") return { min_visits: 5 };
  return {};
}

function AudienceParams({ type, params, onChange }: { type: string; params: any; onChange: (p: any) => void }) {
  if (type === "win_back") return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Last visit at least (days ago)">
        <Input type="number" value={params.days_from ?? 60} onChange={(e) => onChange({ ...params, days_from: Number(e.target.value) })} />
      </Field>
      <Field label="And at most (days ago)">
        <Input type="number" value={params.days_to ?? 120} onChange={(e) => onChange({ ...params, days_to: Number(e.target.value) })} />
      </Field>
    </div>
  );
  if (type === "lapsed") return (
    <Field label="No visit in last (days)">
      <Input type="number" value={params.days_inactive ?? 180} onChange={(e) => onChange({ ...params, days_inactive: Number(e.target.value) })} />
    </Field>
  );
  if (type === "vip") return (
    <Field label="Minimum completed visits">
      <Input type="number" value={params.min_visits ?? 5} onChange={(e) => onChange({ ...params, min_visits: Number(e.target.value) })} />
    </Field>
  );
  return null;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const StatusBadge = ({ status }: { status: string }) => {
  const cls =
    status === "active" ? "bg-success-soft text-success-soft-foreground" :
    status === "paused" ? "bg-warning-soft text-warning-soft-foreground" :
    status === "archived" ? "bg-secondary text-muted-foreground" :
    "bg-secondary text-muted-foreground";
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
};

function audienceLabel(c: Campaign): string {
  if (c.audience_type === "everyone") return "Everyone";
  if (c.audience_type === "all_clients") return "All clients";
  if (c.audience_type === "lapsed") return `Lapsed ${c.audience_params?.days_inactive ?? 180}d`;
  if (c.audience_type === "win_back") return `Win-back ${c.audience_params?.days_from ?? 60}–${c.audience_params?.days_to ?? 120}d`;
  if (c.audience_type === "vip") return `VIP ≥ ${c.audience_params?.min_visits ?? 5}`;
  return c.audience_type;
}
