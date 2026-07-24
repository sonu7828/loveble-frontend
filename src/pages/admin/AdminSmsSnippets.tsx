import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";

type Snippet = {
  id: string;
  label: string;
  category: string;
  body: string;
  sort_order: number;
  is_active: boolean;
};

const CATEGORIES = ["logistics", "followup", "policy", "clinical", "general"];

export default function AdminSmsSnippets() {
  const { isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<Snippet[]>([]);
  const [busy, setBusy] = useState(true);
  const [draft, setDraft] = useState({ label: "", category: "general", body: "" });

  async function load() {
    setBusy(true);
    const { data, error } = await supabase
      .from("sms_snippets" as any)
      .select("*")
      .order("category")
      .order("sort_order");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as unknown as Snippet[]);
    setBusy(false);
  }

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) { setBusy(false); return; }
    load();
  }, [loading, isAdmin]);

  if (loading) return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  async function add() {
    if (!draft.label.trim() || !draft.body.trim()) {
      toast.error("Label and body required");
      return;
    }
    const max = Math.max(0, ...rows.filter((r) => r.category === draft.category).map((r) => r.sort_order));
    const { error } = await supabase.from("sms_snippets" as any).insert({
      label: draft.label.trim(),
      category: draft.category,
      body: draft.body.trim(),
      sort_order: max + 10,
    } as any);
    if (error) toast.error(error.message);
    else { setDraft({ label: "", category: "general", body: "" }); await load(); toast.success("Added"); }
  }

  async function remove(id: string) {
    const ok = await confirmDialog({ title: "Delete snippet?", description: "This cannot be undone." });
    if (!ok) return;
    const { error } = await supabase.from("sms_snippets" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else await load();
  }

  async function toggle(s: Snippet) {
    const { error } = await supabase.from("sms_snippets" as any).update({ is_active: !s.is_active } as any).eq("id", s.id);
    if (error) toast.error(error.message);
    else await load();
  }

  const grouped = CATEGORIES.map((cat) => ({ cat, items: rows.filter((r) => r.category === cat) }));

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl mb-1 flex items-center gap-2">
          <MessageSquareText className="h-6 w-6" /> SMS Snippets
        </h1>
        <p className="text-sm text-muted-foreground">
          Reusable text replies for staff. Use <code>{"{first_name}"}</code> as a placeholder.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Add new</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Label</Label>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Running late" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Body</Label>
            <Textarea rows={3} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Hi {first_name}, …" />
          </div>
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Add snippet</Button>
        </CardContent>
      </Card>

      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        grouped.map((g) => g.items.length === 0 ? null : (
          <Card key={g.cat}>
            <CardHeader><CardTitle className="text-sm uppercase tracking-wide">{g.cat}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {g.items.map((s) => (
                <div key={s.id} className={`rounded-lg border p-3 ${s.is_active ? "" : "opacity-50"}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-medium text-sm">{s.label}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.is_active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggle(s)}>
                        {s.is_active ? "Active" : "Off"}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{s.body}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

