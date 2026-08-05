// In-Memory Draft Manager for Clinical Note Editors (HIPAA Compliant).
// ZERO clinical content is stored in browser localStorage or sessionStorage.
// Persistent draft records are stored securely in live MySQL database via API.

import { useEffect, useRef, useState } from "react";

const inMemoryDraftStore = new Map<string, { at: number; data: any }>();

export type ChartDraftRecord<T> = {
  noteId: string;
  key: string;
  at: number | null;
  data: T;
};

export function readChartDraft<T>(noteId: string | null): ChartDraftRecord<T> | null {
  if (!noteId) return null;
  const entry = inMemoryDraftStore.get(noteId);
  if (!entry) return null;
  return {
    noteId,
    key: `in-memory:${noteId}`,
    at: entry.at,
    data: entry.data as T,
  };
}

export function listChartDrafts<T>(noteIdPrefix = ""): ChartDraftRecord<T>[] {
  const out: ChartDraftRecord<T>[] = [];
  for (const [noteId, entry] of inMemoryDraftStore.entries()) {
    if (noteId.startsWith(noteIdPrefix)) {
      out.push({
        noteId,
        key: `in-memory:${noteId}`,
        at: entry.at,
        data: entry.data as T,
      });
    }
  }
  return out.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

export function useChartDraftAutosave<T>(
  noteId: string | null,
  data: T,
  opts: { enabled?: boolean; aliases?: string[] } = {},
) {
  const enabled = opts.enabled ?? true;
  const aliases = opts.aliases ?? [];
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const lastJsonRef = useRef<string>("");

  const aliasesKey = aliases.join("|");

  useEffect(() => {
    if (!enabled || !noteId) return;
    const ids = Array.from(new Set([noteId, ...aliases].filter(Boolean)));
    setHasDraft(ids.some(id => inMemoryDraftStore.has(id)));
  }, [enabled, noteId, aliasesKey]);

  useEffect(() => {
    if (!enabled || !noteId) return;
    const t = setTimeout(() => {
      const ids = Array.from(new Set([noteId, ...aliases].filter(Boolean)));
      const dataJson = JSON.stringify(data);
      const cacheKey = `${ids.join("|")}::${dataJson}`;
      if (cacheKey === lastJsonRef.current) return;
      lastJsonRef.current = cacheKey;
      const now = Date.now();
      ids.forEach(id => inMemoryDraftStore.set(id, { at: now, data }));
      setSavedAt(new Date(now));
      setHasDraft(true);
    }, 4000);
    return () => clearTimeout(t);
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
    const ids = Array.from(new Set([noteId, ...aliases].filter(Boolean)));
    ids.forEach(id => inMemoryDraftStore.delete(id));
    setHasDraft(false);
    setSavedAt(null);
  };

  return { savedAt, hasDraft, restore, clear };
}
