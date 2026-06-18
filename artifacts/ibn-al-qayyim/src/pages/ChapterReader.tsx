import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  ExternalLink,
  Github,
  Menu,
  Highlighter,
  MessageSquareWarning,
  Search,
  Share2,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useOnboardingTour } from "@/components/OnboardingTour";
import AppShell from "@/components/editorial/AppShell";
import { ErrorState, LoadingState } from "@/components/editorial/DataState";
import ProgressLine from "@/components/editorial/ProgressLine";
import QuoteShareModal from "@/components/QuoteShareModal";
import {
  ChapterNav,
  PageFootnotes,
  ReaderToc,
  ReaderToolbar,
  TourSelectionActionsDemo,
  renderHighlightedText,
} from "@/components/reader/ReaderPanels";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buildSourceEditUrl, buildTranslationIssueUrl } from "@/lib/contribution-links";
import { getHighlightStyle, HIGHLIGHT_PALETTE } from "@/lib/highlights";
import { type LocalHighlight, type ReaderSettings, stripHarakat, useLocalLibrary } from "@/lib/local-library";
import { calculateBookPageProgress } from "@/lib/reading-progress";
import { useSeo } from "@/lib/seo";
import { sectionTypeLabel, useStaticBook, useStaticBookChapter } from "@/lib/static-library";
import { cleanBabTitle, stripSectionTypePrefix } from "@/lib/section-title";
import { pageText, readingMetaText, translateUi, useUiTranslations } from "@/lib/ui-translations";
import {
  buildShareText,
  copyText,
  currentScrollY,
  displayFootnoteMarker,
  displayPageNumber,
  FOOTNOTE_FOCUS_MS,
  FOOTNOTE_REFERENCE_REGEX,
  footnoteId,
  getSelectionPosition,
  type HighlightColor,
  isPositionedHighlight,
  normalizeFootnoteMarker,
  scrollTopThreshold,
  type ReaderStatus,
  type SelectionPosition,
  splitPageFootnotes,
} from "@/lib/reader-utils";

// ── Rich-text token types ──────────────────────────────────────────────────
// U+FD3E/FD3F ornate brackets are used exclusively for Quranic verses in Arabic
const QURAN_VERSE_ORNATE_REGEX = /﴿([^﴾]{1,600})﴾(?:\s*\[([^\]\n]{1,100})\])?/gu;
// Shamela: {verse} [Surah:Ayah] — explicit ref variant
const QURAN_VERSE_CURLY_REGEX = /\{([^}\n]{1,600})\}\s*\[([^\]\n]{1,100})\]/gu;
// Shamela: {verse} without ref — Shamela uses curly braces exclusively for Quranic verses
const QURAN_VERSE_CURLY_NOREF_REGEX = /\{([^}\n]{5,500})\}(?!\s*\[)/gu;
// [[H:heading text]] — emitted by extract-ibn-qayyim.ts for title spans
const INLINE_HEADING_REGEX = /\[\[H:([^\]]{1,300})\]\]/gu;
// ((heading)) — Shamela double-paren section label: ((أقسام النعمة))
const SHAMELA_DOUBLE_PAREN_REGEX = /\(\(([^)\n]{2,150})\)\)/gu;
// [heading] — Shamela single-bracket topic marker: [النعمة المطلقة]
// Excluded: verse refs (\d in content or colon-digit pattern), footnote markers, and
// brackets immediately following } or ﴾ (verse refs already consumed by verse regex)
const SHAMELA_BRACKET_REGEX = /\[([^\]\n]{2,80})\]/gu;
// Enumeration labels at sentence boundaries: أحدها: والثاني: الثالث: ومنها: القول الأول: etc.
// Works on un-voweled text (most of the corpus). Group 1 = boundary; Group 2 = label.
const ENUM_LABEL_REGEX =
  /(^|[\n.]\s*)((?:[وف])?(?:أ(?:حده?ا|وله?ا|ولاً?)|[وف]?(?:ال)?(?:ثاني?(?:ة|ه?ا)?|ثالث(?:ة|ه?ا)?|رابع(?:ة|ه?ا)?|خامس(?:ة|ه?ا)?|سادس(?:ة|ه?ا)?|سابع(?:ة|ه?ا)?|ثامن(?:ة|ه?ا)?|تاسع(?:ة|ه?ا)?|عاشر(?:ة|ه?ا)?)|ثانياً?|ثالثاً?|رابعاً?|خامساً?|سادساً?|سابعاً?|ثامناً?|تاسعاً?|عاشراً?|[وف]?منه[ام]|(?:القول|الوجه|الجواب|السؤال|الدليل|الفائدة|النوع|الضرب)\s+(?:الأول[ىة]?|الثاني?ة?|الثالث?ة?|الرابع?ة?|الخامس?ة?))\s*[:：])/gmu;

type RichToken =
  | { kind: "verse"; start: number; end: number; verseText: string; ref: string | undefined }
  | { kind: "heading"; start: number; end: number; text: string }
  | { kind: "topic-paren"; start: number; end: number; text: string }
  | { kind: "topic-bracket"; start: number; end: number; text: string }
  | { kind: "enum-label"; start: number; end: number; text: string }
  | { kind: "footnote"; start: number; end: number; marker: string; targetId: string }
  | { kind: "ref-plain"; start: number; end: number; marker: string }
  | { kind: "suppress"; start: number; end: number };

// Returns a CSS class string reflecting heading hierarchy detected from text keywords
function headingCssClass(text: string): string {
  const t = text.trimStart();
  if (/^(?:كتاب|باب)(?:\s|$)/.test(t)) return "reader-inline-heading reader-heading-bab";
  if (/^(?:فصل|فائدة|خاتمة)(?:\s|$)/.test(t)) return "reader-inline-heading reader-heading-fasl";
  if (/^(?:تنبيه|مسألة|مسئلة|قاعدة|مطلب|فرع|ملحوظة)(?:\s|$)/.test(t)) return "reader-inline-heading reader-heading-sub";
  return "reader-inline-heading";
}

function collectRichTokens(
  text: string,
  footnoteTargets: Map<string, string>,
  chapterTitleAr?: string,
): RichToken[] {
  const raw: RichToken[] = [];
  const normChapterTitle = chapterTitleAr
    ? stripHarakat(chapterTitleAr).replace(/\s+/g, " ").trim()
    : null;

  for (const m of text.matchAll(QURAN_VERSE_ORNATE_REGEX)) {
    raw.push({ kind: "verse", start: m.index!, end: m.index! + m[0].length, verseText: `﴿${m[1]}﴾`, ref: m[2] });
  }
  for (const m of text.matchAll(QURAN_VERSE_CURLY_REGEX)) {
    raw.push({ kind: "verse", start: m.index!, end: m.index! + m[0].length, verseText: `{${m[1]}}`, ref: m[2] });
  }
  for (const m of text.matchAll(QURAN_VERSE_CURLY_NOREF_REGEX)) {
    raw.push({ kind: "verse", start: m.index!, end: m.index! + m[0].length, verseText: `{${m[1]}}`, ref: undefined });
  }
  for (const m of text.matchAll(INLINE_HEADING_REGEX)) {
    if (normChapterTitle) {
      const normHeading = stripHarakat(m[1]!).replace(/\s+/g, " ").trim();
      if (normHeading === normChapterTitle) {
        // Consume the raw [[H:...]] marker without rendering it — the <h1> already shows the title
        raw.push({ kind: "suppress", start: m.index!, end: m.index! + m[0].length });
        continue;
      }
    }
    raw.push({ kind: "heading", start: m.index!, end: m.index! + m[0].length, text: m[1]! });
  }
  for (const m of text.matchAll(FOOTNOTE_REFERENCE_REGEX)) {
    const prefix = m[1] ?? "";
    const marker = m[2] ?? m[0] ?? "";
    const markerKey = normalizeFootnoteMarker(marker);
    const targetId = footnoteTargets.get(markerKey);
    const start = m.index! + prefix.length;
    if (targetId) {
      raw.push({ kind: "footnote", start, end: start + marker.length, marker, targetId });
    } else {
      raw.push({ kind: "ref-plain", start, end: start + marker.length, marker });
    }
  }
  for (const m of text.matchAll(SHAMELA_DOUBLE_PAREN_REGEX)) {
    raw.push({ kind: "topic-paren", start: m.index!, end: m.index! + m[0].length, text: m[1]! });
  }
  for (const m of text.matchAll(SHAMELA_BRACKET_REGEX)) {
    const inner = m[1]!;
    // Skip verse refs like [البقرة: 3] (colon-digit), purely numeric, or too short
    if (/:\s*[\d٠-٩]/.test(inner) || /^[\d٠-٩]+$/.test(inner)) continue;
    // Require at least 5 base Arabic characters (strip diacritics for check)
    const baseChars = inner.replace(/[ً-ٟؐ-ؚۖ-ۭ\s]/g, "");
    if (baseChars.length < 5) continue;
    raw.push({ kind: "topic-bracket", start: m.index!, end: m.index! + m[0].length, text: inner.trim() });
  }
  for (const m of text.matchAll(ENUM_LABEL_REGEX)) {
    // m[1] is the optional preceding boundary char; m[2] is the label
    const label = m[2]!;
    const start = m.index! + (m[1]?.length ?? 0);
    raw.push({ kind: "enum-label", start, end: start + label.length, text: label });
  }

  // Sort by position, earliest first; on tie prefer the longer match
  raw.sort((a, b) => a.start - b.start || b.end - a.end);

  // Remove overlapping tokens (first one wins)
  const tokens: RichToken[] = [];
  let maxEnd = 0;
  for (const token of raw) {
    if (token.start >= maxEnd) {
      tokens.push(token);
      maxEnd = token.end;
    }
  }
  return tokens;
}

function renderReaderText(
  text: string,
  highlights: LocalHighlight[],
  footnoteTargets: Map<string, string>,
  language: "ar" | "de" | "en",
  onFootnoteReference: (id: string) => void,
  onHighlightSelect?: (highlight: LocalHighlight) => void,
  highlightActionLabel?: string,
  offsetBase = 0,
  chapterTitleAr?: string,
) {
  const tokens = collectRichTokens(text, footnoteTargets, chapterTitleAr);

  if (tokens.length === 0) {
    return renderHighlightedText(text, highlights, offsetBase, onHighlightSelect, highlightActionLabel);
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (token.start > cursor) {
      const chunk = text.slice(cursor, token.start);
      nodes.push(
        <Fragment key={`text-${cursor}`}>
          {renderHighlightedText(chunk, highlights, offsetBase + cursor, onHighlightSelect, highlightActionLabel)}
        </Fragment>,
      );
    }

    if (token.kind === "verse") {
      nodes.push(
        <span className="reader-quran-verse" key={`verse-${token.start}`}>
          {token.verseText}
        </span>,
      );
      if (token.ref) {
        nodes.push(
          <span className="reader-quran-ref" key={`verse-ref-${token.start}`}>
            {` [${token.ref}]`}
          </span>,
        );
      }
    } else if (token.kind === "heading") {
      nodes.push(
        <span className={headingCssClass(token.text)} key={`heading-${token.start}`}>
          {token.text}
        </span>,
      );
    } else if (token.kind === "topic-paren") {
      nodes.push(
        <span className="reader-topic-paren" key={`tp-${token.start}`}>
          {token.text}
        </span>,
      );
    } else if (token.kind === "topic-bracket") {
      nodes.push(
        <span className="reader-topic-bracket" key={`tb-${token.start}`}>
          {token.text}
        </span>,
      );
    } else if (token.kind === "enum-label") {
      nodes.push(
        <span className="reader-enum-label" key={`el-${token.start}`}>
          {token.text}
        </span>,
      );
    } else if (token.kind === "suppress") {
      // consumed — render nothing; the range is just dropped (duplicate title)
    } else if (token.kind === "ref-plain") {
      nodes.push(
        <sup className="reader-fn-plain" key={`fnp-${token.start}`}>
          {displayFootnoteMarker(token.marker)}
        </sup>,
      );
    } else {
      nodes.push(
        <button
          aria-label={translateUi(language, "الانتقال إلى الحاشية {marker}", {
            marker: displayFootnoteMarker(token.marker),
          })}
          className="reader-footnote-ref"
          key={`fn-${token.start}`}
          onClick={() => onFootnoteReference(token.targetId)}
          type="button"
        >
          {displayFootnoteMarker(token.marker)}
        </button>,
      );
    }

    cursor = token.end;
  }

  if (cursor < text.length) {
    nodes.push(
      <Fragment key={`text-${cursor}`}>
        {renderHighlightedText(text.slice(cursor), highlights, offsetBase + cursor, onHighlightSelect, highlightActionLabel)}
      </Fragment>,
    );
  }

  return nodes;
}

// Splits fullText on double-newlines and renders each segment as a <p> element,
// preserving absolute highlight offsets via per-paragraph offsetBase tracking.
function renderParagraphs(
  fullText: string,
  highlights: LocalHighlight[],
  footnoteTargets: Map<string, string>,
  language: "ar" | "de" | "en",
  onFootnoteReference: (id: string) => void,
  onHighlightSelect?: (highlight: LocalHighlight) => void,
  highlightActionLabel?: string,
  chapterTitleAr?: string,
): React.ReactNode[] {
  const parts: Array<{ text: string; offset: number }> = [];
  let lastEnd = 0;
  for (const m of fullText.matchAll(/\n\n+/g)) {
    parts.push({ text: fullText.slice(lastEnd, m.index), offset: lastEnd });
    lastEnd = m.index! + m[0].length;
  }
  parts.push({ text: fullText.slice(lastEnd), offset: lastEnd });

  return parts
    .filter(({ text }) => text.trim())
    .map(({ text, offset }, i) => (
      <p className="reader-paragraph" key={i}>
        {renderReaderText(
          text,
          highlights,
          footnoteTargets,
          language,
          onFootnoteReference,
          onHighlightSelect,
          highlightActionLabel,
          offset,
          chapterTitleAr,
        )}
      </p>
    ));
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
  const cleanedChapterTitle =
    chapter?.type === "bab"
      ? cleanBabTitle(stripSectionTypePrefix(chapter.titleAr, chapter.type))
      : (chapter?.titleAr ?? "");
  useSeo(language, {
    canonicalPath: `/edition/${bookIdNum}/section/${chapterIdNum}`,
    description: chapter
      ? `${chapter.workTitle} - ${chapter.titleAr}. ${translateUi(language, "اقرأ النص الكامل مع الفهارس والحواشي.")}`
      : undefined,
    image: book?.coverImageUrl,
    jsonLd:
      book && chapter
        ? {
            "@context": "https://schema.org",
            "@type": "Chapter",
            inLanguage: language,
            isPartOf: {
              "@type": "Book",
              author: {
                "@type": "Person",
                name: language === "ar" ? "ابن قيم الجوزية" : "Ibn al-Qayyim",
              },
              name: book.titleAr,
            },
            name: chapter.titleAr,
            pagination: `${chapter.startPage}-${chapter.endPage}`,
          }
        : undefined,
    title: chapter ? `${chapter.titleAr} - ${chapter.workTitle}` : undefined,
    type: "article",
  });
  const { addHighlight, addNote, deleteHighlight, highlights, savePosition, settings, setSettings } = useLocalLibrary();
  const [tocOpen, setTocOpen] = useState(false);
  const [selection, setSelection] = useState("");
  const [selectionPosition, setSelectionPosition] = useState<SelectionPosition | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [status, setStatus] = useState<ReaderStatus>(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [shareText, setShareText] = useState<string | null>(null);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>(HIGHLIGHT_PALETTE[0].value);
  const highlightColorRef = useRef<HighlightColor>(HIGHLIGHT_PALETTE[0].value);
  const [selectedHighlight, setSelectedHighlight] = useState<LocalHighlight | null>(null);
  const [activeFootnoteId, setActiveFootnoteId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [appendedSectionIds, setAppendedSectionIds] = useState<number[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectionToolbarRef = useRef<HTMLDivElement>(null);
  const highlightActionsRef = useRef<HTMLDivElement>(null);
  const { activeStepId, isTourOpen } = useOnboardingTour();
  const tourSelectionText = t("فإن في القلب شعثا لا يلمه إلا الإقبال على الله");

  const body = settings.showHarakat ? chapter?.content ?? "" : stripHarakat(chapter?.content ?? "");
  const fontFamily = settings.fontFamily === "amiri" ? "var(--app-font-serif)" : "var(--app-font-sans)";

  const chapters = book?.chapters ?? [];
  const currentIndex = chapters.findIndex((item) => item.id === chapterIdNum);
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? chapters[currentIndex + 1] : null;
  const lastAppendedId = appendedSectionIds.length > 0 ? appendedSectionIds[appendedSectionIds.length - 1] : chapterIdNum;
  const lastAppendedIndex = chapters.findIndex((c) => c.id === lastAppendedId);
  const nextAppendable = lastAppendedIndex >= 0 && lastAppendedIndex < chapters.length - 1 ? chapters[lastAppendedIndex + 1] : null;
  const bookProgress = useMemo(() => calculateBookPageProgress(book, chapter), [book, chapter]);

  const chapterHighlights = useMemo(
    () => highlights.filter((highlight) => highlight.chapterId === chapterIdNum),
    [chapterIdNum, highlights],
  );
  const positionedChapterHighlights = useMemo(
    () => chapterHighlights.filter(isPositionedHighlight),
    [chapterHighlights],
  );
  const showTourSelectionDemo = isTourOpen && activeStepId === "selection-actions";
  const showTourShareDemo =
    isTourOpen &&
    (activeStepId === "share-quote" || activeStepId === "customize-image" || activeStepId === "export-share");

  const renderedPages = useMemo(() => {
    const pages = chapter?.pages ?? [];
    if (pages.length === 0) {
      return [
        {
          id: chapter?.id ?? 0,
          pageNumber: chapter?.page ?? 0,
          sourcePageNumber: undefined,
          text: body,
          volume: "",
        },
      ];
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

  const visibleBody = useMemo(() => pageContent.map((page) => page.visibleText).join("\n\n"), [pageContent]);

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
      chapterTitle: cleanedChapterTitle,
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
    setSelectedHighlight(null);
    setActiveFootnoteId(null);
    setAppendedSectionIds([]);
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
      const currentSelection = window.getSelection();
      const selected = currentSelection?.toString().trim() ?? "";
      const anchor = currentSelection?.anchorNode;
      if (selected.length > 1 && currentSelection && anchor && contentRef.current?.contains(anchor)) {
        setSelectedHighlight(null);
        setSelection(selected);
        setSelectionPosition(getSelectionPosition(currentSelection, contentRef.current));
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
      if (event.deltaY > 0) clearSelection();
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [selection]);

  useEffect(() => {
    if (!selectedHighlight) return;

    const onPointerDown = (event: PointerEvent) => {
      if (highlightActionsRef.current?.contains(event.target as Node)) return;
      setSelectedHighlight(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [selectedHighlight]);

  const selectionPayload = () => ({
    bookId: book!.id,
    bookTitle: book!.titleAr,
    chapterId: chapter!.id,
    chapterTitle: cleanedChapterTitle,
    text: selection,
  });

  const highlightPayload = () => {
    if (!selectionPosition) return null;
    return {
      ...selectionPayload(),
      ...selectionPosition,
      color: highlightColorRef.current,
    };
  };

  const clearSelection = () => {
    setSelection("");
    setSelectionPosition(null);
    setNoteDraft("");
    window.getSelection()?.removeAllRanges();
  };

  const selectHighlightColor = (color: HighlightColor) => {
    highlightColorRef.current = color;
    setHighlightColor(color);
  };

  const handleHighlightSelect = useCallback((highlight: LocalHighlight) => {
    clearSelection();
    setSelectedHighlight(highlight);
  }, []);

  const handleCopyChapter = async () => {
    if (!book || !chapter) return;
    await copyText(buildShareText(visibleBody, book.titleAr, cleanedChapterTitle, language));
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
      <main
        className="scholarly-bg min-h-screen px-0 pb-[15rem] pt-4 sm:px-4 sm:pb-40 sm:pt-6 md:px-6"
        id="main-content"
      >
        <div className="mx-auto max-w-6xl">
          <article className="reader-surface surface-card mx-auto min-w-0 max-w-6xl" data-tour="reader-text">
            <div className="reader-chrome sticky top-14 z-30 rounded-none border-x-0 border-t-0">
              <div className="flex h-14 items-center justify-between gap-2 px-2.5 sm:gap-3 sm:px-4">
                <button
                  onClick={() => setTocOpen(true)}
                  className="reader-control inline-flex h-11 w-11 items-center justify-center sm:h-10 sm:w-10"
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
                  <p className="truncate text-xs text-muted-foreground">{cleanedChapterTitle}</p>
                </Link>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <button
                    onClick={handleSavePosition}
                    className="reader-control inline-flex h-11 w-11 items-center justify-center sm:h-10 sm:w-10"
                    aria-label={t("حفظ موضع القراءة")}
                  >
                    <Bookmark className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCopyChapter}
                    data-tour="reader-copy-chapter"
                    className="reader-control inline-flex h-11 w-11 items-center justify-center sm:h-10 sm:w-10"
                    aria-label={t("نسخ الفصل")}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <Link
                    href={`/search?target=section&editionId=${book.id}&sectionId=${chapter.id}`}
                    className="reader-control inline-flex h-11 w-11 items-center justify-center sm:h-10 sm:w-10"
                    aria-label={t("البحث داخل هذا القسم")}
                  >
                    <Search className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-3 px-3 pb-3 text-xs text-muted-foreground sm:px-4">
                <span className="tabular-nums">{Math.round(bookProgress)}%</span>
                <ProgressLine className="flex-1" showValue={false} value={bookProgress} />
              </div>
            </div>

            <header className="reader-header mx-auto max-w-4xl border-b border-border px-4 py-7 text-center sm:px-6 sm:py-10 md:px-12 md:py-14">
              {chapter.type !== "heading" && chapter.type !== "topic" && (
                <div className="reader-section-badge">
                  {sectionTypeLabel(chapter.type, language)}
                </div>
              )}
              <h1 className="mx-auto max-w-3xl font-display text-2xl font-bold leading-tight sm:text-3xl md:text-5xl">
                {cleanedChapterTitle}
              </h1>
              <p className="mt-4 text-sm text-muted-foreground tabular-nums">
                {readingMetaText(visibleReadingMinutes, chapterDisplayPage, language)}
              </p>
              {isTranslation && (
                <div className="mt-5 flex flex-col justify-center gap-2 sm:mt-6 sm:flex-row sm:flex-wrap">
                  <a
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:h-10"
                    href={buildCorrectionUrl()}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <MessageSquareWarning className="h-4 w-4" />
                    {t("اقتراح تصحيح")}
                  </a>
                  {sourceEditUrl && (
                    <a
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-foreground sm:h-10"
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
              className="reader-text mx-auto mt-6 px-4 pb-8 text-start leading-[2.25] text-foreground sm:mt-8 sm:px-8 sm:leading-[2.45] md:px-10 lg:px-12"
              dir={chapter.direction}
              style={{ fontFamily, fontSize: settings.fontSize }}
            >
              {visibleBody ? (
                pageContent.map((page) => (
                  <section
                    className={settings.showPageMarkers ? "mb-8 scroll-mt-32 sm:mb-10" : undefined}
                    id={`page-${page.pageNumber}`}
                    key={page.id}
                    style={settings.showPageMarkers ? undefined : { display: "contents" }}
                  >
                    {settings.showPageMarkers && (
                      <div className="reader-page-marker mb-5 flex items-center gap-2 text-xs text-muted-foreground sm:mb-6 sm:gap-3">
                        <span className="h-px flex-1 bg-border" />
                        <span className="rounded-full border border-border bg-background px-3 py-1 tabular-nums shadow-sm">
                          {pageText(displayPageNumber(page), language)}
                          {page.volume ? ` / ${page.volume}` : ""}
                        </span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <div data-reader-highlight-surface="main" data-reader-page-id={page.id}>
                      {renderParagraphs(
                        settings.showPageMarkers ? page.mainText : page.mainText.trimEnd(),
                        positionedChapterHighlights.filter(
                          (highlight) => highlight.pageId === page.id && highlight.surface === "main",
                        ),
                        page.footnoteTargets,
                        language,
                        handleFootnoteReference,
                        handleHighlightSelect,
                        t("حذف التظليل"),
                        chapter.titleAr,
                      )}
                    </div>
                    {settings.showFootnotes && (
                      <PageFootnotes
                        activeFootnoteId={activeFootnoteId}
                        footnotes={page.footnotes}
                        highlights={positionedChapterHighlights.filter(
                          (highlight) => highlight.pageId === page.id && highlight.surface === "footnote",
                        )}
                        onHighlightSelect={handleHighlightSelect}
                        pageId={page.id}
                      />
                    )}
                  </section>
                ))
              ) : (
                t("لا يوجد نص متاح لهذا الفصل بعد.")
              )}
            </div>

            {appendedSectionIds.map((sectionId) => (
              <AppendedSection
                key={sectionId}
                activeFootnoteId={activeFootnoteId}
                bookId={bookIdNum}
                highlights={highlights}
                language={language}
                onFootnoteReference={handleFootnoteReference}
                onHighlightSelect={handleHighlightSelect}
                sectionId={sectionId}
                settings={settings}
              />
            ))}

            {nextAppendable && (
              <div className="mx-auto max-w-4xl px-4 py-6 text-center sm:px-6">
                <button
                  onClick={() => setAppendedSectionIds((ids) => [...ids, nextAppendable.id])}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70"
                  type="button"
                >
                  <ChevronDown className="h-4 w-4" />
                  {t("تحميل القسم التالي")}
                </button>
              </div>
            )}

            <footer className="mx-auto mt-4 grid max-w-5xl gap-3 border-t border-border px-4 pb-8 pt-5 sm:mt-8 sm:grid-cols-2 sm:px-6 sm:pt-6">
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
            toolbarVisible ? "bottom-[13.5rem] md:bottom-20" : "bottom-28 md:bottom-6"
          }`}
          onClick={scrollToTop}
          type="button"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

      {showTourSelectionDemo && <TourSelectionActionsDemo text={tourSelectionText} />}

      {status && (
        <div className="reader-chrome fixed bottom-[11rem] left-1/2 z-[55] -translate-x-1/2 rounded-md px-4 py-2 text-sm font-semibold md:bottom-20">
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            {status === "copied" && t("تم النسخ")}
            {status === "highlightDeleted" && t("تم حذف التظليل")}
            {status === "highlighted" && t("تم حفظ التظليل")}
            {status === "noted" && t("تم حفظ الملاحظة")}
            {status === "saved" && t("تم حفظ الموضع")}
          </span>
        </div>
      )}

      {selection && (
        <div
          ref={selectionToolbarRef}
          className="reader-chrome fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 max-h-[45vh] w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 overflow-y-auto rounded-lg p-3 md:bottom-20 md:max-h-none"
        >
          <div className="flex items-start gap-3">
            <p className="line-clamp-2 flex-1 text-sm leading-6 text-muted-foreground">{selection}</p>
            <button
              onClick={clearSelection}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("إغلاق")}
            >
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
                  onClick={() => selectHighlightColor(color.value)}
                  onPointerDown={(event) => event.preventDefault()}
                  style={{ background: color.bg }}
                  type="button"
                />
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              onClick={() => {
                const nextHighlight = highlightPayload();
                if (!nextHighlight) return;
                addHighlight(nextHighlight);
                showStatus("highlighted");
                clearSelection();
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectionPosition}
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold"
            >
              <StickyNote className="h-4 w-4" />
              {t("حفظ ملاحظة")}
            </button>
            <button
              onClick={handleCopySelection}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm"
            >
              <Copy className="h-4 w-4" />
              {t("نسخ")}
            </button>
            <button
              onClick={() => setShareText(selection)}
              data-tour="reader-share-selection"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm"
            >
              <Share2 className="h-4 w-4" />
              {t("مشاركة")}
            </button>
            {isTranslation && (
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold transition-colors hover:border-foreground sm:justify-start"
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

      {selectedHighlight && !selection && (
        <div
          ref={highlightActionsRef}
          className="reader-chrome fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 rounded-lg p-3 md:bottom-20"
        >
          <div className="flex items-start gap-3">
            <p
              className="reader-highlight line-clamp-2 flex-1 rounded-md px-3 py-2 text-sm leading-7"
              style={getHighlightStyle(selectedHighlight.color)}
            >
              {selectedHighlight.text}
            </p>
            <button
              onClick={() => setSelectedHighlight(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("إغلاق")}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => {
              deleteHighlight(selectedHighlight.id);
              setSelectedHighlight(null);
              showStatus("highlightDeleted");
            }}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold transition-colors hover:border-foreground hover:bg-muted sm:w-auto"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            {t("حذف التظليل")}
          </button>
        </div>
      )}

      {(shareText || showTourShareDemo) && (
        <QuoteShareModal
          bookTitle={book.titleAr}
          chapterTitle={cleanedChapterTitle}
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

function AppendedSection({
  activeFootnoteId,
  bookId,
  highlights,
  language,
  onFootnoteReference,
  onHighlightSelect,
  sectionId,
  settings,
}: {
  activeFootnoteId: string | null;
  bookId: number;
  highlights: LocalHighlight[];
  language: "ar" | "de" | "en";
  onFootnoteReference: (id: string) => void;
  onHighlightSelect: (highlight: LocalHighlight) => void;
  sectionId: number;
  settings: ReaderSettings;
}) {
  const { t } = useUiTranslations();
  const { data: chapter, isLoading } = useStaticBookChapter(bookId, sectionId);

  const renderedPages = useMemo(() => {
    if (!chapter) return [];
    const pages = chapter.pages ?? [];
    if (pages.length === 0) {
      return [{ id: chapter.id ?? 0, pageNumber: chapter.page ?? 0, sourcePageNumber: undefined, text: settings.showHarakat ? chapter.content : stripHarakat(chapter.content), volume: "" }];
    }
    return pages.map((page) => ({ ...page, text: settings.showHarakat ? page.text : stripHarakat(page.text) }));
  }, [chapter, settings.showHarakat]);

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
          footnotes.filter((f) => f.markerKey).map((f) => [f.markerKey, f.id]),
        );
        const visibleText = settings.showFootnotes
          ? [parsed.mainText, parsed.rawFootnotes].filter(Boolean).join("\n\n")
          : parsed.mainText;
        return { ...page, ...parsed, footnotes, footnoteTargets, visibleText };
      }),
    [renderedPages, settings.showFootnotes],
  );

  const positionedHighlights = useMemo(
    () => highlights.filter((h) => h.chapterId === sectionId && isPositionedHighlight(h)),
    [highlights, sectionId],
  );

  const fontFamily = settings.fontFamily === "amiri" ? "var(--app-font-serif)" : "var(--app-font-sans)";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  if (!chapter) return null;

  return (
    <>
      <header className="reader-header mx-auto max-w-4xl border-y border-border px-4 py-7 text-center sm:px-6 sm:py-10 md:px-12 md:py-14">
        <h2 className="mx-auto max-w-3xl font-display text-2xl font-bold leading-tight sm:text-3xl md:text-5xl">
          {chapter.titleAr}
        </h2>
      </header>
      <div
        className="reader-text mx-auto mt-6 px-4 pb-8 text-start leading-[2.25] text-foreground sm:mt-8 sm:px-8 sm:leading-[2.45] md:px-10 lg:px-12"
        dir={chapter.direction}
        style={{ fontFamily, fontSize: settings.fontSize }}
      >
        {pageContent.map((page) => (
          <section
            className={settings.showPageMarkers ? "mb-8 scroll-mt-32 sm:mb-10" : undefined}
            id={`page-${page.pageNumber}`}
            key={page.id}
            style={settings.showPageMarkers ? undefined : { display: "contents" }}
          >
            {settings.showPageMarkers && (
              <div className="reader-page-marker mb-5 flex items-center gap-2 text-xs text-muted-foreground sm:mb-6 sm:gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="rounded-full border border-border bg-background px-3 py-1 tabular-nums shadow-sm">
                  {pageText(displayPageNumber(page), language)}
                  {page.volume ? ` / ${page.volume}` : ""}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <div data-reader-highlight-surface="main" data-reader-page-id={page.id}>
              {renderParagraphs(
                settings.showPageMarkers ? page.mainText : page.mainText.trimEnd(),
                positionedHighlights.filter((h) => h.pageId === page.id && h.surface === "main"),
                page.footnoteTargets,
                language,
                onFootnoteReference,
                onHighlightSelect,
                t("حذف التظليل"),
                chapter.titleAr,
              )}
            </div>
            {settings.showFootnotes && (
              <PageFootnotes
                activeFootnoteId={activeFootnoteId}
                footnotes={page.footnotes}
                highlights={positionedHighlights.filter((h) => h.pageId === page.id && h.surface === "footnote")}
                onHighlightSelect={onHighlightSelect}
                pageId={page.id}
              />
            )}
          </section>
        ))}
      </div>
    </>
  );
}
