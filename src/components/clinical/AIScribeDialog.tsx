// AI Scribe: record a visit conversation and turn it into a structured note.
// Uses Web Audio API + WAV encoding for reliable iOS/iPad/desktop capture.
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mic, Square, Sparkles, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointmentId: string | null;
  clientEmail: string;
  providerUserId: string;
  serviceName: string | null;
  category: string | null;
  // "note" (default) → generates a chart note; "gfe" → generates structured GFE fields.
  mode?: "note" | "gfe";
  // Extra JSON body merged into the generate call (e.g. GFE enum option lists).
  generateExtraBody?: Record<string, unknown>;
  onGenerated: (result: { narrative?: string; structured?: Record<string, unknown>; gfe?: Record<string, unknown>; transcript: string }) => void;
};


// Encode Float32 PCM chunks to a 16-bit mono WAV Blob.
function encodeWav(chunks: Float32Array[], sampleRate: number, targetRate = 16000): Blob {
  // Concatenate
  const totalLen = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(totalLen);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }

  // Downsample to targetRate
  const ratio = sampleRate / targetRate;
  const outLen = Math.floor(merged.length / ratio);
  const down = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, merged.length - 1);
    const frac = idx - lo;
    down[i] = merged[lo] * (1 - frac) + merged[hi] * frac;
  }

  // WAV: 44-byte header + PCM16
  const buffer = new ArrayBuffer(44 + down.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + down.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);       // PCM
  view.setUint16(22, 1, true);       // mono
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, down.length * 2, true);
  let ptr = 44;
  for (let i = 0; i < down.length; i++) {
    const s = Math.max(-1, Math.min(1, down[i]));
    view.setInt16(ptr, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    ptr += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function AIScribeDialog(props: Props) {
  const { open, onOpenChange, appointmentId, clientEmail, providerUserId, serviceName, category, onGenerated, mode = "note", generateExtraBody } = props;
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "recording" | "uploading" | "transcribing" | "generating" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const [intakeConsent, setIntakeConsent] = useState<{ signed_at: string; name: string } | null>(null);

  useEffect(() => {
    if (!open) resetAll();
    return () => { if (open) stopStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Look up a valid AI scribe consent on file (within 12 months) from either
  // (a) the standalone universal `ai-scribe` consent form signed via the
  //     consent packet, or (b) the intake form's ai_scribe_consent checkbox.
  useEffect(() => {
    if (!open || !clientEmail) { setIntakeConsent(null); return; }
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const nowIso = new Date().toISOString();
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();

        // (a) Standalone AI Scribe consent form
        const { data: form } = await supabase
          .from("consent_forms")
          .select("id")
          .eq("slug", "ai-scribe")
          .eq("is_active", true)
          .maybeSingle();
        if (form?.id) {
          const { data: sig } = await supabase
            .from("consent_signatures")
            .select("signed_at, expires_at, decision, signed_full_name")
            .eq("consent_form_id", form.id)
            .eq("client_email", clientEmail.toLowerCase())
            .eq("decision", "consent")
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .order("signed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (sig?.signed_at) {
            setIntakeConsent({ signed_at: sig.signed_at, name: (sig as any).signed_full_name ?? "" });
            setConsent(true);
            return;
          }
        }

        // (b) Fallback: intake form checkbox
        const { data } = await supabase
          .from("client_intake_submissions")
          .select("ai_scribe_consent, ai_scribe_consent_at, signature_full_name, submitted_at")
          .eq("client_email", clientEmail.toLowerCase())
          .eq("ai_scribe_consent", true)
          .gte("submitted_at", oneYearAgo)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.ai_scribe_consent) {
          setIntakeConsent({
            signed_at: (data as any).ai_scribe_consent_at ?? (data as any).submitted_at,
            name: (data as any).signature_full_name ?? "",
          });
          setConsent(true);
        }
      } catch { /* ignore */ }
    })();
  }, [open, clientEmail]);



  function resetAll() {
    stopStream();
    setConsent(false);
    setStatus("idle");
    setElapsed(0);
    setTranscript("");
    setError(null);
    setSessionId(null);
    chunksRef.current = [];
  }

  function stopStream() {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    try { nodeRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    nodeRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
  }

  async function startRecording() {
    setError(null);
    if (!clientEmail) { setError("No patient loaded"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      // Insert session row first
      const { data: sess, error: iErr } = await supabase
        .from("scribe_sessions")
        .insert({
          appointment_id: appointmentId,
          client_email: clientEmail.toLowerCase(),
          provider_user_id: providerUserId,
          service_name: serviceName,
          category,
          status: "recording",
          consent_confirmed_at: new Date().toISOString(),
        })
        .select("id").single();
      if (iErr || !sess) throw new Error(iErr?.message || "Could not create session");
      setSessionId(sess.id);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      chunksRef.current = [];
      node.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(node);
      node.connect(ctx.destination);

      startedAtRef.current = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 500);
      setStatus("recording");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("Permission") ? "Microphone permission denied" : msg);
      stopStream();
    }
  }

  async function stopAndProcess() {
    if (status !== "recording") return;
    const sr = audioCtxRef.current?.sampleRate ?? 44100;
    const sid = sessionId;
    // capture buffered chunks then stop
    const captured = chunksRef.current;
    stopStream();
    if (!sid) { setError("Session missing"); return; }
    if (!captured.length) { setError("No audio captured — please try again"); setStatus("idle"); return; }

    const blob = encodeWav(captured, sr, 16000);
    if (blob.size < 4096) {
      setError("Recording was too short — please try again");
      setStatus("idle");
      return;
    }
    setStatus("uploading");

    try {
      const fd = new FormData();
      fd.append("file", blob, "recording.wav");
      fd.append("session_id", sid);

      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-scribe`;

      setStatus("transcribing");
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const trJson = await resp.json();
      if (!resp.ok) throw new Error(trJson.error || "Transcription failed");
      setTranscript(trJson.transcript || "");

      setStatus("generating");
      const action = mode === "gfe" ? "generate_gfe" : "generate";
      const gResp = await supabase.functions.invoke("ai-scribe", {
        body: { action, session_id: sid, ...(generateExtraBody ?? {}) },
      });
      if (gResp.error) throw new Error(gResp.error.message || "Note generation failed");
      const g = gResp.data as { narrative?: string; structured?: Record<string, unknown>; gfe?: Record<string, unknown> };
      setStatus("done");
      onGenerated({
        narrative: g.narrative || "",
        structured: g.structured || {},
        gfe: g.gfe || {},
        transcript: trJson.transcript || "",
      });
      toast.success(mode === "gfe" ? "GFE draft filled in — review before signing" : "AI note drafted — review before signing");
      onOpenChange(false);

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("idle");
      toast.error(msg);
    }
  }

  const busy = status === "uploading" || status === "transcribing" || status === "generating";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Scribe
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-warning/60 bg-warning-soft p-3 text-xs text-warning-soft-foreground flex gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">California two-party consent</div>
              {intakeConsent ? (
                <>Signed AI-Scribe consent on file from <strong>{intakeConsent.name || "the patient"}</strong> ({new Date(intakeConsent.signed_at).toLocaleDateString()}). Still give a brief verbal reminder before recording. Audio auto-deletes after 30 days.</>
              ) : (
                <>Confirm the patient has verbally consented to being recorded for AI-assisted documentation. Audio is auto-deleted after 30 days.</>
              )}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              disabled={status !== "idle"}
              className="mt-0.5"
            />
            <span>{intakeConsent ? "I gave the patient a verbal reminder that this visit will be recorded." : "Patient has verbally consented to being recorded for this visit."}</span>
          </label>


          {status === "recording" && (
            <div className="rounded-md border bg-destructive/10 border-destructive/40 px-3 py-4 text-center">
              <div className="text-3xl font-mono font-semibold tabular-nums">
                {Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}
              </div>
              <div className="text-xs text-destructive mt-1 flex items-center justify-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-pulse" />
                Recording…
              </div>
            </div>
          )}

          {busy && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              {status === "uploading" && "Uploading audio…"}
              {status === "transcribing" && "Transcribing conversation…"}
              {status === "generating" && "Drafting clinical note…"}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs p-2">
              {error}
            </div>
          )}

          {transcript && !busy && (
            <div className="rounded-md border bg-muted/40 p-2 text-xs max-h-40 overflow-auto">
              <div className="font-semibold mb-1 text-muted-foreground uppercase text-[10px] tracking-wider">Transcript preview</div>
              {transcript}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            {status === "idle" && (
              <>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={startRecording} disabled={!consent} className="gap-1.5">
                  <Mic className="h-4 w-4" /> Start recording
                </Button>
              </>
            )}
            {status === "recording" && (
              <Button variant="destructive" onClick={stopAndProcess} className="gap-1.5">
                <Square className="h-4 w-4" /> Stop & draft note
              </Button>
            )}
            {busy && <Button disabled className="gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Processing…</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
