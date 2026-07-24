// Post-op daily check-ins — for each completed appointment within the last
// 14 days, prompts the client on day 1/3/7/14 to rate swelling/bruising/pain
// (1-5), upload an optional photo, and add notes. Submissions feed the
// outcomes dataset (postop_checkins) used to identify complications early.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getClientSession } from "@/hooks/useClientAuth";
import { differenceInCalendarDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ImagePlus, Loader2, Stethoscope, X } from "lucide-react";
import { toast } from "sonner";

const CHECKIN_DAYS = [1, 3, 7, 14] as const;

type ApptLite = { id: string; start_at: string; service_id: string };
type Existing = {
  appointment_id: string;
  day_offset: number;
  swelling: number | null;
  bruising: number | null;
  pain: number | null;
  photo_path: string | null;
  notes: string | null;
};

type Draft = {
  swelling?: number; bruising?: number; pain?: number;
  notes: string; photoPath: string | null; photoUrl: string | null;
};

export function PostOpCheckInsCard() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [appts, setAppts] = useState<ApptLite[]>([]);
  const [services, setServices] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, Existing>>({}); // key = `${appt}:${day}`
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const session = await getClientSession();
        const e = session?.user?.email?.toLowerCase();
        if (!e) return;
        setEmail(e);

        const since = new Date(); since.setDate(since.getDate() - 16);
        const { data: ap } = await supabase
          .from("appointments")
          .select("id, start_at, service_id, status")
          .ilike("client_email", e)
          .in("status", ["completed", "arrived", "approved"])
          .gte("start_at", since.toISOString())
          .lte("start_at", new Date().toISOString())
          .order("start_at", { ascending: false });
        const appts = (ap ?? []).filter((a: any) => differenceInCalendarDays(new Date(), new Date(a.start_at)) >= 1) as ApptLite[];
        if (!appts.length) { if (!cancel) setAppts([]); return; }

        const svcIds = Array.from(new Set(appts.map(a => a.service_id).filter(Boolean)));
        const [{ data: sv }, { data: chk }] = await Promise.all([
          supabase.from("services").select("id, name").in("id", svcIds),
          supabase.from("postop_checkins").select("appointment_id, day_offset, swelling, bruising, pain, photo_path, notes").in("appointment_id", appts.map(a => a.id)),
        ]);
        const svcMap: Record<string, string> = {};
        (sv ?? []).forEach((s: any) => { svcMap[s.id] = s.name; });
        const ex: Record<string, Existing> = {};
        (chk ?? []).forEach((c: any) => { ex[`${c.appointment_id}:${c.day_offset}`] = c; });

        if (!cancel) { setAppts(appts); setServices(svcMap); setExisting(ex); }
      } catch (err) {
        console.warn("PostOp load error:", err);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const due = useMemo(() => {
    // For each appointment, figure out which days are unlocked (elapsed) and
    // unsubmitted. Also include the most recent submitted day for context.
    const out: { apptId: string; day: number; serviceName: string; dueDate: Date; submitted: Existing | null; daysSince: number }[] = [];
    for (const a of appts) {
      const since = differenceInCalendarDays(new Date(), new Date(a.start_at));
      for (const d of CHECKIN_DAYS) {
        if (since < d) continue;
        const submitted = existing[`${a.id}:${d}`] ?? null;
        // Skip already-submitted days > 14 to keep list short.
        if (submitted && since - d > 7) continue;
        const dueDate = new Date(a.start_at); dueDate.setDate(dueDate.getDate() + d);
        out.push({ apptId: a.id, day: d, serviceName: services[a.service_id] ?? "Visit", dueDate, submitted, daysSince: since });
      }
    }
    return out.sort((a, b) => +b.dueDate - +a.dueDate);
  }, [appts, existing, services]);

  function setDraft(k: string, patch: Partial<Draft>) {
    setDrafts(s => ({ ...s, [k]: { swelling: undefined, bruising: undefined, pain: undefined, notes: "", photoPath: null, photoUrl: null, ...s[k], ...patch } }));
  }

  async function uploadPhoto(k: string, file: File) {
    if (!/^image\//.test(file.type)) { toast.error("Image only"); return; }
    if (file.size > 12 * 1024 * 1024) { toast.error("Max 12 MB"); return; }
    setBusy(`${k}:upload`);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${email}/postop/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("client-uploaded-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setBusy(null); toast.error(error.message); return; }
    const { data: signed } = await supabase.storage.from("client-uploaded-photos").createSignedUrl(path, 600);
    setDraft(k, { photoPath: path, photoUrl: signed?.signedUrl ?? null });
    setBusy(null);
  }

  async function submit(apptId: string, day: number) {
    const k = `${apptId}:${day}`;
    const d = drafts[k];
    if (!d || (d.swelling == null && d.bruising == null && d.pain == null && !d.notes && !d.photoPath)) {
      toast.error("Add at least one rating, photo, or note."); return;
    }
    setBusy(k);
    const { error } = await supabase.from("postop_checkins").upsert({
      appointment_id: apptId,
      client_email: email,
      day_offset: day,
      swelling: d.swelling ?? null,
      bruising: d.bruising ?? null,
      pain: d.pain ?? null,
      photo_path: d.photoPath,
      notes: d.notes.trim() || null,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "appointment_id,day_offset" });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Day ${day} check-in saved`);
    setExisting(s => ({
      ...s,
      [k]: {
        appointment_id: apptId, day_offset: day,
        swelling: d.swelling ?? null, bruising: d.bruising ?? null, pain: d.pain ?? null,
        photo_path: d.photoPath, notes: d.notes.trim() || null,
      },
    }));
    setDrafts(s => { const n = { ...s }; delete n[k]; return n; });
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading post-op…
      </div>
    );
  }
  if (due.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-lg">Recovery check-ins</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">A quick rating helps your provider spot issues early.</p>

      {due.map(({ apptId, day, serviceName, dueDate, submitted }) => {
        const k = `${apptId}:${day}`;
        const d = drafts[k];
        const isSubmitted = !!submitted;
        return (
          <div key={k} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <span className="font-medium">Day {day}</span>
                <span className="text-muted-foreground"> · {serviceName} · {format(dueDate, "EEE MMM d")}</span>
              </div>
              {isSubmitted && (
                <span className="text-[11px] text-success-soft-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Submitted
                </span>
              )}
            </div>

            {isSubmitted ? (
              <div className="text-xs text-muted-foreground space-y-1">
                {submitted!.swelling != null && <div>Swelling: <span className="tabular-nums text-foreground">{submitted!.swelling}/5</span></div>}
                {submitted!.bruising != null && <div>Bruising: <span className="tabular-nums text-foreground">{submitted!.bruising}/5</span></div>}
                {submitted!.pain != null && <div>Pain: <span className="tabular-nums text-foreground">{submitted!.pain}/5</span></div>}
                {submitted!.notes && <div className="italic">"{submitted!.notes}"</div>}
              </div>
            ) : (
              <>
                <ScaleRow label="Swelling" value={d?.swelling} onChange={v => setDraft(k, { swelling: v })} />
                <ScaleRow label="Bruising" value={d?.bruising} onChange={v => setDraft(k, { bruising: v })} />
                <ScaleRow label="Pain"     value={d?.pain}     onChange={v => setDraft(k, { pain: v })} />
                <Textarea
                  rows={2}
                  value={d?.notes ?? ""}
                  onChange={e => setDraft(k, { notes: e.target.value })}
                  placeholder="Anything you'd like your provider to know? (optional)"
                  className="text-sm"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  {d?.photoUrl ? (
                    <div className="relative inline-block">
                      <img src={d.photoUrl} alt="" className="h-16 w-16 object-cover rounded border border-border" />
                      <button
                        type="button"
                        onClick={() => setDraft(k, { photoPath: null, photoUrl: null })}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        aria-label="Remove photo"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-1 text-xs rounded-md border border-dashed border-border px-2 py-1.5 cursor-pointer hover:border-primary">
                      {busy === `${k}:upload`
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <ImagePlus className="h-3 w-3" />}
                      <span>Add photo (optional)</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) void uploadPhoto(k, f); e.currentTarget.value = ""; }}
                      />
                    </label>
                  )}
                  <div className="ml-auto">
                    <Button size="sm" onClick={() => submit(apptId, day)} disabled={busy === k}>
                      {busy === k ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Submit
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScaleRow({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-xs uppercase tracking-widest text-muted-foreground w-20">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n} type="button" onClick={() => onChange(n)}
            className={`h-7 w-7 rounded-full text-xs tabular-nums border transition ${value === n
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:border-primary/50"}`}
          >{n}</button>
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground w-20 text-right">1 none · 5 severe</span>
    </div>
  );
}

