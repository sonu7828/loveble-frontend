import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "⌘/Ctrl + K", what: "Open command palette" },
  { keys: "/", what: "Open command palette" },
  { keys: "N", what: "New booking" },
  { keys: "?", what: "Show this cheatsheet" },
  { keys: "Esc", what: "Close any dialog or palette" },
  { keys: "G then T", what: "Today" },
  { keys: "G then D", what: "Dashboard" },
  { keys: "G then I", what: "Inbox" },
  { keys: "G then C", what: "Calendar" },
  { keys: "G then M", what: "Messages" },
  { keys: "G then L", what: "Clients" },
  { keys: "G then K", what: "Walk-in checkout" },
  { keys: "G then W", what: "Waitlist" },
];

/**
 * Mount once near the top of the staff app. Global keyboard shortcuts:
 * - `?` opens cheatsheet
 * - `n` jumps to new booking
 * - `g` followed by a letter jumps to a screen
 * Skips when focus is in an input/textarea/contentEditable.
 */
export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let lastG = 0;
    const GO: Record<string, string> = {
      t: "/staff/today",
      d: "/staff/today",
      i: "/staff/inbox",
      c: "/staff/calendar",
      m: "/staff/messages",
      l: "/staff/clients",
      k: "/staff/checkout",
      w: "/staff/waitlist",
      n: "/staff/appointments/new",
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const inField =
        tag === "input" || tag === "textarea" || tag === "select" ||
        (e.target as HTMLElement | null)?.isContentEditable;
      if (inField) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?" && !e.shiftKey === false) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === "g") {
        lastG = Date.now();
        return;
      }
      // G-prefixed jump
      if (Date.now() - lastG < 1200) {
        const dest = GO[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          lastG = 0;
          navigate(dest);
          return;
        }
      }
      // Standalone N for new booking
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        navigate("/staff/appointments/new");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Keyboard className="h-5 w-5 text-primary" /> Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <ul className="divide-y divide-border text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="py-2.5 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{s.what}</span>
              <kbd className="font-mono text-xs px-2 py-1 rounded-md border border-border bg-secondary whitespace-nowrap">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground pt-2">
          Press <kbd className="font-mono px-1.5 py-0.5 rounded border border-border bg-secondary">?</kbd> anytime to reopen.
        </p>
      </DialogContent>
    </Dialog>
  );
}
