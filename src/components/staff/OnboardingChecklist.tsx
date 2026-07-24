import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";

type Item = {
  id: string;
  label: string;
  to: string;
  done: boolean;
};

/**
 * One-time "Get set up" card for new staff. Self-dismisses once all items
 * are completed or the user clicks X. State is per-user in localStorage.
 */
export function OnboardingChecklist() {
  const { staffId, user } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const storageKey = user ? `rka_onboarding_dismissed_${user.id}` : null;

  useEffect(() => {
    if (!staffId || !storageKey) return;
    if (localStorage.getItem(storageKey) === "1") { setDismissed(true); return; }
    (async () => {
      const [{ data: gc }, { data: prof }, { data: avail }] = await Promise.all([
        supabase.from("staff_google_oauth").select("id").eq("staff_id", staffId).maybeSingle(),
        supabase.from("staff_profiles").select("bio").eq("id", staffId).maybeSingle(),
        supabase.from("weekly_schedules").select("id").eq("staff_id", staffId).limit(1),
      ]);
      setItems([
        { id: "calendar", label: "Connect your Google Calendar", to: "/staff/profile", done: !!gc },
        { id: "schedule", label: "Set your weekly availability", to: "/staff/availability", done: (avail?.length ?? 0) > 0 },
        { id: "profile", label: "Add a short bio", to: "/staff/profile", done: !!(prof?.bio && prof.bio.trim().length > 10) },
        { id: "handbook", label: "Read the staff handbook", to: "/staff/help", done: localStorage.getItem("rka_handbook_read") === "1" },
      ]);
    })();
  }, [staffId, storageKey]);

  if (dismissed || !items) return null;
  const remaining = items.filter(i => !i.done).length;
  if (remaining === 0) return null;

  const dismiss = () => {
    if (storageKey) localStorage.setItem(storageKey, "1");
    setDismissed(true);
  };

  return (
    <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-5">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-serif text-lg">Welcome — let's get you set up</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {remaining} of {items.length} tasks left. You can come back to this anytime.
      </p>
      <ol className="space-y-2">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              to={it.to}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition ${
                it.done ? "border-border bg-card/40" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`h-5 w-5 shrink-0 rounded-full border flex items-center justify-center text-xs ${
                  it.done ? "bg-success text-success-foreground border-success" : "border-muted-foreground/40"
                }`}>
                  {it.done && <Check className="h-3 w-3" />}
                </span>
                <span className={`text-sm truncate ${it.done ? "text-muted-foreground line-through" : ""}`}>
                  {it.label}
                </span>
              </div>
              {!it.done && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
