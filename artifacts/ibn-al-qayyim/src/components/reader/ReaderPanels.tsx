import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Bookmark,
  Copy,
  Eye,
  EyeOff,
  Highlighter,
  ListTree,
  MessageSquareText,
  Minus,
  Plus,
  SeparatorHorizontal,
  Share2,
  StickyNote,
  Type,
} from "lucide-react";
import BookTocTree from "@/components/BookTocTree";
import { DirectionalArrow } from "@/components/editorial/DirectionalIcon";
import { getHighlightStyle, HIGHLIGHT_PALETTE } from "@/lib/highlights";
import { type LocalHighlight, useLocalLibrary } from "@/lib/local-library";
import { type ChapterSummary, type PageDetail } from "@/lib/static-library";
import { useUiTranslations } from "@/lib/ui-translations";
import {
  clampReaderFontSize,
  displayFootnoteMarker,
  isPositionedHighlight,
  MAX_READER_FONT_SIZE,
  MIN_READER_FONT_SIZE,
  parseReaderFontSize,
  type PageFootnote,
} from "@/lib/reader-utils";

export function renderHighlightedText(
  text: string,
  highlights: LocalHighlight[],
  offsetBase = 0,
  onHighlightSelect?: (highlight: LocalHighlight) => void,
  highlightActionLabel?: string,
) {
  const matches = highlights
    .filter(isPositionedHighlight)
    .map((highlight) => ({
      color: highlight.color,
      end: Math.min(text.length, highlight.endOffset - offsetBase),
      highlight,
      id: highlight.id,
      start: Math.max(0, highlight.startOffset - offsetBase),
    }))
    .filter((match) => match.start < match.end)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  if (matches.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match) => {
    if (match.start < cursor) return;
    if (match.start > cursor) {
      nodes.push(text.slice(cursor, match.start));
    }
    nodes.push(
      <mark
        className="reader-highlight reader-inline-highlight"
        data-reader-highlight-id={match.id}
        key={`${match.id}-${match.start}-${match.end}`}
        onClick={(event) => {
          if (!onHighlightSelect) return;
          if ((window.getSelection()?.toString().trim() ?? "").length > 0) return;
          event.stopPropagation();
          onHighlightSelect(match.highlight);
        }}
        onKeyDown={(event) => {
          if (!onHighlightSelect || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          onHighlightSelect(match.highlight);
        }}
        role={onHighlightSelect ? "button" : undefined}
        style={getHighlightStyle(match.color)}
        tabIndex={onHighlightSelect ? 0 : undefined}
        title={highlightActionLabel}
      >
        {text.slice(match.start, match.end)}
      </mark>,
    );
    cursor = match.end;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

export function TourSelectionActionsDemo({ text }: { text: string }) {
  const { direction, t } = useUiTranslations();

  return (
    <div
      className="reader-chrome fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 max-h-[45vh] w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 overflow-y-auto rounded-lg p-3 md:bottom-20 md:max-h-none"
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
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <span className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
          <Highlighter className="h-4 w-4" />
          {t("تظليل")}
        </span>
        <span className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold">
          <StickyNote className="h-4 w-4" />
          {t("حفظ ملاحظة")}
        </span>
        <span className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm">
          <Copy className="h-4 w-4" />
          {t("نسخ")}
        </span>
        <span className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm">
          <Share2 className="h-4 w-4" />
          {t("مشاركة")}
        </span>
      </div>
    </div>
  );
}

export function ReaderToolbar({
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
  const fontSizeInputRef = useRef<HTMLInputElement>(null);
  const [fontSizeDraft, setFontSizeDraft] = useState(String(settings.fontSize));

  useEffect(() => {
    if (document.activeElement === fontSizeInputRef.current) return;
    setFontSizeDraft(String(settings.fontSize));
  }, [settings.fontSize]);

  const commitFontSizeDraft = () => {
    const nextFontSize = parseReaderFontSize(fontSizeDraft);
    if (nextFontSize === null) {
      setFontSizeDraft(String(settings.fontSize));
      return;
    }
    setSettings((current) => ({ ...current, fontSize: nextFontSize }));
    setFontSizeDraft(String(nextFontSize));
  };

  const stepFontSize = (delta: number) => {
    setSettings((current) => ({ ...current, fontSize: clampReaderFontSize(current.fontSize + delta) }));
  };

  if (!isVisible) {
    return (
      <button
        onClick={onShow}
        className="reader-chrome fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-3 z-40 inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold md:bottom-4 md:left-4"
      >
        <Eye className="h-4 w-4" />
        {t("إظهار الشريط")}
      </button>
    );
  }

  return (
    <div
      className="reader-chrome fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-none border-x-0 border-b-0 md:bottom-0"
      data-tour="reader-toolbar"
    >
      <div className="safe-bottom scrollbar-none mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-3 py-2.5 sm:scrollbar-soft sm:px-4 sm:py-3">
        <button
          onClick={onToc}
          className={`${controlClass} w-11 gap-2 px-0 sm:w-auto sm:px-3`}
          aria-label={t("المحتويات")}
        >
          <ListTree className="h-4 w-4" />
          <span className="hidden sm:inline">{t("المحتويات")}</span>
        </button>
        <button onClick={() => stepFontSize(-2)} className={`${controlClass} w-11 px-0`} aria-label={t("تصغير الخط")}>
          <Minus className="h-4 w-4" />
        </button>
        <input
          ref={fontSizeInputRef}
          aria-label={t("حجم الخط")}
          className="reader-control h-11 w-16 px-2 text-center text-sm tabular-nums text-muted-foreground"
          inputMode="numeric"
          max={MAX_READER_FONT_SIZE}
          min={MIN_READER_FONT_SIZE}
          onBlur={commitFontSizeDraft}
          onChange={(event) =>
            setFontSizeDraft(event.target.value.replace(/[^\d٠-٩۰-۹]/g, ""))
          }
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitFontSizeDraft();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setFontSizeDraft(String(settings.fontSize));
              event.currentTarget.blur();
            }
          }}
          title={`${MIN_READER_FONT_SIZE}-${MAX_READER_FONT_SIZE}`}
          type="text"
          value={fontSizeDraft}
        />
        <button onClick={() => stepFontSize(2)} className={`${controlClass} w-11 px-0`} aria-label={t("تكبير الخط")}>
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            setSettings((current) => ({
              ...current,
              fontFamily: current.fontFamily === "amiri" ? "naskh" : "amiri",
            }))
          }
          className={`${controlClass} w-11 gap-2 px-0 sm:w-auto sm:px-3`}
          aria-pressed={settings.fontFamily === "amiri"}
          aria-label={t("نوع الخط")}
        >
          <Type className="h-4 w-4" />
          <span className="hidden sm:inline">{t("نوع الخط")}</span>
        </button>
        <button
          onClick={() => setSettings((current) => ({ ...current, showHarakat: !current.showHarakat }))}
          className={`${controlClass} w-11 gap-2 px-0 sm:w-auto sm:px-3`}
          aria-pressed={settings.showHarakat}
          aria-label={settings.showHarakat ? t("إخفاء التشكيل") : t("إظهار التشكيل")}
        >
          <Bookmark className="h-4 w-4" />
          <span className="hidden sm:inline">
            {settings.showHarakat ? t("إخفاء التشكيل") : t("إظهار التشكيل")}
          </span>
        </button>
        <button
          onClick={() => setSettings((current) => ({ ...current, showFootnotes: !current.showFootnotes }))}
          className={`${controlClass} w-11 gap-2 px-0 sm:w-auto sm:px-3`}
          aria-pressed={settings.showFootnotes}
          aria-label={settings.showFootnotes ? t("إخفاء الحواشي") : t("إظهار الحواشي")}
        >
          <MessageSquareText className="h-4 w-4" />
          <span className="hidden sm:inline">
            {settings.showFootnotes ? t("إخفاء الحواشي") : t("إظهار الحواشي")}
          </span>
        </button>
        <button
          onClick={() => setSettings((current) => ({ ...current, showPageMarkers: !current.showPageMarkers }))}
          className={`${controlClass} w-11 gap-2 px-0 sm:w-auto sm:px-3`}
          aria-pressed={settings.showPageMarkers}
          aria-label={settings.showPageMarkers ? t("إخفاء الفاصل") : t("إظهار الفاصل")}
        >
          <SeparatorHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">
            {settings.showPageMarkers ? t("إخفاء الفاصل") : t("إظهار الفاصل")}
          </span>
        </button>
        <button
          onClick={onHide}
          className={`${controlClass} ms-auto w-11 gap-2 px-0 sm:w-auto sm:px-3`}
          aria-label={t("إخفاء الشريط")}
        >
          <EyeOff className="h-4 w-4" />
          <span className="hidden sm:inline">{t("إخفاء الشريط")}</span>
        </button>
      </div>
    </div>
  );
}

export function PageFootnotes({
  activeFootnoteId,
  footnotes,
  highlights,
  onHighlightSelect,
  pageId,
}: {
  activeFootnoteId: string | null;
  footnotes: PageFootnote[];
  highlights: LocalHighlight[];
  onHighlightSelect: (highlight: LocalHighlight) => void;
  pageId: number;
}) {
  const { t } = useUiTranslations();
  if (footnotes.length === 0) return null;
  let offsetBase = 0;

  return (
    <aside aria-label={t("حواشي الصفحة")} className="reader-footnotes mt-7">
      <div className="reader-footnotes-header">
        <span>{t("حواشي الصفحة")}</span>
      </div>
      {footnotes.map((footnote) => {
        const footnoteOffsetBase = offsetBase;
        offsetBase += footnote.text.length + 1;

        return (
          <div
            className={`reader-footnote${activeFootnoteId === footnote.id ? " reader-footnote--active" : ""}`}
            id={footnote.id}
            key={footnote.id}
            tabIndex={-1}
          >
            {footnote.marker && (
              <span className="reader-footnote-marker">{displayFootnoteMarker(footnote.marker)}</span>
            )}
            <p
              className="min-w-0 flex-1"
              data-reader-highlight-surface="footnote"
              data-reader-offset-base={footnoteOffsetBase}
              data-reader-page-id={pageId}
            >
              {renderHighlightedText(
                footnote.text,
                highlights,
                footnoteOffsetBase,
                onHighlightSelect,
                t("حذف التظليل"),
              )}
            </p>
          </div>
        );
      })}
    </aside>
  );
}

export function ReaderToc({
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

export function ChapterNav({
  chapter,
  label,
  role,
}: {
  chapter: ChapterSummary;
  label: string;
  role: "back" | "forward";
}) {
  return (
    <Link href={`/edition/${chapter.editionId}/section/${chapter.id}`} className="interactive-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-2 font-semibold leading-7">
        {chapter.titleAr}
        <DirectionalArrow className="ms-2 inline h-4 w-4" role={role} />
      </p>
    </Link>
  );
}
