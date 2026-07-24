// Subtle banner — shown on touch devices — reminding providers how to lock
// exposure/focus before capturing. Pure presentational.
import { Lightbulb } from "lucide-react";

export function PhotoLightingHint() {
  if (typeof window === "undefined") return null;
  const isTouch = window.matchMedia?.("(hover: none)").matches ?? false;
  if (!isTouch) return null;
  return (
    <div className="flex gap-2 items-start rounded-md border border-info/30 bg-info-soft/40 p-2 text-[11px] leading-snug">
      <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-info" />
      <div>
        <span className="font-medium">Lighting:</span> face the window, no overhead spot, neutral expression.
        <br />
        <span className="font-medium">iOS tip:</span> tap-and-hold the face in the camera preview to lock AE/AF before each shot.
      </div>
    </div>
  );
}
