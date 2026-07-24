// useDictation: Web Speech API hook for hands-free chart dictation.
// Returns: { supported, listening, start, stop, transcript, interim, reset }
// On each finalized phrase, calls onAppend(text) so callers can append directly into a textarea state.
import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognition = any;

declare global {
  interface Window {
    SpeechRecognition?: { new(): SpeechRecognition };
    webkitSpeechRecognition?: { new(): SpeechRecognition };
  }
}

export function useDictation(opts?: { lang?: string; onAppend?: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!Ctor);
  }, []);

  const start = useCallback(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    if (recRef.current) { try { recRef.current.stop(); } catch { /* ignore */ } }
    const rec = new Ctor();
    rec.lang = opts?.lang ?? "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) opts?.onAppend?.(finalText.trim());
      setInterim(interimText);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => { setListening(false); setInterim(""); };
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [opts]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* ignore */ } }, []);

  return { supported, listening, start, stop, interim };
}
