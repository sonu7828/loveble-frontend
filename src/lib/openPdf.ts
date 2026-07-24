import { toast } from "sonner";

/**
 * Reliably open/download a generated PDF.
 *
 * Calling window.open() after an `await` is treated as a non-user-initiated
 * popup and is silently blocked by Safari/iOS and strict Chrome settings.
 * Using a synthetic anchor click with target="_blank" + rel="noopener" works
 * because it preserves the user-activation chain from the original click.
 *
 * If anything still blocks the navigation, we fall back to a toast with a
 * tappable "Open PDF" action so staff always have a way through.
 */
export function openPdf(url: string, suggestedFilename?: string) {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (suggestedFilename) a.download = suggestedFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Safety net for popup blockers — surface the link so it's never lost.
    toast.success("PDF ready", {
      description: "If it didn't open, tap to view.",
      action: {
        label: "Open PDF",
        onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
      },
    });
  } catch {
    toast.error("Could not open PDF", {
      action: { label: "Try again", onClick: () => window.open(url, "_blank") },
    });
  }
}
