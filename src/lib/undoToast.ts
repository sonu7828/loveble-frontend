import { toast } from "sonner";

/**
 * Defer a destructive action by `delayMs` while showing a sonner toast with an Undo button.
 * - If the user clicks Undo before the timer fires, `commit` is never called and `onUndo` runs.
 * - If the timer fires, `commit` runs. Throws from `commit` are surfaced via `toast.error`.
 *
 * Usage:
 *   withUndo({
 *     label: "Appointment cancelled",
 *     commit: async () => { ... actual DB writes ... },
 *     onUndo: () => { ... restore UI state if you optimistically changed it ... },
 *   });
 */
export function withUndo(args: {
  label: string;
  description?: string;
  commit: () => Promise<void> | void;
  onUndo?: () => void;
  delayMs?: number;
}) {
  const { label, description, commit, onUndo, delayMs = 5000 } = args;
  let cancelled = false;

  const timer = setTimeout(async () => {
    if (cancelled) return;
    try {
      await commit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  }, delayMs);

  toast(label, {
    description: description ?? "Undo within 5 seconds.",
    duration: delayMs,
    action: {
      label: "Undo",
      onClick: () => {
        cancelled = true;
        clearTimeout(timer);
        try { onUndo?.(); } catch { /* noop */ }
        toast.success("Undone");
      },
    },
  });
}
