import { type MouseEvent, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Copy,
  Highlighter,
  ListTree,
  Maximize2,
  MessageSquareText,
  Minimize2,
  SeparatorHorizontal,
  Share2,
  StickyNote,
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
  MIN_READER_FONT_SIZE,
  type PageFootnote,
} from "@/lib/reader-utils";
import { cleanBabTitle, stripSectionTypePrefix } from "@/lib/section-title";

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
      className="reader-bar-bottom reader-chrome fixed left-1/2 z-50 max-h-[55vh] w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 overflow-y-auto rounded-lg p-3 md:max-h-none"
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

function BarBtn({
  "aria-label": ariaLabel,
  active,
  children,
  onClick,
}: {
  "aria-label": string;
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={active}
      title={ariaLabel}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 active:scale-90 ${
        active
          ? "bg-foreground/[.12] text-foreground ring-1 ring-inset ring-foreground/20"
          : "text-foreground/55 hover:bg-foreground/[.07] hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function ReaderToolbar({
  bookProgress,
  isFocusMode,
  onToc,
  onToggleFocus,
  settings,
  setSettings,
}: {
  bookProgress: number;
  isFocusMode: boolean;
  onToc: () => void;
  onToggleFocus: () => void;
  settings: ReturnType<typeof useLocalLibrary>["settings"];
  setSettings: ReturnType<typeof useLocalLibrary>["setSettings"];
}) {
  const { t } = useUiTranslations();
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const show = () => {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 3000);
    };
    show();
    document.addEventListener("mousemove", show);
    document.addEventListener("touchstart", show, { passive: true });
    return () => {
      document.removeEventListener("mousemove", show);
      document.removeEventListener("touchstart", show);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const stepFontSize = (delta: number, event?: MouseEvent<HTMLButtonElement>) => {
    const multiplier = event?.shiftKey ? 2 : 1;
    setSettings((c) => ({ ...c, fontSize: clampReaderFontSize(c.fontSize + delta * multiplier) }));
  };

  return (
    <div
      role="toolbar"
      aria-label={t("أدوات القراءة")}
      data-tour="reader-toolbar"
      className={`reader-bar-bottom fixed inset-x-0 z-40 flex justify-center transition-all duration-500 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-5 opacity-0"
      }`}
    >
      <div className="reader-chrome relative flex max-w-[calc(100vw-2rem)] items-center gap-0.5 overflow-hidden rounded-full px-2 py-1 shadow-xl">

        {/* Reading progress — thin strip along the top edge of the pill */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-foreground/10" aria-hidden="true">
          <div
            className="h-full bg-foreground/35 transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, bookProgress))}%` }}
          />
        </div>

        {/* TOC */}
        <BarBtn aria-label={t("المحتويات")} onClick={onToc}>
          <ListTree className="h-[1.05rem] w-[1.05rem]" />
        </BarBtn>

        <span className="mx-0.5 h-5 w-px bg-foreground/12" aria-hidden="true" />

        {/* Font size: small أ baseline-aligned with large أ */}
        <button
          disabled={settings.fontSize <= MIN_READER_FONT_SIZE}
          onClick={(event) => stepFontSize(-2, event)}
          title={t("تصغير الخط")}
          className="inline-flex h-10 w-8 items-end justify-center pb-[0.45rem] text-foreground/55 transition-all duration-150 hover:text-foreground active:scale-90 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={t("تصغير الخط")}
          type="button"
        >
          <span className="select-none font-bold leading-none" style={{ fontSize: "0.65rem" }} aria-hidden="true">أ</span>
        </button>
        <span className="w-6 select-none text-center text-[0.65rem] font-semibold tabular-nums text-foreground/45">
          {settings.fontSize}
        </span>
        <button
          onClick={(event) => stepFontSize(2, event)}
          title={t("تكبير الخط")}
          className="inline-flex h-10 w-8 items-end justify-center pb-[0.15rem] text-foreground/55 transition-all duration-150 hover:text-foreground active:scale-90"
          aria-label={t("تكبير الخط")}
          type="button"
        >
          <span className="select-none font-bold leading-none" style={{ fontSize: "1.4rem" }} aria-hidden="true">أ</span>
        </button>

        <span className="mx-0.5 h-5 w-px bg-foreground/12" aria-hidden="true" />

        {/* Font family — segmented pill: active font shown inverted */}
        <div
          className="flex items-center overflow-hidden rounded-full border border-foreground/15"
          dir="ltr"
          role="group"
          aria-label={t("نوع الخط")}
        >
          <button
            onClick={() => setSettings((c) => ({ ...c, fontFamily: "amiri" }))}
            aria-pressed={settings.fontFamily === "amiri"}
            aria-label={t("خط أميري")}
            title={t("خط أميري")}
            className={`inline-flex h-8 w-8 items-center justify-center transition-colors duration-150 ${
              settings.fontFamily === "amiri"
                ? "bg-foreground text-background"
                : "text-foreground/55 hover:text-foreground"
            }`}
            style={{ fontFamily: "var(--app-font-serif)" }}
            type="button"
          >
            <span className="select-none text-sm font-bold leading-none" aria-hidden="true">أ</span>
          </button>
          <span className="h-4 w-px bg-foreground/15" aria-hidden="true" />
          <button
            onClick={() => setSettings((c) => ({ ...c, fontFamily: "naskh" }))}
            aria-pressed={settings.fontFamily !== "amiri"}
            aria-label={t("خط النسخ")}
            title={t("خط النسخ")}
            className={`inline-flex h-8 w-8 items-center justify-center transition-colors duration-150 ${
              settings.fontFamily !== "amiri"
                ? "bg-foreground text-background"
                : "text-foreground/55 hover:text-foreground"
            }`}
            style={{ fontFamily: "var(--app-font-sans)" }}
            type="button"
          >
            <span className="select-none text-sm font-bold leading-none" aria-hidden="true">أ</span>
          </button>
        </div>

        {/* Harakat */}
        <BarBtn
          aria-label={t("التشكيل")}
          active={settings.showHarakat}
          onClick={() => setSettings((c) => ({ ...c, showHarakat: !c.showHarakat }))}
        >
          <span className="select-none text-sm font-bold leading-none" aria-hidden="true">تَ</span>
        </BarBtn>

        {/* Footnotes */}
        <BarBtn
          aria-label={t("الحواشي")}
          active={settings.showFootnotes}
          onClick={() => setSettings((c) => ({ ...c, showFootnotes: !c.showFootnotes }))}
        >
          <MessageSquareText className="h-[1.05rem] w-[1.05rem]" />
        </BarBtn>

        {/* Page markers */}
        <BarBtn
          aria-label={t("فاصل الصفحات")}
          active={settings.showPageMarkers}
          onClick={() => setSettings((c) => ({ ...c, showPageMarkers: !c.showPageMarkers }))}
        >
          <SeparatorHorizontal className="h-[1.05rem] w-[1.05rem]" />
        </BarBtn>

        <span className="mx-0.5 h-5 w-px bg-foreground/12" aria-hidden="true" />

        {/* Focus mode */}
        <BarBtn
          aria-label={isFocusMode ? t("إلغاء وضع التركيز") : t("وضع التركيز")}
          active={isFocusMode}
          onClick={onToggleFocus}
        >
          {isFocusMode
            ? <Minimize2 className="h-[1.05rem] w-[1.05rem]" />
            : <Maximize2 className="h-[1.05rem] w-[1.05rem]" />
          }
        </BarBtn>
      </div>
    </div>
  );
}

export function FocusModeOverlay({ isFocusMode }: { isFocusMode: boolean }) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cursor auto-hide after 3s idle
  useEffect(() => {
    if (!isFocusMode) return;
    const html = document.documentElement;
    const onMove = () => {
      html.classList.remove("focus-cursor-hidden");
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = setTimeout(
        () => html.classList.add("focus-cursor-hidden"),
        3000,
      );
    };
    document.addEventListener("mousemove", onMove);
    return () => {
      document.removeEventListener("mousemove", onMove);
      html.classList.remove("focus-cursor-hidden");
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, [isFocusMode]);

  // Scroll progress bar
  useEffect(() => {
    if (!isFocusMode) return;
    const onScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setScrollProgress(total > 0 ? Math.min(100, Math.round((el.scrollTop / total) * 100)) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isFocusMode]);

  if (!isFocusMode) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[61] h-0.5 bg-border/30">
      <div
        className="h-full bg-primary/50 transition-[width] duration-150"
        style={{ width: `${scrollProgress}%` }}
      />
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
      <div className="flourish-rule mb-3 text-muted-foreground/50">
        <span className="flourish-rule__ornament flourish-rule__ornament--hollow" />
        <span className="flourish-rule__ornament" />
        <span className="flourish-rule__ornament flourish-rule__ornament--hollow" />
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
  pages: Pick<PageDetail, "pageNumber" | "sourcePageNumber" | "volume">[];
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
  const displayTitle =
    cleanBabTitle(stripSectionTypePrefix(chapter.titleAr, chapter.type)) || chapter.titleAr;
  return (
    <Link href={`/edition/${chapter.editionId}/section/${chapter.id}`} className="interactive-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-2 font-semibold leading-7">
        {displayTitle}
        <DirectionalArrow className="ms-2 inline h-4 w-4" role={role} />
      </p>
    </Link>
  );
}
