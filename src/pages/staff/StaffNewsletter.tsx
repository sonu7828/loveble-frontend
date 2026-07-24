import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Send, Users, Mail, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";

type Audience = "everyone" | "all_clients" | "lapsed" | "vip";

const AUDIENCE_LABEL: Record<Audience, string> = {
  everyone: "Everyone with an email on file",
  all_clients: "All clients who've ever booked",
  lapsed: "Lapsed — no visit in 120 days",
  vip: "VIPs — 3+ completed visits",
};

// One-shot newsletter sender: drafts with AI, lets you edit, then sends to
// a chosen audience. Under the hood it creates a one-off campaign row and
// invokes the existing run-marketing-campaign function so the audit trail
// and per-recipient throttling stay consistent with regular campaigns.
export default function StaffNewsletter() {
  const { user } = useAuth();
  const [audience, setAudience] = useState<Audience>("all_clients");
  const [prompt, setPrompt] = useState("");
  const [genImage, setGenImage] = useState(true);
  const [drafting, setDrafting] = useState(false);

  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Book your visit");
  const [ctaUrl, setCtaUrl] = useState("https://bookrka.com/book");
  const [heroUrl, setHeroUrl] = useState<string | null>(null);

  const [audienceSize, setAudienceSize] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);

  const audienceParams = (a: Audience) => {
    if (a === "lapsed") return { days: 120 };
    if (a === "vip") return { min_visits: 3 };
    return {};
  };

  const draftWithAi = async () => {
    if (!prompt.trim()) { toast.error("Tell the AI what this newsletter is about"); return; }
    setDrafting(true);
    const { data, error } = await supabase.functions.invoke("ai-draft-newsletter", {
      body: { prompt, generateImage: genImage },
    });
    setDrafting(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "AI draft failed"); return; }
    setSubject(data.draft?.subject ?? "");
    setPreviewText(data.draft?.preview_text ?? "");
    setBody(data.draft?.body_markdown ?? "");
    setCtaLabel(data.draft?.cta_label ?? ctaLabel);
    setCtaUrl(data.draft?.cta_url ?? ctaUrl);
    if (data.hero_image_url) setHeroUrl(data.hero_image_url);
    toast.success(genImage && data.hero_image_url ? "Draft + image ready — review and send" : "Draft ready — review and send");
  };

  const createCampaign = async () => {
    if (!user) throw new Error("Not signed in");
    if (!subject.trim() || !body.trim()) { toast.error("Subject and body are required"); return null; }
    const slug = `newsletter-${Date.now()}`;
    const { data, error } = await supabase.from("marketing_campaigns").insert({
      slug,
      name: `Newsletter · ${subject.slice(0, 60)}`,
      subject,
      preview_text: previewText || null,
      body_markdown: body,
      cta_label: ctaLabel || null,
      cta_url: ctaUrl || null,
      audience_type: audience,
      audience_params: audienceParams(audience),
      hero_image_url: heroUrl,
      status: "draft",
      recurrence: "once",
      cooldown_days: 14,
      created_by: user.id,
    }).select("id").single();
    if (error || !data) { toast.error(error?.message ?? "Could not save newsletter"); return null; }
    return data.id as string;
  };

  const checkAudience = async () => {
    setChecking(true);
    setAudienceSize(null);
    const id = await createCampaign();
    if (!id) { setChecking(false); return; }
    const { data, error } = await supabase.functions.invoke("run-marketing-campaign", {
      body: { campaignId: id, dryRun: true },
    });
    setChecking(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Preview failed"); return; }
    setAudienceSize(data.eligible);
    toast.success(`${data.eligible} eligible recipients (of ${data.audienceSize} in the audience)`);
  };

  const send = async () => {
    if (audienceSize === null) {
      toast.error("Click 'Preview recipients' first so you know who's getting this");
      return;
    }
    if (!(await confirmDialog({ title: `Send newsletter campaign?`, description: `Confirm dispatch to ${audienceSize} ${audienceSize === 1 ? "person" : "people"}.`, confirmLabel: "Send Now" }))) return;
    setSending(true);
    const id = await createCampaign();
    if (!id) { setSending(false); return; }
    const { data, error } = await supabase.functions.invoke("run-marketing-campaign", {
      body: { campaignId: id, dryRun: false },
    });
    setSending(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Send failed"); return; }
    toast.success(`Sent ${data.sent}${data.errors ? ` · ${data.errors} errors` : ""}`);
    setSubject(""); setPreviewText(""); setBody(""); setHeroUrl(null);
    setPrompt(""); setAudienceSize(null);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-serif text-lg">One-shot newsletter</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Draft a newsletter with AI, edit it, pick who gets it, and send. For recurring automations use the Campaigns tab.
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Audience</Label>
            <select
              value={audience}
              onChange={(e) => { setAudience(e.target.value as Audience); setAudienceSize(null); }}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
                <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" /> Draft with AI
            </div>
            <Textarea
              rows={3}
              placeholder="e.g. June check-in — kick off summer with our new HydraFacial Deluxe, gentle reminder about SPF, and 10 percent off lip filler through the 30th"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={genImage} onChange={(e) => setGenImage(e.target.checked)} />
                <ImageIcon className="h-3 w-3" />
                Also generate a hero image
              </label>
              <Button size="sm" onClick={draftWithAi} disabled={drafting} className="gap-1.5">
                {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {drafting ? "Drafting…" : "Draft"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-medium text-sm">Review & edit</h3>

        {heroUrl && (
          <div className="relative rounded-lg border border-border overflow-hidden bg-secondary/30">
            <img src={heroUrl} alt="Hero" className="w-full max-h-56 object-contain" />
            <button type="button" onClick={() => setHeroUrl(null)}
              className="absolute top-2 right-2 rounded-full bg-background/90 border border-border p-1.5 hover:bg-background">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" className="mt-1.5" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Preview text</Label>
            <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Shown in inbox preview" className="mt-1.5" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Body (Markdown · use {"{{first_name}}"} for personalization)</Label>
            <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="mt-1.5 font-mono text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Button label</Label>
              <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Button URL</Label>
              <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="mt-1.5" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
          <Button variant="outline" onClick={checkAudience} disabled={checking || !subject || !body} className="gap-1.5">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
            Preview recipients
          </Button>
          {audienceSize !== null && (
            <span className="text-xs text-muted-foreground">
              {audienceSize} eligible {audienceSize === 1 ? "person" : "people"} after cooldown & unsubscribes
            </span>
          )}
          <div className="flex-1" />
          <Button onClick={send} disabled={sending || !subject || !body || audienceSize === null} className="gap-1.5">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send newsletter
          </Button>
        </div>
      </div>
    </div>
  );
}
