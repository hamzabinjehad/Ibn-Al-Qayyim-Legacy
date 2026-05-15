import * as Dialog from "@radix-ui/react-dialog";
import { Download, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";
import { useUiTranslations } from "@/lib/ui-translations";

const SESSION_STARTED_AT_KEY = "ibn-qayyim-install-started-at";
const SESSION_PATHS_KEY = "ibn-qayyim-install-paths";
const SESSION_INTERACTIONS_KEY = "ibn-qayyim-install-interactions";
const SESSION_SCROLL_RATIO_KEY = "ibn-qayyim-install-scroll-ratio";
const SESSION_READING_MS_KEY = "ibn-qayyim-install-reading-ms";
const DISMISSED_UNTIL_KEY = "ibn-qayyim-install-dismissed-until";

const MINIMUM_READING_MS = 5 * 60 * 1000;
const READING_TICK_MS = 5_000;
const DISMISSAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

interface EngagementMetrics {
  interactionCount: number;
  maxScrollRatio: number;
  paths: string[];
  readingMs: number;
  startedAt: number;
}

function readSessionNumber(key: string, fallback: number) {
  try {
    const value = Number(window.sessionStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeSessionValue(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage can be disabled; the prompt still works with in-memory state.
  }
}

function readDismissedUntil() {
  try {
    const value = Number(window.localStorage.getItem(DISMISSED_UNTIL_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function setDismissedUntil(value: number) {
  try {
    window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(value));
  } catch {
    // Local storage is only used to avoid repeat prompts.
  }
}

function clearExpiredDismissal() {
  try {
    window.localStorage.removeItem(DISMISSED_UNTIL_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function readPaths(currentPath: string) {
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(SESSION_PATHS_KEY) ?? "[]",
    );
    const storedPaths = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
    return addPath(storedPaths, currentPath);
  } catch {
    return [currentPath];
  }
}

function addPath(paths: string[], path: string) {
  return Array.from(new Set([...paths, path])).slice(-8);
}

function readEngagementMetrics(currentPath: string): EngagementMetrics {
  const now = Date.now();
  const startedAt = readSessionNumber(SESSION_STARTED_AT_KEY, now);
  const metrics = {
    interactionCount: readSessionNumber(SESSION_INTERACTIONS_KEY, 0),
    maxScrollRatio: Math.min(1, readSessionNumber(SESSION_SCROLL_RATIO_KEY, 0)),
    paths: readPaths(currentPath),
    readingMs: readSessionNumber(SESSION_READING_MS_KEY, 0),
    startedAt,
  };

  writeSessionValue(SESSION_STARTED_AT_KEY, String(startedAt));
  writeSessionValue(SESSION_PATHS_KEY, JSON.stringify(metrics.paths));
  return metrics;
}

function persistEngagementMetrics(metrics: EngagementMetrics) {
  writeSessionValue(SESSION_STARTED_AT_KEY, String(metrics.startedAt));
  writeSessionValue(SESSION_PATHS_KEY, JSON.stringify(metrics.paths));
  writeSessionValue(SESSION_INTERACTIONS_KEY, String(metrics.interactionCount));
  writeSessionValue(SESSION_SCROLL_RATIO_KEY, String(metrics.maxScrollRatio));
  writeSessionValue(SESSION_READING_MS_KEY, String(metrics.readingMs));
}

function currentScrollRatio() {
  const documentElement = document.documentElement;
  const scrollHeight = Math.max(
    documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  const viewportHeight = window.innerHeight;
  if (scrollHeight <= viewportHeight) return 0;

  return Math.min(1, (window.scrollY + viewportHeight) / scrollHeight);
}

function isReaderPath(path: string) {
  return (
    /^\/edition\/\d+\/section\/\d+$/.test(path) ||
    /^\/book\/\d+\/chapter\/\d+$/.test(path)
  );
}

export default function PwaInstallPromptModal() {
  const [location] = useLocation();
  const { canInstall, install, isInstalled } = usePwaInstallPrompt();
  const { direction, t } = useUiTranslations();
  const [metrics, setMetrics] = useState(() => readEngagementMetrics(location));
  const [now, setNow] = useState(() => Date.now());
  const [dismissedUntil, setDismissedUntilState] = useState(readDismissedUntil);
  const [open, setOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const isReadingRoute = isReaderPath(location);

  const updateMetrics = useCallback(
    (updater: (current: EngagementMetrics) => EngagementMetrics) => {
      setMetrics((current) => {
        const next = updater(current);
        persistEngagementMetrics(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    updateMetrics((current) => ({
      ...current,
      paths: addPath(current.paths, location),
    }));
  }, [location, updateMetrics]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const recordInteraction = () => {
      updateMetrics((current) => ({
        ...current,
        interactionCount: Math.min(current.interactionCount + 1, 12),
      }));
    };

    window.addEventListener("pointerdown", recordInteraction, {
      passive: true,
    });
    window.addEventListener("keydown", recordInteraction);
    window.addEventListener("input", recordInteraction);

    return () => {
      window.removeEventListener("pointerdown", recordInteraction);
      window.removeEventListener("keydown", recordInteraction);
      window.removeEventListener("input", recordInteraction);
    };
  }, [updateMetrics]);

  useEffect(() => {
    let frame = 0;

    const recordScroll = () => {
      if (frame) return;

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const ratio = currentScrollRatio();
        updateMetrics((current) => {
          if (ratio <= current.maxScrollRatio) return current;
          return { ...current, maxScrollRatio: ratio };
        });
      });
    };

    recordScroll();
    window.addEventListener("scroll", recordScroll, { passive: true });
    window.addEventListener("resize", recordScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", recordScroll);
      window.removeEventListener("resize", recordScroll);
    };
  }, [location, updateMetrics]);

  useEffect(() => {
    if (!isReadingRoute) return;

    let lastRecordedAt =
      document.visibilityState === "visible" ? Date.now() : null;

    const recordReadingTime = () => {
      if (lastRecordedAt === null) return;

      const recordedAt = Date.now();
      const elapsed = recordedAt - lastRecordedAt;
      lastRecordedAt = recordedAt;

      if (elapsed <= 0) return;

      updateMetrics((current) => {
        if (current.readingMs >= MINIMUM_READING_MS) return current;
        return {
          ...current,
          readingMs: Math.min(current.readingMs + elapsed, MINIMUM_READING_MS),
        };
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastRecordedAt = Date.now();
        return;
      }

      recordReadingTime();
      lastRecordedAt = null;
    };

    const interval = window.setInterval(recordReadingTime, READING_TICK_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", recordReadingTime);

    return () => {
      recordReadingTime();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", recordReadingTime);
    };
  }, [isReadingRoute, updateMetrics]);

  useEffect(() => {
    if (dismissedUntil > 0 && dismissedUntil <= now) {
      clearExpiredDismissal();
      setDismissedUntilState(0);
    }
  }, [dismissedUntil, now]);

  const hasMeaningfulUse = useMemo(() => {
    return isReadingRoute && metrics.readingMs >= MINIMUM_READING_MS;
  }, [isReadingRoute, metrics.readingMs]);

  const isDismissed = dismissedUntil > now;

  useEffect(() => {
    if (
      canInstall &&
      !isInstalled &&
      !isDismissed &&
      hasMeaningfulUse &&
      !open
    ) {
      setOpen(true);
    }
  }, [canInstall, hasMeaningfulUse, isDismissed, isInstalled, open]);

  useEffect(() => {
    if (!canInstall || isInstalled) setOpen(false);
  }, [canInstall, isInstalled]);

  const dismissForLater = useCallback(() => {
    const nextDismissedUntil = Date.now() + DISMISSAL_DURATION_MS;
    setDismissedUntil(nextDismissedUntil);
    setDismissedUntilState(nextDismissedUntil);
    setOpen(false);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && open) {
      dismissForLater();
      return;
    }

    setOpen(nextOpen);
  };

  const handleInstall = async () => {
    setIsInstalling(true);
    const outcome = await install();
    setIsInstalling(false);
    setOpen(false);

    if (outcome !== "accepted") {
      dismissForLater();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby="pwa-install-description"
          className="fixed left-1/2 top-1/2 z-[81] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-popover p-5 text-popover-foreground shadow-[0_28px_90px_-36px_rgba(0,0,0,0.72)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:p-6"
          dir={direction}
        >
          <Dialog.Close
            aria-label={t("إغلاق طلب التحميل")}
            className="absolute end-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            type="button"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>

          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-foreground text-background shadow-[0_16px_34px_-24px_rgba(0,0,0,0.85)]">
            <Download className="h-5 w-5" />
          </div>

          <Dialog.Title className="mt-5 pe-9 font-display text-2xl font-bold leading-tight">
            {t("حمّل الموقع للقراءة لاحقاً")}
          </Dialog.Title>
          <Dialog.Description
            id="pwa-install-description"
            className="mt-3 text-sm leading-7 text-muted-foreground"
          >
            {t(
              "بعد أن قرأت لبعض الوقت، يمكنك تحميل الموقع ليبقى قريباً ويعمل بسرعة من جهازك.",
            )}
          </Dialog.Description>

          <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto]">
            <button
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              onClick={dismissForLater}
              type="button"
            >
              {t("ليس الآن")}
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
              disabled={isInstalling}
              onClick={handleInstall}
              type="button"
            >
              <Download className="h-4 w-4" />
              {isInstalling ? t("جاري فتح نافذة التحميل") : t("تحميل الموقع")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
