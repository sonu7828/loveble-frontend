import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Save, FileText, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

interface Form {
  id: string; slug: string; title: string; body_markdown: string;
  version: number; is_active: boolean; is_universal: boolean; is_optional: boolean;
}
interface Service { id: string; name: string; }
interface Mapping { id: string; service_id: string; consent_form_id: string; }

export default function StaffConsents() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [resending, setResending] = useState(false);

  const resendUnsigned = async () => {
    if (resending) return;
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-consent-reminders", { body: {} });
      if (error) throw error;
      const count = (data as any)?.totalSent ?? (data as any)?.total_sent ?? 0;
      toast.success(count > 0 ? `Sent ${count} consent reminder${count === 1 ? "" : "s"}` : "No clients needed a reminder right now");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to resend");
    } finally {
      setResending(false);
    }
  };
  useEffect(() => {
    (async () => {
      const [f, s, m] = await Promise.all([
        supabase.from("consent_forms").select("*").order("is_universal", { ascending: false }).order("title"),
        supabase.from("services").select("id, name").order("name"),
        supabase.from("service_consents").select("id, service_id, consent_form_id"),
      ]);
      setForms((f.data ?? []) as Form[]);
      setServices((s.data ?? []) as Service[]);
      setMappings((m.data ?? []) as Mapping[]);
      setLoading(false);
    })();
  }, []);

  const active = useMemo(() => forms.find(f => f.id === activeId) ?? null, [forms, activeId]);
  useEffect(() => { setDraft(active ? { ...active } : null); }, [active]);

  if (authLoading) return <div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const { error } = await supabase.from("consent_forms").update({
      title: draft.title.trim(),
      slug: draft.slug.trim(),
      body_markdown: draft.body_markdown,
      is_active: draft.is_active,
      is_universal: draft.is_universal,
      is_optional: draft.is_optional,
    }).eq("id", draft.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    // Reload (version may have bumped via trigger)
    const { data } = await supabase.from("consent_forms").select("*").eq("id", draft.id).single();
    if (data) {
      setForms(forms.map(f => f.id === data.id ? (data as Form) : f));
      toast.success(`Saved${(data as Form).version !== draft.version ? ` (version → v${(data as Form).version})` : ""}`);
    }
  };

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const openNew = () => {
    setNewTitle("");
    setNewSlug("");
    setNewOpen(true);
  };

  const createNew = async () => {
    const title = newTitle.trim() || "Untitled consent";
    const slug = (newSlug.trim() || slugify(title)).trim();
    if (!slug) { toast.error("Slug is required"); return; }
    setCreating(true);
    const { data, error } = await supabase.from("consent_forms").insert({
      slug, title, body_markdown: "Edit this consent body…", is_active: true, is_universal: false, is_optional: false,
    }).select().single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setForms([data as Form, ...forms]);
    setActiveId((data as Form).id);
    setNewOpen(false);
    toast.success("Consent form created");
  };

  const toggleMapping = async (serviceId: string, formId: string, on: boolean) => {
    if (on) {
      const { data, error } = await supabase.from("service_consents")
        .insert({ service_id: serviceId, consent_form_id: formId }).select().single();
      if (error) { toast.error(error.message); return; }
      setMappings([...mappings, data as Mapping]);
    } else {
      const m = mappings.find(x => x.service_id === serviceId && x.consent_form_id === formId);
      if (!m) return;
      const { error } = await supabase.from("service_consents").delete().eq("id", m.id);
      if (error) { toast.error(error.message); return; }
      setMappings(mappings.filter(x => x.id !== m.id));
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl">Consent Forms</h1>
          <p className="text-xs text-muted-foreground mt-1">Edit consent text, mark optional/universal, and map forms to services. Editing the body bumps the version and clients will be asked to re-sign.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={resendUnsigned} disabled={resending} size="sm" variant="outline" className="rounded-full">
            {resending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Resend unsigned
          </Button>
          <Button onClick={openNew} size="sm" className="rounded-full"><Plus className="h-4 w-4 mr-1" />New form</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-1">
            {forms.map(f => (
              <button key={f.id} onClick={() => setActiveId(f.id)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm flex items-start gap-2 ${activeId === f.id ? "bg-primary/10 text-foreground" : "hover:bg-secondary/60 text-muted-foreground"}`}>
                <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{f.title}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                    v{f.version} · {f.is_universal ? "Universal" : "Per-service"}{f.is_optional ? " · Optional" : ""}{!f.is_active ? " · Inactive" : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="col-span-8">
            {!draft ? (
              <div className="rounded-2xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">Select a form to edit.</div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs uppercase tracking-widest text-muted-foreground">Title</Label>
                      <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-widest text-muted-foreground">Slug</Label>
                      <Input value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Switch checked={draft.is_active} onCheckedChange={v => setDraft({ ...draft, is_active: v })} />
                      <Label className="text-sm">Active</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={draft.is_universal} onCheckedChange={v => setDraft({ ...draft, is_universal: v })} />
                      <Label className="text-sm">Universal (every booking)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={draft.is_optional} onCheckedChange={v => setDraft({ ...draft, is_optional: v })} />
                      <Label className="text-sm">Optional (client may decline)</Label>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground">Current version: <span className="text-foreground font-medium">v{draft.version}</span></div>
                  </div>

                  <div>
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Body</Label>
                    <Textarea
                      value={draft.body_markdown}
                      onChange={e => setDraft({ ...draft, body_markdown: e.target.value })}
                      rows={18}
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Editing the body increments the version. Clients who already signed will be asked to re-sign.</p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={save} disabled={saving} size="sm" className="rounded-full">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Save changes</>}
                    </Button>
                  </div>
                </div>

                {!draft.is_universal && (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Required for services</h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {services.map(s => {
                        const checked = mappings.some(m => m.service_id === s.id && m.consent_form_id === draft.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 hover:bg-secondary/40 cursor-pointer">
                            <Checkbox checked={checked} onCheckedChange={(v) => toggleMapping(s.id, draft.id, !!v)} />
                            <span className="truncate">{s.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}


      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New consent form</DialogTitle>
            <DialogDescription>The slug is auto-derived from the title — adjust only if you need a specific URL.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Title</Label>
              <Input
                autoFocus
                value={newTitle}
                onChange={(e) => {
                  const t = e.target.value;
                  setNewTitle(t);
                  // Auto-track slug until the user types into it manually
                  setNewSlug((prev) => (prev === slugify(newTitle) || prev === "" ? slugify(t) : prev));
                }}
                placeholder="e.g. Botox Consent"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Slug</Label>
              <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="botox-consent" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button className="rounded-full" onClick={createNew} disabled={creating || !newTitle.trim()}>
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Create form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
