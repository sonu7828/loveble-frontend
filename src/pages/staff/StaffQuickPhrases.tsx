import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2, MessageSquareText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { confirmDialog } from "@/components/ui/confirm";

type Category = "neurotoxin" | "filler" | "energy" | "wellness" | "compliance";
const CATS: { key: Category; label: string }[] = [
  { key: "neurotoxin", label: "Neurotoxin" },
  { key: "filler", label: "Filler" },
  { key: "energy", label: "Energy / Laser" },
  { key: "wellness", label: "Wellness / Peel" },
  { key: "compliance", label: "Compliance" },
];

type Phrase = { id: string; category: string; phrase: string; sort_order: number; is_active: boolean };

export default function StaffQuickPhrases() {
  const { isAdmin, loading } = useAuth();
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [busy, setBusy] = useState(true);
  const [draft, setDraft] = useState<Record<Category, string>>({ neurotoxin: "", filler: "", energy: "", wellness: "", compliance: "" });

  const load = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("quick_phrases")
      .select("*")
      .order("category")
      .order("sort_order");
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else setPhrases((data ?? []) as Phrase[]);
    setBusy(false);
  };

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) { setBusy(false); return; }
    load();
  }, [loading, isAdmin]);

  if (loading) return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  const add = async (cat: Category) => {
    const phrase = draft[cat].trim();
    if (!phrase) return;
    const max = Math.max(0, ...phrases.filter(p => p.category === cat).map(p => p.sort_order));
    const { error } = await supabase.from("quick_phrases").insert({
      category: cat, phrase, sort_order: max + 1,
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { setDraft({ ...draft, [cat]: "" }); await load(); }
  };

  const remove = async (id: string) => {
    if (!await confirmDialog({ title: "Delete phrase?", confirmLabel: "Delete", destructive: true })) return;
    const { error } = await supabase.from("quick_phrases").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else await load();
  };

  const toggle = async (p: Phrase) => {
    const { error } = await supabase.from("quick_phrases").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else await load();
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl font-serif flex items-center gap-2">
          <MessageSquareText className="h-6 w-6 text-primary" />
          Quick-phrase library
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          One-tap phrases that appear above the Provider notes field while charting. Built-in defaults still work; these add to them.
        </p>
      </header>

      <Tabs defaultValue="neurotoxin">
        <TabsList className="grid grid-cols-4">
          {CATS.map(c => <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>)}
        </TabsList>
        {CATS.map(c => {
          const rows = phrases.filter(p => p.category === c.key);
          return (
            <TabsContent key={c.key} value={c.key} className="space-y-3 mt-4">
              <div className="flex gap-2">
                <Input
                  value={draft[c.key]}
                  onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                  placeholder={`Add a ${c.label.toLowerCase()} phrase…`}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(c.key); } }}
                />
                <Button onClick={() => add(c.key)}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  No custom phrases yet for {c.label.toLowerCase()}. Built-in defaults are still available.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {rows.map(p => (
                    <div key={p.id} className={`flex items-center gap-2 rounded-md border border-border p-2 ${!p.is_active ? "opacity-50" : ""}`}>
                      <span className="flex-1 text-sm">{p.phrase}</span>
                      <Button size="sm" variant="ghost" onClick={() => toggle(p)}>
                        {p.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
