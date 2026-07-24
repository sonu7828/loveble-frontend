import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export type ChartNoteTemplate = {
  id: string;
  category: string;
  subtype: string | null;
  name: string;
  body: Record<string, any>;
  sort_order: number;
};

type Props = {
  category: "neurotoxin" | "filler" | "energy" | "wellness";
  /** Called with the template body. Caller decides which state setters to update. */
  onApply: (body: Record<string, any>, name: string) => void;
};

export function ChartTemplatePicker({ category, onApply }: Props) {
  const [templates, setTemplates] = useState<ChartNoteTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("chart_note_templates")
        .select("id, category, subtype, name, body, sort_order")
        .eq("category", category)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (!cancel) {
        if (error) {
          // Silently degrade — templates are an enhancement, not required.
          setTemplates([]);
        } else {
          setTemplates((data ?? []) as any);
        }
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [category]);

  if (loading || templates.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-input bg-background hover:bg-muted"
          title="Apply a charting template"
        >
          <FileText className="h-3.5 w-3.5" />
          Apply template
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[60vh] overflow-y-auto">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {category} templates
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {templates.map(t => (
          <DropdownMenuItem
            key={t.id}
            className="flex flex-col items-start gap-0.5 py-2"
            onSelect={() => {
              try {
                onApply(t.body ?? {}, t.name);
                toast.success(`Template applied: ${t.name}`);
              } catch (e: any) {
                toast.error(e?.message ?? "Could not apply template");
              }
            }}
          >
            <span className="text-sm font-medium">{t.name}</span>
            {t.subtype && (
              <span className="text-[11px] text-muted-foreground">{t.subtype}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
