import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import {
  Bookmark,
  ChevronUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Github,
  Menu,
  Highlighter,
  ListTree,
  MessageSquareText,
  MessageSquareWarning,
  Minus,
  Plus,
  Search,
  Share2,
  StickyNote,
  Type,
  X,
} from "lucide-react";
import BookTocTree from "@/components/BookTocTree";
import { useOnboardingTour } from "@/components/OnboardingTour";
import AppShell from "@/components/editorial/AppShell";
import { ErrorState, LoadingState } from "@/components/editorial/DataState";
import { DirectionalArrow } from "@/components/editorial/DirectionalIcon";
import ProgressLine from "@/components/editorial/ProgressLine";
import QuoteShareModal from "@/components/QuoteShareModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buildSourceEditUrl, buildTranslationIssueUrl } from "@/lib/contribution-links";
import { getHighlightStyle, HIGHLIGHT_PALETTE } from "@/lib/highlights";
import { type LocalHighlight, stripHarakat, useLocalLibrary } from "@/lib/local-library";
import { calculateBookPageProgress } from "@/lib/reading-progress";
import { type ChapterSummary, type PageDetail, useStaticBook, useStaticBookChapter } from "@/lib/static-library";
import { pageText, readingMetaText, translateUi, useUiTranslations } from "@/lib/ui-translations";

type ReaderStatus = "copied" | "highlighted" | "noted" | "saved" | null;
type HighlightColor = string;

type PageFootnote = {
  id: string;
  marker: string;
  markerKey: string;
  text: string;
};

type ParsedFootnote = {
  marker: string;
  text: string;
};

const FOOTNOTE_DIGIT_CLASS = "\\d\\u0660-\\u0669\\u06f0-\\u06f9";
const FOOTNOTE_SEPARATOR_REGEX = /(?:^|\n)\s*(?:_{5,}|\u0640{5,}|-{5,})\s*(?:\n|$)|\s+(?:_{5,}|\u0640{5,}|-{5,})\s+/u;
const FOOTNOTE_BLOCK_MARKER_REGEX = new RegExp(
  `(?:^|\\n)\\s*(?:\\(\\^?([${FOOTNOTE_DIGIT_CLASS}]+)\\)|\\[([${FOOTNOTE_DIGIT_CLASS}]+)\\]|(\\^?[${FOOTNOTE_DIGIT_CLASS}]+))\\s*[\\-\\u2013\\u2014:\\uFF1A\\.\\u060c]?\\s*`,
  "gu",
);
const FOOTNOTE_REFERENCE_REGEX = new RegExp(
  `\\(\\^?[${FOOTNOTE_DIGIT_CLASS}]+\\)|([\\p{L}\\]\\)\\u00bb])([${FOOTNOTE_DIGIT_CLASS}]{1,3})(?![${FOOTNOTE_DIGIT_CLASS}])`,
  "gu",
);
const FOOTNOTE_FOCUS_MS = 2200;

function currentScrollY() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function scrollTopThreshold() {
  return Math.min(700, Math.max(360, window.innerHeight * 0.7));
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for browsers that expose Clipboard API but block it outside secure gestures.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function buildShareText(text: string, bookTitle: string, chapterTitle: string, language: "ar" | "de" | "en") {
  return `${text.trim()}\n\n- ${translateUi(language, "ابن القيم الجوزية رحمه الله")}\n${bookTitle} / ${chapterTitle}`;
}

function normalizeFootnoteMarker(marker: string) {
  return marker
    .replace(/[\[\]()^]/g, "")
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .trim();
}

function displayFootnoteMarker(marker: string) {
  return marker.replace(/[\[\]()^]/g, "").trim();
}

function footnoteId(pageId: number, markerKey: string) {
  return `reader-footnote-${pageId}-${markerKey.replace(/[^\w-]/g, "")}`;
}

function displayPageNumber(page: Pick<PageDetail, "pageNumber" | "sourcePageNumber"> | undefined) {
  return page?.sourcePageNumber ?? page?.pageNumber ?? 0;
}

function parseFootnoteBlock(text: string): ParsedFootnote[] {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) return [];

  const matches = Array.from(normalized.matchAll(FOOTNOTE_BLOCK_MARKER_REGEX));
  if (matches.length === 0) {
    return [{ marker: "", text: normalized }];
  }

  return matches
    .map((match, index) => {
      const marker = match[1] ?? match[2] ?? match[3] ?? "";
      const start = (match.index ?? 0) + (match[0]?.length ?? 0);
      const end = matches[index + 1]?.index ?? normalized.length;
      const footnoteText = normalized.slice(start, end).replace(/^\s*[:：.،-]?\s*/, "").trim();
      return { marker, text: footnoteText };
    })
    .filter((footnote) => footnote.marker || footnote.text);
}

function splitPageFootnotes(text: string) {
  const match = FOOTNOTE_SEPARATOR_REGEX.exec(text);
  if (!match) {
    return {
      footnotes: [] as ParsedFootnote[],
      mainText: text,
      rawFootnotes: "",
    };
  }

  const mainText = text.slice(0, match.index).trimEnd();
  const rawFootnotes = text.slice(match.index + match[0].length).trim();

  return {
    footnotes: parseFootnoteBlock(rawFootnotes),
    mainText,
    rawFootnotes,
  };
}

function renderHighlightedText(text: string, highlights: LocalHighlight[]) {
  const matches = highlights
    .map((highlight) => ({ color: highlight.color, highlightText: highlight.text.trim() }))
    .filter(
      (highlight, index, list) =>
        highlight.highlightText.length > 0 &&
        list.findIndex((item) => item.highlightText === highlight.highlightText) === index,
    )
    .map((highlight) => ({ ...highlight, index: text.indexOf(highlight.highlightText) }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index || b.highlightText.length - a.highlightText.length);

  if (matches.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match) => {
    if (match.index < cursor) return;
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    nodes.push(
      <mark
        className="reader-highlight reader-inline-highlight"
        key={`${match.index}-${match.highlightText}`}
        style={getHighlightStyle(match.color)}
      >
        {match.highlightText}
      </mark>,
    );
    cursor = match.index + match.highlightText.length;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function renderReaderText(
  text: string,
  highlights: LocalHighlight[],
  footnoteTargets: Map<string, string>,
  language: "ar" | "de" | "en",
  onFootnoteReference: (footnoteId: string) => void,
) {
  const matches = Array.from(text.matchAll(FOOTNOTE_REFERENCE_REGEX)).filter((match) => {
    const marker = match[2] ?? match[0] ?? "";
    return footnoteTargets.has(normalizeFootnoteMarker(marker));
  });
  if (matches.length === 0) return renderHighlightedText(text, highlights);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    const prefix = match[1] ?? "";
    const marker = match[2] ?? match[0] ?? "";
    const markerIndex = (match.index ?? 0) + prefix.length;
    const markerKey = normalizeFootnoteMarker(marker);
    const targetId = footnoteTargets.get(markerKey);

    if (markerIndex > cursor) {
      const chunk = text.slice(cursor, markerIndex);
      nodes.push(<Fragment key={`text-${cursor}`}>{renderHighlightedText(chunk, highlights)}</Fragment>);
    }

      nodes.push(
        <button
          aria-label={translateUi(language, "الانتقال إلى الحاشية {marker}", {
            marker: displayFootnoteMarker(marker),
          })}
          className="reader-footnote-ref"
        key={`footnote-ref-${markerKey}-${markerIndex}-${index}`}
        onClick={() => onFootnoteReference(targetId!)}
        type="button"
      >
        {displayFootnoteMarker(marker)}
      </button>,
    );

    cursor = markerIndex + marker.length;
  });

  if (cursor < text.length) {
    nodes.push(<Fragment key={`text-${cursor}`}>{renderHighlightedText(text.slice(cursor), highlights)}</Fragment>);
  }

  return nodes;
}

export default function ChapterReader() {
  const { direction, language, t } = useUiTranslations();
  const { bookId, chapterId, editionId, sectionId } = useParams<{
    bookId?: string;
    chapterId?: string;
    editionId?: string;
    sectionId?: string;
  }>();
  const bookIdNum = Number(editionId ?? bookId);
  const chapterIdNum = Number(sectionId ?? chapterId);
  const { data: book } = useStaticBook(bookIdNum);
  const { data: chapter, isLoading, isError, refetch } = useStaticBookChapter(bookIdNum, chapterIdNum);
  const { addHighlight, addNote, highlights, savePosition, settings, setSettings } = useLocalLibrary();
  const [tocOpen, setTocOpen] = useState(false);
  const [selection, setSelection] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [status, setStatus] = useState<ReaderStatus>(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [shareText, setShareText] = useState<string | null>(null);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>(HIGHLIGHT_PALETTE[0].value);
  const [activeFootnoteId, setActiveFootnoteId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectionToolbarRef = useRef<HTMLDivElement>(null);
  const { activeStepId, isTourOpen } = useOnboardingTour();
  const tourSelectionText = t("فإن في القلب شعثا لا يلمه إلا الإقبال على الله");

  const body = settings.showHarakat ? chapter?.content ?? "" : stripHarakat(chapter?.content ?? "");
  const fontFamily = settings.fontFamily === "amiri" ? "var(--app-font-serif)" : "var(--app-font-sans)";

  const chapters = book?.chapters ?? [];
  const currentIndex = chapters.findIndex((item) => item.id === chapterIdNum);
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? chapters[currentIndex + 1] : null;
  const bookProgress = useMemo(() => calculateBookPageProgress(book, chapter), [book, chapter]);

  const chapterHighlights = useMemo(
    () => highlights.filter((highlight) => highlight.chapterId === chapterIdNum),
    [chapterIdNum, highlights],
  );
  const showTourSelectionDemo = isTourOpen && activeStepId === "selection-actions";
  const showTourShareDemo =
    isTourOpen && (activeStepId === "share-quote" || activeStepId === "customize-image" || activeStepId === "export-share");

  const renderedPages = useMemo(() => {
    const pages = chapter?.pages ?? [];
    if (pages.length === 0) {
      return [{ id: chapter?.id ?? 0, pageNumber: chapter?.page ?? 0, sourcePageNumber: undefined, text: body, volume: "" }];
    }
    return pages.map((page) => ({ ...page, text: settings.showHarakat ? page.text : stripHarakat(page.text) }));
  }, [body, chapter?.id, chapter?.page, chapter?.pages, settings.showHarakat]);

  const pageContent = useMemo(
    () =>
      renderedPages.map((page) => {
        const parsed = splitPageFootnotes(page.text);
        const footnotes = parsed.footnotes.map((footnote, index) => {
          const markerKey = normalizeFootnoteMarker(footnote.marker);
          return {
            ...footnote,
            id: markerKey ? footnoteId(page.id, markerKey) : `reader-footnote-${page.id}-unmarked-${index}`,
            markerKey,
          };
        });
        const footnoteTargets = new Map(
          footnotes.filter((footnote) => footnote.markerKey).map((footnote) => [footnote.markerKey, footnote.id]),
        );
        const visibleText = settings.showFootnotes
          ? [parsed.mainText, parsed.rawFootnotes].filter(Boolean).join("\n\n")
          : parsed.mainText;

        return {
          ...page,
          ...parsed,
          footnotes,
          footnoteTargets,
          visibleText,
        };
      }),
    [renderedPages, settings.showFootnotes],
  );

  const visibleBody = useMemo(
    () => pageContent.map((page) => page.visibleText).join("\n\n"),
    [pageContent],
  );

  const visibleReadingMinutes = useMemo(() => {
    const count = visibleBody.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(count / 180));
  }, [visibleBody]);
  const chapterDisplayPage = displayPageNumber(renderedPages[0]);

  const scrollToFootnote = useCallback((id: string) => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
      }
    });
  }, []);

  const scrollToTop = useCallback(() => {
    document.documentElement.scrollTo?.({ top: 0, behavior: "smooth" });
    document.body.scrollTo?.({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleFootnoteReference = useCallback(
    (id: string) => {
      setActiveFootnoteId(id);
      if (!settings.showFootnotes) {
        setSettings((current) => ({ ...current, showFootnotes: true }));
      }
    },
    [setSettings, settings.showFootnotes],
  );

  const showStatus = (nextStatus: ReaderStatus) => {
    setStatus(nextStatus);
    window.setTimeout(() => setStatus(null), 1800);
  };

  const saveCurrentPosition = useCallback(() => {
    if (!chapter || !book) return;
    savePosition({
      bookId: book.id,
      bookTitle: book.titleAr,
      chapterId: chapter.id,
      chapterTitle: chapter.titleAr,
      progress: bookProgress,
      savedAt: Date.now(),
      scrollY: window.scrollY,
      workId: book.workId,
      workTitle: book.workTitleAr,
    });
  }, [book, bookProgress, chapter, savePosition]);

  useEffect(() => {
    const interval = window.setInterval(saveCurrentPosition, 3000);
    return () => window.clearInterval(interval);
  }, [saveCurrentPosition]);

  useEffect(() => {
    clearSelection();
    setActiveFootnoteId(null);
  }, [chapterIdNum]);

  useEffect(() => {
    const updateScrollTopVisibility = () => {
      setShowScrollTop(currentScrollY() > scrollTopThreshold());
    };

    updateScrollTopVisibility();
    window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollTopVisibility);
  }, [bookIdNum, chapterIdNum]);

  useEffect(() => {
    if (!activeFootnoteId || !settings.showFootnotes) return;
    scrollToFootnote(activeFootnoteId);
    const timeout = window.setTimeout(() => {
      setActiveFootnoteId((current) => (current === activeFootnoteId ? null : current));
    }, FOOTNOTE_FOCUS_MS);
    return () => window.clearTimeout(timeout);
  }, [activeFootnoteId, scrollToFootnote, settings.showFootnotes]);

  useEffect(() => {
    const onSelection = () => {
      const selected = window.getSelection()?.toString().trim() ?? "";
      const anchor = window.getSelection()?.anchorNode;
      if (selected.length > 1 && anchor && contentRef.current?.contains(anchor)) {
        setSelection(selected);
      }
    };
    document.addEventListener("mouseup", onSelection);
    document.addEventListener("touchend", onSelection);
    return () => {
      document.removeEventListener("mouseup", onSelection);
      document.removeEventListener("touchend", onSelection);
    };
  }, []);

  useEffect(() => {
    if (!selection) return;

    const onPointerDown = (event: PointerEvent) => {
      if (selectionToolbarRef.current?.contains(event.target as Node)) return;
      clearSelection();
    };

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 0) {
        clearSelection();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [selection]);

  const selectionPayload = () => ({
    bookId: book!.id,
    bookTitle: book!.titleAr,
    chapterId: chapter!.id,
    chapterTitle: chapter!.titleAr,
    text: selection,
  });

  const clearSelection = () => {
    setSelection("");
    setNoteDraft("");
    window.getSelection()?.removeAllRanges();
  };

  const handleCopyChapter = async () => {
    if (!book || !chapter) return;
    await copyText(buildShareText(visibleBody, book.titleAr, chapter.titleAr, language));
    showStatus("copied");
  };

  const handleCopySelection = async () => {
    await copyText(buildShareText(selection, book!.titleAr, chapter!.titleAr, language));
    showStatus("copied");
  };

  const handleSavePosition = () => {
    saveCurrentPosition();
    showStatus("saved");
  };

  if (isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  if (isError || !chapter || !book) {
    return (
      <AppShell>
        <main className="mx-auto max-w-4xl px-5 py-16">
          <ErrorState retry={() => refetch()} title="تعذر تحميل الفصل" />
        </main>
      </AppShell>
    );
  }

  const isTranslation = book.kind === "translation";
  const sourceEditUrl = isTranslation && book.sourceFile ? buildSourceEditUrl(book.sourceFile) : null;
  const buildCorrectionUrl = (selectedText?: string) => {
    const relatedPage =
      selectedText && selectedText.trim()
        ? pageContent.find((page) => page.visibleText.includes(selectedText.trim())) ?? pageContent[0]
        : pageContent[0];

    return buildTranslationIssueUrl({
      currentUrl: typeof window !== "undefined" ? window.location.href : undefined,
      editionId: book.id,
      editionTitle: book.titleAr,
      language,
      pageNumber: relatedPage?.pageNumber,
      sectionId: chapter.id,
      sectionTitle: chapter.titleAr,
      selectedText,
      sourceFile: book.sourceFile,
      sourcePageNumber: relatedPage?.sourcePageNumber,
      workTitle: book.workTitleAr,
    });
  };

  return (
    <AppShell>
      <main className="scholarly-bg min-h-screen px-4 pb-40 pt-6 md:px-6" id="main-content">
        <div className="mx-auto max-w-6xl">
          <article className="reader-surface surface-card mx-auto min-w-0 max-w-6xl" data-tour="reader-text">
          <div className="reader-chrome sticky top-14 z-30 rounded-none border-x-0 border-t-0">
            <div className="flex h-14 items-center justify-between gap-3 px-4">
              <button
                onClick={() => setTocOpen(true)}
                className="reader-control inline-flex h-10 w-10 items-center justify-center"
                aria-label={t("المحتويات")}
              >
                <Menu className="h-4 w-4" />
              </button>
              <Link
                aria-label={t("العودة إلى الكتاب")}
                className="min-w-0 flex-1 text-center transition-colors hover:text-muted-foreground"
                href={`/edition/${book.id}`}
              >
                <p className="truncate text-sm font-semibold">{book.titleAr}</p>
                <p className="truncate text-xs text-muted-foreground">{chapter.titleAr}</p>
              </Link>
              <div className="flex items-center gap-1 text-muted-foreground">
                <button
                  onClick={handleSavePosition}
                  className="reader-control inline-flex h-10 w-10 items-center justify-center"
                  aria-label={t("حفظ موضع القراءة")}
                >
                  <Bookmark className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCopyChapter}
                  data-tour="reader-copy-chapter"
                  className="reader-control inline-flex h-10 w-10 items-center justify-center"
                  aria-label={t("نسخ الفصل")}
                >
                  <Copy className="h-4 w-4" />
                </button>
                <Link
                  href={`/search?target=section&editionId=${book.id}&sectionId=${chapter.id}`}
                  className="reader-control inline-flex h-10 w-10 items-center justify-center"
                  aria-label={t("البحث داخل هذا القسم")}
                >
                  <Search className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 pb-3 text-xs text-muted-foreground">
              <span className="tabular-nums">{Math.round(bookProgress)}%</span>
              <ProgressLine className="flex-1" showValue={false} value={bookProgress} />
            </div>
          </div>

          <header className="reader-header mx-auto max-w-4xl border-b border-border px-6 py-10 text-center md:px-12 md:py-14">
            <h1 className="mx-auto max-w-3xl font-display text-3xl font-bold leading-tight md:text-5xl">
              {chapter.titleAr}
            </h1>
            <p className="mt-4 text-sm text-muted-foreground tabular-nums">
              {readingMetaText(visibleReadingMinutes, chapterDisplayPage, language)}
            </p>
            {isTranslation && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <a
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  href={buildCorrectionUrl()}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MessageSquareWarning className="h-4 w-4" />
                  {t("اقتراح تصحيح")}
                </a>
                {sourceEditUrl && (
                  <a
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-foreground"
                    href={sourceEditUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Github className="h-4 w-4" />
                    {t("تعديل ملف الترجمة على GitHub")}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                )}
              </div>
            )}
          </header>

          <div
            ref={contentRef}
            data-tour="reader-selection"
            className="reader-text mx-auto mt-8 whitespace-pre-wrap px-5 pb-10 text-start leading-[2.45] text-foreground sm:px-8 md:px-10 lg:px-12"
            dir={chapter.direction}
            style={{ fontFamily, fontSize: settings.fontSize }}
          >
            {visibleBody ? (
              pageContent.map((page) => (
                <section className="mb-10 scroll-mt-32" id={`page-${page.pageNumber}`} key={page.id}>
                  <div className="reader-page-marker mb-6 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    <span className="rounded-full border border-border bg-background px-3 py-1 tabular-nums shadow-sm">
                      {pageText(displayPageNumber(page), language)}
                      {page.volume ? ` / ${page.volume}` : ""}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  {renderReaderText(page.mainText, chapterHighlights, page.footnoteTargets, language, handleFootnoteReference)}
                  {settings.showFootnotes && (
                    <PageFootnotes
                      activeFootnoteId={activeFootnoteId}
                      footnotes={page.footnotes}
                      highlights={chapterHighlights}
                    />
                  )}
                </section>
              ))
            ) : (
              t("لا يوجد نص متاح لهذا الفصل بعد.")
            )}
          </div>

          <footer className="mx-auto mt-16 grid max-w-5xl gap-3 border-t border-border px-6 pb-8 pt-6 sm:grid-cols-2">
            {prev ? <ChapterNav chapter={prev} label={t("الفصل السابق")} role="back" /> : <span />}
            {next ? <ChapterNav chapter={next} label={t("الفصل التالي")} role="forward" /> : <span />}
          </footer>
          </article>
        </div>
      </main>

      <ReaderToolbar
        isVisible={toolbarVisible}
        onHide={() => setToolbarVisible(false)}
        onShow={() => setToolbarVisible(true)}
        onToc={() => setTocOpen(true)}
        settings={settings}
        setSettings={setSettings}
      />

      {showScrollTop && (
        <button
          aria-label={t("الصعود للأعلى")}
          className={`reader-chrome fixed right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition hover:-translate-y-0.5 hover:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground ${
            toolbarVisible ? "bottom-40 md:bottom-20" : "bottom-28 md:bottom-6"
          }`}
          onClick={scrollToTop}
          type="button"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

      {showTourSelectionDemo && <TourSelectionActionsDemo text={tourSelectionText} />}

      {status && (
        <div className="reader-chrome fixed bottom-32 left-1/2 z-[55] -translate-x-1/2 rounded-md px-4 py-2 text-sm font-semibold md:bottom-20">
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            {status === "copied" && t("تم النسخ")}
            {status === "highlighted" && t("تم حفظ التظليل")}
            {status === "noted" && t("تم حفظ الملاحظة")}
            {status === "saved" && t("تم حفظ الموضع")}
          </span>
        </div>
      )}

      {selection && (
        <div
          ref={selectionToolbarRef}
          className="reader-chrome fixed bottom-[calc(8rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-lg p-3 md:bottom-20"
        >
          <div className="flex items-start gap-3">
            <p className="line-clamp-2 flex-1 text-sm leading-6 text-muted-foreground">{selection}</p>
            <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground" aria-label={t("إغلاق")}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder={t("ملاحظة اختيارية")}
            className="mt-3 h-20 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:border-foreground focus:outline-none"
          />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{t("لون التظليل")}</span>
            <div className="flex items-center gap-1">
              {HIGHLIGHT_PALETTE.map((color) => (
                <button
                  aria-label={`${t("تظليل")} ${t(color.name)}`}
                  aria-pressed={highlightColor === color.value}
                  className="h-7 w-7 rounded-full border border-border ring-offset-2 ring-offset-background transition hover:scale-105 data-[selected=true]:ring-2 data-[selected=true]:ring-foreground"
                  data-selected={highlightColor === color.value}
                  key={color.value}
                  onClick={() => setHighlightColor(color.value)}
                  style={{ background: color.bg }}
                  type="button"
                />
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                addHighlight({ ...selectionPayload(), color: highlightColor });
                showStatus("highlighted");
                clearSelection();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              <Highlighter className="h-4 w-4" />
              {t("تظليل")}
            </button>
            <button
              onClick={() => {
                addNote({ ...selectionPayload(), note: noteDraft || selection, selectedText: selection });
                showStatus("noted");
                clearSelection();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold"
            >
              <StickyNote className="h-4 w-4" />
              {t("حفظ ملاحظة")}
            </button>
            <button
              onClick={handleCopySelection}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm"
            >
              <Copy className="h-4 w-4" />
              {t("نسخ")}
            </button>
            <button
              onClick={() => setShareText(selection)}
              data-tour="reader-share-selection"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm"
            >
              <Share2 className="h-4 w-4" />
              {t("مشاركة")}
            </button>
            {isTranslation && (
              <a
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold transition-colors hover:border-foreground"
                href={buildCorrectionUrl(selection)}
                rel="noreferrer"
                target="_blank"
              >
                <MessageSquareWarning className="h-4 w-4" />
                {t("اقتراح تصحيح")}
              </a>
            )}
          </div>
        </div>
      )}

      {(shareText || showTourShareDemo) && (
        <QuoteShareModal
          bookTitle={book.titleAr}
          chapterTitle={chapter.titleAr}
          pageNumber={chapter.page > 0 ? chapter.page : undefined}
          coverColor={book.coverColor}
          onClose={() => setShareText(null)}
          text={shareText ?? tourSelectionText}
        />
      )}

      <Sheet open={tocOpen} onOpenChange={setTocOpen}>
        <SheetContent
          side={direction === "rtl" ? "right" : "left"}
          className="w-full max-w-full overflow-y-auto sm:max-w-md lg:max-w-lg"
          dir={direction}
        >
          <SheetHeader>
            <SheetTitle>{t("المحتويات")}</SheetTitle>
          </SheetHeader>
          <ReaderToc
            bookId={book.id}
            bookTitle={book.titleAr}
            chapterId={chapter.id}
            chapters={chapters}
            onSelect={() => setTocOpen(false)}
            pages={book.pages}
          />
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function TourSelectionActionsDemo({ text }: { text: string }) {
  const { direction, t } = useUiTranslations();

  return (
    <div
      className="reader-chrome fixed bottom-[calc(8rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-lg p-3 md:bottom-20"
      data-tour="reader-selection-demo"
      dir={direction}
    >
      <div className="flex items-start gap-3">
        <p className="line-clamp-2 flex-1 text-sm leading-6 text-muted-foreground">{text}</p>
        <span className="text-xs font-semibold text-muted-foreground">{t("مثال")}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{t("لون التظليل")}</span>
        <div className="flex items-center gap-1">
          {HIGHLIGHT_PALETTE.slice(0, 4).map((color, index) => (
            <span
              aria-hidden="true"
              className="h-7 w-7 rounded-full border border-border"
              key={color.value}
              style={{
                background: color.bg,
                boxShadow: index === 0 ? "0 0 0 2px hsl(var(--foreground))" : undefined,
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
          <Highlighter className="h-4 w-4" />
          {t("تظليل")}
        </span>
        <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold">
          <StickyNote className="h-4 w-4" />
          {t("حفظ ملاحظة")}
        </span>
        <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm">
          <Copy className="h-4 w-4" />
          {t("نسخ")}
        </span>
        <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm">
          <Share2 className="h-4 w-4" />
          {t("مشاركة")}
        </span>
      </div>
    </div>
  );
}

function ReaderToolbar({
  isVisible,
  onHide,
  onShow,
  onToc,
  settings,
  setSettings,
}: {
  isVisible: boolean;
  onHide: () => void;
  onShow: () => void;
  onToc: () => void;
  settings: ReturnType<typeof useLocalLibrary>["settings"];
  setSettings: ReturnType<typeof useLocalLibrary>["setSettings"];
}) {
  const { t } = useUiTranslations();
  const controlClass = "reader-control inline-flex h-11 items-center justify-center px-3 text-sm";
  if (!isVisible) {
    return (
      <button
        onClick={onShow}
        className="reader-chrome fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 z-40 inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold md:bottom-4"
      >
        <Eye className="h-4 w-4" />
        {t("إظهار الشريط")}
      </button>
    );
  }

  return (
    <div className="reader-chrome fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 rounded-none border-x-0 border-b-0 md:bottom-0" data-tour="reader-toolbar">
      <div className="safe-bottom scrollbar-soft mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 py-3">
        <button onClick={onToc} className={`${controlClass} gap-2`}>
          <ListTree className="h-4 w-4" />
          {t("المحتويات")}
        </button>
        <button
          onClick={() => setSettings((current) => ({ ...current, fontSize: Math.max(16, current.fontSize - 2) }))}
          className={`${controlClass} w-11 px-0`}
          aria-label={t("تصغير الخط")}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="hidden h-11 items-center rounded-md border border-border bg-background px-3 text-sm tabular-nums text-muted-foreground sm:inline-flex">
          {settings.fontSize}
        </span>
        <button
          onClick={() => setSettings((current) => ({ ...current, fontSize: Math.min(34, current.fontSize + 2) }))}
          className={`${controlClass} w-11 px-0`}
          aria-label={t("تكبير الخط")}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            setSettings((current) => ({
              ...current,
              fontFamily: current.fontFamily === "amiri" ? "naskh" : "amiri",
            }))
          }
          className={`${controlClass} gap-2`}
          aria-pressed={settings.fontFamily === "amiri"}
        >
          <Type className="h-4 w-4" />
          {t("نوع الخط")}
        </button>
        <button
          onClick={() => setSettings((current) => ({ ...current, showHarakat: !current.showHarakat }))}
          className={`${controlClass} gap-2`}
          aria-pressed={settings.showHarakat}
        >
          <Bookmark className="h-4 w-4" />
          {settings.showHarakat ? t("إخفاء التشكيل") : t("إظهار التشكيل")}
        </button>
        <button
          onClick={() => setSettings((current) => ({ ...current, showFootnotes: !current.showFootnotes }))}
          className={`${controlClass} gap-2`}
          aria-pressed={settings.showFootnotes}
        >
          <MessageSquareText className="h-4 w-4" />
          {settings.showFootnotes ? t("إخفاء الحواشي") : t("إظهار الحواشي")}
        </button>
        <button onClick={onHide} className={`${controlClass} ms-auto gap-2`}>
          <EyeOff className="h-4 w-4" />
          {t("إخفاء الشريط")}
        </button>
      </div>
    </div>
  );
}

function PageFootnotes({
  activeFootnoteId,
  footnotes,
  highlights,
}: {
  activeFootnoteId: string | null;
  footnotes: PageFootnote[];
  highlights: LocalHighlight[];
}) {
  const { t } = useUiTranslations();
  if (footnotes.length === 0) return null;

  return (
    <aside aria-label={t("حواشي الصفحة")} className="reader-footnotes mt-7">
      <div className="reader-footnotes-header">
        <span>{t("حواشي الصفحة")}</span>
      </div>
      {footnotes.map((footnote) => (
        <div
          className={`reader-footnote${activeFootnoteId === footnote.id ? " reader-footnote--active" : ""}`}
          id={footnote.id}
          key={footnote.id}
          tabIndex={-1}
        >
          {footnote.marker && <span className="reader-footnote-marker">{displayFootnoteMarker(footnote.marker)}</span>}
          <p className="min-w-0 flex-1">{renderHighlightedText(footnote.text, highlights)}</p>
        </div>
      ))}
    </aside>
  );
}

function ReaderToc({
  bookId,
  bookTitle,
  chapterId,
  chapters,
  className = "",
  onSelect,
  pages,
}: {
  bookId: number;
  bookTitle: string;
  chapterId: number;
  chapters: ChapterSummary[];
  className?: string;
  onSelect?: () => void;
  pages: Pick<PageDetail, "pageNumber" | "sourcePageNumber">[];
}) {
  const { t } = useUiTranslations();

  return (
    <aside className={className}>
      <div className="reader-chrome scrollbar-soft sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-lg p-3">
        <p className="mb-3 px-2 text-sm font-semibold text-foreground">{t("المحتويات")}</p>
        <BookTocTree
          bookId={bookId}
          chapters={chapters}
          compact
          currentChapterId={chapterId}
          editionTitle={bookTitle}
          onSelect={onSelect}
          pages={pages}
        />
      </div>
    </aside>
  );
}

function ChapterNav({ chapter, label, role }: { chapter: ChapterSummary; label: string; role: "back" | "forward" }) {
  return (
    <Link
      href={`/edition/${chapter.editionId}/section/${chapter.id}`}
      className="interactive-card p-4"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-2 font-semibold leading-7">
        {chapter.titleAr}
        <DirectionalArrow className="ms-2 inline h-4 w-4" role={role} />
      </p>
    </Link>
  );
}
