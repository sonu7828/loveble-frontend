// Draggable before/after compare slider. Pure presentational — accepts two image URLs.
// Pointer-based so it works on touch and mouse alike. The slider clips the "after" image
// with a CSS clip-path so we never need a canvas to do the compositing.
import { useCallback, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

type Props = {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  aspectRatio?: number; // width / height. Defaults to 1 (square).
  className?: string;
};

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "After",
  aspectRatio = 1,
  className,
}: Props) {
  const [pct, setPct] = useState(50);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.max(0, Math.min(100, next)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={wrapRef}
      className={`relative w-full overflow-hidden rounded-xl bg-muted select-none ${className ?? ""}`}
      style={{ aspectRatio: String(aspectRatio) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        src={beforeUrl}
        alt={beforeLabel}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        draggable={false}
      />
      <img
        src={afterUrl}
        alt={afterLabel}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ clipPath: `inset(0 0 0 ${pct}%)` }}
        draggable={false}
      />
      <span className="absolute top-2 left-2 rounded-full bg-black/60 text-white text-[10px] px-2 py-0.5 uppercase tracking-widest">
        {beforeLabel}
      </span>
      <span className="absolute top-2 right-2 rounded-full bg-black/60 text-white text-[10px] px-2 py-0.5 uppercase tracking-widest">
        {afterLabel}
      </span>
      <div
        className="absolute top-0 bottom-0 w-px bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] pointer-events-none"
        style={{ left: `${pct}%` }}
      />
      <button
        type="button"
        aria-label="Drag to compare"
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-9 w-9 rounded-full bg-white shadow-md flex items-center justify-center cursor-ew-resize"
        style={{ left: `${pct}%` }}
        onPointerDown={onPointerDown}
      >
        <GripVertical className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}
