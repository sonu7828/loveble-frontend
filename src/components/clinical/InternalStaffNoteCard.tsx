import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Pencil, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Props = {
  profileId: string;
  initialNote?: string | null;
  updatedAt?: string | null;
  onSaved?: (note: string, updatedAt: string) => void;
};

/**
 * Sticky private staff note pinned to a client profile.
 * Not visible to the client. Useful for "always greet by nickname",
 * "prefers no music", "billing arrangement", etc.
 */
export function InternalStaffNoteCard({ profileId, initialNote, updatedAt, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(updatedAt ?? null);

  useEffect(() => { setValue(initialNote ?? ""); setSavedAt(updatedAt ?? null); }, [initialNote, updatedAt, profileId]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("client_profiles")
        .update({
          internal_staff_note: value.trim() || null,
          internal_note_updated_at: nowIso,
          internal_note_updated_by: u.user?.id ?? null,
        })
        .eq("id", profileId);
      if (error) { toast.error(error.message); return; }
      setSavedAt(nowIso);
      setEditing(false);
      onSaved?.(value, nowIso);
      toast.success("Note saved");
    } finally { setSaving(false); }
  };

  const hasNote = !!(value && value.trim());

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 mb-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-700 dark:text-amber-300 inline-flex items-center gap-1.5">
          <StickyNote className="h-3 w-3" /> Private staff note
        </div>
        {!editing ? (
          <Button size="sm" variant="ghost" className="rounded-full h-7 px-2 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3 mr-1" />{hasNote ? "Edit" : "Add note"}
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="rounded-full h-7 px-2 text-xs" disabled={saving} onClick={() => { setEditing(false); setValue(initialNote ?? ""); }}>Cancel</Button>
            <Button size="sm" className="rounded-full h-7 px-2 text-xs" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" />Save</>}
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Visible only to staff. Use for preferences, billing arrangements, or important reminders. Never include PHI that belongs in the chart."
          rows={4}
          className="w-full text-sm rounded-lg border border-amber-200 dark:border-amber-900/40 bg-background px-3 py-2"
        />
      ) : hasNote ? (
        <p className="text-sm whitespace-pre-wrap text-foreground/90">{value}</p>
      ) : (
        <p className="text-xs text-muted-foreground italic">No private note yet.</p>
      )}
      {savedAt && !editing && hasNote && (
        <p className="text-[10px] text-muted-foreground mt-2">Last updated {format(new Date(savedAt), "MMM d, yyyy 'at' h:mm a")}</p>
      )}
    </div>
  );
}
