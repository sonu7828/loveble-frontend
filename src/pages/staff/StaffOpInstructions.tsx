import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Row = {
  id?: string;
  service_id: string;
  service_name: string;
  category: string;
  title: string;
  body_markdown: string;
  version?: number;
};

type Kind = "pre" | "post";

const COPY = {
  pre: {
    heading: "Pre-Op Instructions",
    blurb:
      "Edit the before-visit instructions sent to clients ahead of their appointment. Markdown supported (## heading, ### sub-heading, - bullets).",
    defaultTitle: "Pre-Treatment Instructions",
    table: "service_pre_op_instructions",
  },
  post: {
    heading: "Post-Op Instructions",
    blurb:
      "Edit the after-care instructions emailed to the client at check-in. Markdown supported (## heading, ### sub-heading, - bullets).",
    defaultTitle: "After-Care Instructions",
    table: "service_post_op_instructions",
  },
} as const;

export default function StaffOpInstructions({ kind, embedded = false }: { kind: Kind; embedded?: boolean }) {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cfg = COPY[kind];

  const load = async () => {
    const { data: services } = await supabase
      .from("services")
      .select("id, name, category_id, is_active, service_categories(slug, display_order), display_order")
      .eq("is_active", true);
    const { data: existing } = await supabase.from(cfg.table as any).select("*");
    const byId = new Map((existing ?? []).map((p: any) => [p.service_id, p]));
    const merged: Row[] = (services ?? [])
      .sort((a: any, b: any) =>
        ((a.service_categories?.display_order ?? 0) - (b.service_categories?.display_order ?? 0)) ||
        ((a.display_order ?? 0) - (b.display_order ?? 0))
      )
      .map((s: any) => {
        const p: any = byId.get(s.id);
        return {
          id: p?.id,
          service_id: s.id,
          service_name: s.name,
          category: s.service_categories?.slug ?? "",
          title: p?.title ?? cfg.defaultTitle,
          body_markdown: p?.body_markdown ?? "",
          version: p?.version,
        };
      });
    setRows(merged);
    if (!activeId && merged.length) setActiveId(merged[0].service_id);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [kind]);

  if (!isAdmin) return <div className="p-8 text-sm text-muted-foreground">Admin only.</div>;

  const active = rows.find((r) => r.service_id === activeId);

  const save = async () => {
    if (!active) return;
    setBusy(true);
    const payload = {
      service_id: active.service_id,
      title: active.title,
      body_markdown: active.body_markdown,
      last_edited_by: user?.id ?? null,
    };
    const { error } = await supabase.from(cfg.table as any).upsert(payload, { onConflict: "service_id" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    load();
  };

  return (
    <div className={embedded ? "" : "max-w-7xl mx-auto p-4 md:p-8"}>
      {!embedded && (
        <>
          <h1 className="font-serif text-3xl mb-2">{cfg.heading}</h1>
          <p className="text-sm text-muted-foreground mb-6">{cfg.blurb}</p>
        </>
      )}
      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <aside className="rounded-2xl border border-border bg-card p-2 max-h-[70vh] overflow-y-auto">
          {rows.map((r) => (
            <button
              key={r.service_id}
              onClick={() => setActiveId(r.service_id)}
              className={`w-full text-left px-3 py-2 rounded text-sm ${activeId === r.service_id ? "bg-primary/10 text-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              <div className="font-medium text-foreground">{r.service_name}</div>
              <div className="text-[11px] text-muted-foreground">{r.category}{r.body_markdown ? "" : " · empty"}</div>
            </button>
          ))}
        </aside>
        {active && (
          <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={active.title} onChange={(e) => setRows((rs) => rs.map((r) => r.service_id === active.service_id ? { ...r, title: e.target.value } : r))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Body (markdown)</label>
              <Textarea
                value={active.body_markdown}
                onChange={(e) => setRows((rs) => rs.map((r) => r.service_id === active.service_id ? { ...r, body_markdown: e.target.value } : r))}
                className="min-h-[60vh] font-mono text-xs"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
              {active.version ? <span className="text-xs text-muted-foreground">v{active.version}</span> : null}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
