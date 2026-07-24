import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2, Check, ExternalLink, Trash2, Sparkles, GitCompare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { confirmDialog } from "@/components/ui/confirm";
import { BeforeAfterSlider } from "@/components/clinical/BeforeAfterSlider";

type Photo = {
  id: string;
  appointment_id: string;
  storage_path: string;
  caption: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  url?: string;
};

export function ClientUploadedPhotosCard({ clientEmail }: { clientEmail: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  // Before/after compare picker. Holds up to two photo ids; rendering swaps in
  // a slider overlay once both slots are filled.
  const [compare, setCompare] = useState<[string | null, string | null]>([null, null]);
  const compareActive = !!(compare[0] || compare[1]);
  const toggleCompare = (id: string) => {
    setCompare(([a, b]) => {
      if (a === id) return [b, null];
      if (b === id) return [a, null];
      if (!a) return [id, b];
      if (!b) return [a, id];
      return [b, id]; // shift oldest out
    });
  };
  const compareBefore = photos.find(p => p.id === compare[0]);
  const compareAfter = photos.find(p => p.id === compare[1]);

  const checkQuality = async (p: Photo) => {
    if (!p.url) return;
    setCheckingId(p.id);
    try {
      const baseline = photos.find(x => x.id !== p.id && !!x.url)?.url ?? null;
      const { data, error } = await supabase.functions.invoke("ai-photo-quality-check", {
        body: { current_url: p.url, baseline_url: baseline, intent: p.caption ?? null },
      });
      if (error) throw error;
      const reasons = (data?.reasons ?? []).join(" · ");
      const tips = (data?.tips ?? []).join(" · ");
      if (data?.verdict === "retake") {
        toast.warning(`Retake recommended${reasons ? `: ${reasons}` : ""}`, { description: tips || undefined, duration: 8000 });
      } else {
        toast.success("Photo looks usable", { description: tips || reasons || undefined });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Quality check failed");
    } finally {
      setCheckingId(null);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_uploaded_photos" as any)
      .select("id, appointment_id, storage_path, caption, uploaded_at, reviewed_at")
      .ilike("client_email", clientEmail)
      .order("uploaded_at", { ascending: false })
      .limit(24);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data as any as Photo[]) ?? [];

    const signed = await Promise.all(rows.map(async (p) => {
      const { data: s } = await supabase.storage
        .from("client-uploaded-photos")
        .createSignedUrl(p.storage_path, 60 * 60);
      return { ...p, url: s?.signedUrl };
    }));
    setPhotos(signed);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientEmail]);

  const markReviewed = async (p: Photo) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_uploaded_photos" as any)
      .update({ reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    setPhotos(ps => ps.map(x => x.id === p.id ? { ...x, reviewed_at: new Date().toISOString() } : x));
    toast.success("Marked reviewed");
  };

  const remove = async (p: Photo) => {
    if (!(await confirmDialog({ title: "Delete this photo?", description: "Removes it from the chart and storage. Cannot be undone.", destructive: true, confirmLabel: "Delete" }))) return;
    const { error } = await supabase.from("client_uploaded_photos" as any).delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("client-uploaded-photos").remove([p.storage_path]);
    setPhotos(ps => ps.filter(x => x.id !== p.id));
    toast.success("Photo deleted");
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading photos…
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-serif text-lg">Client uploaded photos</h3>
        </div>
        <p className="text-sm text-muted-foreground">No photos uploaded yet. Providers can enable photo request texts in My Profile.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-serif text-lg">Client uploaded photos</h3>
          <span className="text-xs text-muted-foreground">({photos.length})</span>
        </div>
        {compareActive && (
          <Button variant="ghost" size="sm" onClick={() => setCompare([null, null])}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear compare
          </Button>
        )}
      </div>

      {compareBefore?.url && compareAfter?.url && (
        <div className="mb-5">
          <BeforeAfterSlider
            beforeUrl={compareBefore.url}
            afterUrl={compareAfter.url}
            beforeLabel={format(new Date(compareBefore.uploaded_at), "MMM d, yyyy")}
            afterLabel={format(new Date(compareAfter.uploaded_at), "MMM d, yyyy")}
          />
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Drag the handle to compare. Pick a different pair below to swap.
          </p>
        </div>
      )}

      {compareActive && !(compareBefore && compareAfter) && (
        <p className="text-xs text-muted-foreground mb-3">
          Pick one more photo to compare. {compareBefore ? "Before" : "After"} selected.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map(p => {
          const compareSlot = compare[0] === p.id ? "Before" : compare[1] === p.id ? "After" : null;
          return (
            <div key={p.id} className={`group relative rounded-xl overflow-hidden border bg-muted ${compareSlot ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
              <a href={p.url} target="_blank" rel="noreferrer" className="block aspect-square">
                {p.url ? (
                  <img src={p.url} alt={p.caption ?? "Client upload"} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Unavailable</div>
                )}
              </a>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[11px] text-white">
                <div>{format(new Date(p.uploaded_at), "MMM d, yyyy")}</div>
                {p.caption && <div className="line-clamp-2 opacity-90">{p.caption}</div>}
              </div>
              {compareSlot && (
                <div className="absolute top-1.5 left-1.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                  {compareSlot}
                </div>
              )}
              {!compareSlot && p.reviewed_at && (
                <div className="absolute top-1.5 left-1.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Reviewed
                </div>
              )}
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                {p.url && (
                  <button
                    type="button"
                    onClick={() => toggleCompare(p.id)}
                    className={`h-7 w-7 rounded-full backdrop-blur flex items-center justify-center ${compareSlot ? "bg-primary text-primary-foreground" : "bg-background/90 hover:bg-background"}`}
                    title="Compare"
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                  </button>
                )}
                {!p.reviewed_at && (
                  <button
                    type="button"
                    onClick={() => markReviewed(p)}
                    className="h-7 w-7 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background"
                    title="Mark reviewed"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                {p.url && (
                  <button
                    type="button"
                    onClick={() => checkQuality(p)}
                    disabled={checkingId === p.id}
                    className="h-7 w-7 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background disabled:opacity-50"
                    title="AI quality check vs baseline"
                  >
                    {checkingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </button>
                )}
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="h-7 w-7 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background"
                    title="Open full size"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => remove(p)}
                  className="h-7 w-7 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
