import { useEffect, useMemo, useState } from "react";

const PREFIX = "ibn-al-qayyim";

export interface LocalReadingPosition {
  bookId: number;
  bookTitle: string;
  chapterId: number;
  chapterTitle: string;
  /** Percentage of the whole book reached from the current chapter/page. */
  progress: number;
  savedAt: number;
  scrollY: number;
}

export interface LocalHighlight {
  bookId: number;
  bookTitle: string;
  chapterId: number;
  chapterTitle: string;
  color: string;
  createdAt: number;
  id: string;
  text: string;
}

export interface LocalNote {
  bookId: number;
  bookTitle: string;
  chapterId: number;
  chapterTitle: string;
  createdAt: number;
  id: string;
  note: string;
  selectedText?: string;
}

export interface ReaderSettings {
  fontFamily: "naskh" | "amiri";
  fontSize: number;
  showHarakat: boolean;
}

const KEYS = {
  highlights: `${PREFIX}:highlights`,
  notes: `${PREFIX}:notes`,
  readerSettings: `${PREFIX}:reader-settings`,
  readingPosition: `${PREFIX}:reading-position`,
  recentBooks: `${PREFIX}:recent-books`,
};

const DEFAULT_SETTINGS: ReaderSettings = {
  fontFamily: "amiri",
  fontSize: 22,
  showHarakat: true,
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("local-library-change", { detail: key }));
}

function useStoredValue<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStorage(key, fallback));

  useEffect(() => {
    const update = () => setValue(readStorage(key, fallback));
    window.addEventListener("storage", update);
    window.addEventListener("local-library-change", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("local-library-change", update);
    };
  }, [fallback, key]);

  const setStoredValue = (next: T | ((current: T) => T)) => {
    const valueToWrite = typeof next === "function" ? (next as (current: T) => T)(readStorage(key, fallback)) : next;
    writeStorage(key, valueToWrite);
    setValue(valueToWrite);
  };

  return [value, setStoredValue] as const;
}

export function useLocalLibrary() {
  const [highlights, setHighlights] = useStoredValue<LocalHighlight[]>(KEYS.highlights, []);
  const [notes, setNotes] = useStoredValue<LocalNote[]>(KEYS.notes, []);
  const [positions, setPositions] = useStoredValue<LocalReadingPosition[]>(KEYS.readingPosition, []);
  const [settings, setSettings] = useStoredValue<ReaderSettings>(KEYS.readerSettings, DEFAULT_SETTINGS);

  return useMemo(
    () => ({
      addHighlight: (highlight: Omit<LocalHighlight, "createdAt" | "id">) =>
        setHighlights((current) => [
          {
            ...highlight,
            createdAt: Date.now(),
            id: crypto.randomUUID(),
          },
          ...current,
        ]),
      addNote: (note: Omit<LocalNote, "createdAt" | "id">) =>
        setNotes((current) => [
          {
            ...note,
            createdAt: Date.now(),
            id: crypto.randomUUID(),
          },
          ...current,
        ]),
      deleteHighlight: (id: string) => setHighlights((current) => current.filter((item) => item.id !== id)),
      deleteNote: (id: string) => setNotes((current) => current.filter((item) => item.id !== id)),
      deletePosition: (chapterId: number) => setPositions((current) => current.filter((item) => item.chapterId !== chapterId)),
      highlights,
      notes,
      positions,
      savePosition: (position: LocalReadingPosition) =>
        setPositions((current) => [
          position,
          ...current.filter((item) => item.chapterId !== position.chapterId).slice(0, 19),
        ]),
      settings,
      setSettings,
    }),
    [highlights, notes, positions, setHighlights, setNotes, setPositions, settings, setSettings],
  );
}

export function stripHarakat(text: string) {
  return text.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, "");
}
