import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

/**
 * Admin-only card to set the shared "owner" Google Calendar ID.
 * Approved appointments are mirrored to this calendar (in addition to each
 * provider's personal calendar) so the owner sees the full schedule in one place.
 *
 * Use "primary" to write to the owner account's primary calendar, or paste a
 * specific calendar ID (e.g. "abcd1234@group.calendar.google.com") from
 * Google Calendar → Settings → Integrate calendar → Calendar ID.
 */
export default function SharedOwnerCalendarCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("shared_google_calendar_id")
        .eq("id", 1)
        .maybeSingle();
      setValue((data as any)?.shared_google_calendar_id ?? "");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const v = value.trim() || null;
      const { error } = await supabase
        .from("app_settings")
        .update({ shared_google_calendar_id: v } as any)
        .eq("id", 1);
      if (error) throw error;
      toast.success("Shared calendar updated");
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3 mb-4">
        <CalendarDays className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-medium">Shared owner calendar</h3>
          <p className="text-sm text-muted-foreground">
            Approved appointments are mirrored to this Google Calendar so the owner
            sees every provider's schedule in one place. Use <code>primary</code> for
            the owner's main calendar, or paste a specific Calendar ID.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>Calendar ID</Label>
            <Input
              className="mt-1.5"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="primary  or  abcd1234@group.calendar.google.com"
            />
          </div>
          <Button onClick={save} disabled={saving} size="sm">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
