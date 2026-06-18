import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/lib/i18n";

const BOOK_CACHE = "books-offline";

// Same computation as static-library.ts DATA_BASE
const DATA_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/library-data`;

function editionUrl(language: string, editionId: number): string {
  return new URL(`${DATA_BASE}/${language}/editions/${editionId}.json`, location.origin).href;
}

const supported = typeof window !== "undefined" && "caches" in window;

async function checkCached(url: string): Promise<boolean> {
  if (!supported) return false;
  try {
    const cache = await caches.open(BOOK_CACHE);
    return !!(await cache.match(url));
  } catch {
    return false;
  }
}

export type OfflineStatus = "checking" | "unsaved" | "saving" | "saved";

export function useOfflineBook(editionId: number) {
  const { language } = useLanguage();
  const url = editionUrl(language, editionId);
  const [status, setStatus] = useState<OfflineStatus>("checking");

  useEffect(() => {
    setStatus("checking");
    checkCached(url).then((cached) => setStatus(cached ? "saved" : "unsaved"));
  }, [url]);

  const save = useCallback(async () => {
    if (!supported || status === "saving" || status === "saved") return;
    setStatus("saving");
    try {
      const cache = await caches.open(BOOK_CACHE);
      // Fetch fresh from network (bypassing SW stale-while-revalidate)
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await cache.put(url, response);
      setStatus("saved");
    } catch (err) {
      console.error("Failed to save book for offline reading:", err);
      setStatus("unsaved");
    }
  }, [url, status]);

  const remove = useCallback(async () => {
    if (!supported) return;
    try {
      const cache = await caches.open(BOOK_CACHE);
      await cache.delete(url);
      setStatus("unsaved");
    } catch {
      // ignore
    }
  }, [url]);

  return { status, save, remove };
}
