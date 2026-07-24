// Lightweight offline-resilient draft autosave for chart-note editors.
// Persists the entire form state to localStorage every few seconds so a dropped
// connection or accidental reload never loses a chart in progress. Drafts are
// keyed by note id and cleared once the note is successfully saved/signed.
import { useEffect, useRef, useState } from "react";

const KEY_PREFIX = "rka:chart-draft:";
const AUTOSAVE_MS = 4000;
const EMPTY_ALIASES: string[] = [];

export type ChartDraftRecord<T> = {
  noteId: string;
  key: string;
  at: number | null;
  data: T;
};

export function readChartDraft<T>(noteId: string | null): ChartDraftRecord<T> | null {
  if (!noteId) return null;
  try {
    const key = KEY_PREFIX + noteId;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    return {
      noteId,
      key,
      at: typeof parsed.at === "number" ? parsed.at : null,
      data: parsed.data as T,
    };
  } catch { return null; }
}

export function listChartDrafts<T>(noteIdPrefix = ""): ChartDraftRecord<T>[] {
  try {
    const out: ChartDraftRecord<T>[] = [];
    const fullPrefix = KEY_PREFIX + noteIdPrefix;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(fullPrefix)) continue;
      const noteId = key.slice(KEY_PREFIX.length);
      const draft = readChartDraft<T>(noteId);
      if (draft) out.push(draft);
    }
    return out.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  } catch { return []; }
}

export function useChartDraftAutosave<T>(
  noteId: string | null,
  data: T,
  opts: { enabled?: boolean; aliases?: string[] } = {},
) {
  const enabled = opts.enabled ?? true;
  const aliases = opts.aliases ?? EMPTY_ALIASES;
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const lastJsonRef = useRef<string>("");

  // Stable key for aliases so a fresh-array-each-render caller doesn't restart
  // the 4s debounce on every keystroke.
  const aliasesKey = aliases.join("|");

  useEffect(() => {
    if (!enabled || !noteId) return;
    try {
      const ids = Array.from(new Set([noteId, ...aliases].filter(Boolean)));
      setHasDraft(ids.some(id => !!localStorage.getItem(KEY_PREFIX + id)));
    } catch { /* private mode */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, noteId, aliasesKey]);

  useEffect(() => {
    if (!enabled || !noteId) return;
    const t = setTimeout(() => {
      try {
        const ids = Array.from(new Set([noteId, ...aliases].filter(Boolean)));
        const dataJson = JSON.stringify(data);
        const cacheKey = `${ids.join("|")}::${dataJson}`;
        if (cacheKey === lastJsonRef.current) return;
        lastJsonRef.current = cacheKey;
        const payload = JSON.stringify({ at: Date.now(), data });
        ids.forEach(id => localStorage.setItem(KEY_PREFIX + id, payload));
        setSavedAt(new Date());
      } catch { /* quota / private mode — silent */ }
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, noteId, aliasesKey, data]);

  const restore = (): T | null => {
    const ids = Array.from(new Set([noteId, ...aliases].filter(Boolean)));
    for (const id of ids) {
      const draft = readChartDraft<T>(id);
      if (draft) return draft.data;
    }
    return null;
  };

  const clear = () => {
    if (!noteId) return;
    try {
      const ids = Array.from(new Set([noteId, ...aliases].filter(Boolean)));
      ids.forEach(id => localStorage.removeItem(KEY_PREFIX + id));
    } catch { /* ignore */ }
    setHasDraft(false);
    setSavedAt(null);
  };

  return { savedAt, hasDraft, restore, clear };
}
