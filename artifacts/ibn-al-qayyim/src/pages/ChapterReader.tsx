import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowRight,
  Bookmark,
  ChevronLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  Menu,
  Highlighter,
  ListTree,
  Minus,
  Plus,
  Share2,
  StickyNote,
  Type,
  X,
} from "lucide-react";
import BookTocTree from "@/components/BookTocTree";
import AppShell from "@/components/editorial/AppShell";
import { ErrorState, LoadingState } from "@/components/editorial/DataState";
import QuoteShareModal from "@/components/QuoteShareModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getHighlightStyle, HIGHLIGHT_PALETTE } from "@/lib/highlights";
import { type LocalHighlight, stripHarakat, useLocalLibrary } from "@/lib/local-library";
import { calculateBookPageProgress } from "@/lib/reading-progress";
import { type ChapterSummary, useStaticBook, useStaticBookChapter } from "@/lib/static-library";

type ReaderStatus = "copied" | "highlighted" | "noted" | "saved" | null;
type HighlightColor = string;

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

function buildShareText(text: string, bookTitle: string, chapterTitle: string) {
  return `${text.trim()}\n\n— ابن القيم الجوزية رحمه الله\n${bookTitle} / ${chapterTitle}`;
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

export default function ChapterReader() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const bookIdNum = Number(bookId);
  const chapterIdNum = Number(chapterId);
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
  const contentRef = useRef<HTMLDivElement>(null);
  const selectionToolbarRef = useRef<HTMLDivElement>(null);

  const body = settings.showHarakat ? chapter?.content ?? "" : stripHarakat(chapter?.content ?? "");
  const fontFamily = settings.fontFamily === "amiri" ? "var(--app-font-serif)" : "var(--app-font-sans)";

  const chapters = book?.chapters ?? [];
  const currentIndex = chapters.findIndex((item) => item.id === chapterIdNum);
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? chapters[currentIndex + 1] : null;
  const bookProgress = useMemo(() => calculateBookPageProgress(book, chapter), [book, chapter]);

  const readingMinutes = useMemo(() => {
    const count = body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(count / 180));
  }, [body]);

  const chapterHighlights = useMemo(
    () => highlights.filter((highlight) => highlight.chapterId === chapterIdNum),
    [chapterIdNum, highlights],
  );

  const renderedBody = useMemo(
    () => renderHighlightedText(body, chapterHighlights),
    [body, chapterHighlights],
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
    });
  }, [book, bookProgress, chapter, savePosition]);

  useEffect(() => {
    const interval = window.setInterval(saveCurrentPosition, 3000);
    return () => window.clearInterval(interval);
  }, [saveCurrentPosition]);

  useEffect(() => {
    clearSelection();
  }, [chapterIdNum]);

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
    await copyText(buildShareText(body, book.titleAr, chapter.titleAr));
    showStatus("copied");
  };

  const handleCopySelection = async () => {
    await copyText(buildShareText(selection, book!.titleAr, chapter!.titleAr));
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

  return (
    <AppShell>
      <div className="fixed left-0 right-0 top-16 z-40 h-px bg-border">
        <div className="h-full bg-foreground transition-all" style={{ width: `${bookProgress}%` }} />
      </div>

      <main className="mx-auto grid max-w-7xl gap-0 px-5 pb-36 pt-8">
        <article className="min-w-0 border-x border-border bg-background">
          <div className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
            <div className="flex h-14 items-center justify-between gap-3 px-4">
              <button
                onClick={() => setTocOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted lg:hidden"
                aria-label="الفهرس"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-sm font-semibold">{book.titleAr}</p>
                <p className="truncate text-xs text-muted-foreground">{chapter.titleAr}</p>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <button
                  onClick={handleSavePosition}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="حفظ موضع القراءة"
                >
                  <Bookmark className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCopyChapter}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="نسخ الفصل"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 pb-3 text-xs text-muted-foreground">
              <span className="tabular-nums">{Math.round(bookProgress)}%</span>
              <div className="h-px flex-1 bg-border">
                <div className="h-px bg-foreground" style={{ width: `${bookProgress}%` }} />
              </div>
            </div>
          </div>

          <header className="mx-auto max-w-3xl border-b border-border px-6 py-10 text-center">
            <Link href={`/book/${book.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowRight className="h-4 w-4" />
              {book.titleAr}
            </Link>
            <h1 className="mx-auto mt-5 max-w-3xl font-display text-3xl font-bold leading-tight md:text-5xl">
              {chapter.titleAr}
            </h1>
            <p className="mt-4 text-sm text-muted-foreground tabular-nums">
              {readingMinutes} دقائق قراءة / صفحة {chapter.page}
            </p>
          </header>

          <div
            ref={contentRef}
            className="reader-text mx-auto mt-10 whitespace-pre-wrap px-6 text-right leading-[2.35] text-foreground"
            style={{ fontFamily, fontSize: settings.fontSize }}
          >
            {body ? renderedBody : "لا يوجد نص متاح لهذا الفصل بعد."}
          </div>

          <footer className="mx-6 mt-16 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
            {prev ? <ChapterNav chapter={prev} label="الفصل السابق" /> : <span />}
            {next ? <ChapterNav chapter={next} label="الفصل التالي" /> : <span />}
          </footer>
        </article>
      </main>

      <ReaderToolbar
        isVisible={toolbarVisible}
        onHide={() => setToolbarVisible(false)}
        onShow={() => setToolbarVisible(true)}
        onToc={() => setTocOpen(true)}
        settings={settings}
        setSettings={setSettings}
      />

      {status && (
        <div className="fixed bottom-32 left-1/2 z-[55] -translate-x-1/2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold shadow-lg md:bottom-20">
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            {status === "copied" && "تم النسخ"}
            {status === "highlighted" && "تم حفظ التظليل"}
            {status === "noted" && "تم حفظ الملاحظة"}
            {status === "saved" && "تم حفظ الموضع"}
          </span>
        </div>
      )}

      {selection && (
        <div
          ref={selectionToolbarRef}
          className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-lg border border-border bg-background p-3 shadow-lg md:bottom-20"
        >
          <div className="flex items-start gap-3">
            <p className="line-clamp-2 flex-1 text-sm leading-6 text-muted-foreground">{selection}</p>
            <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground" aria-label="إغلاق">
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="ملاحظة اختيارية"
            className="mt-3 h-20 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:border-foreground focus:outline-none"
          />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">لون التظليل</span>
            <div className="flex items-center gap-1">
              {HIGHLIGHT_PALETTE.map((color) => (
                <button
                  aria-label={`تظليل ${color.name}`}
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
              تظليل
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
              حفظ ملاحظة
            </button>
            <button
              onClick={handleCopySelection}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm"
            >
              <Copy className="h-4 w-4" />
              نسخ
            </button>
            <button
              onClick={() => setShareText(selection)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm"
            >
              <Share2 className="h-4 w-4" />
              مشاركة
            </button>
          </div>
        </div>
      )}

      {shareText && (
        <QuoteShareModal
          bookTitle={book.titleAr}
          chapterTitle={chapter.titleAr}
          pageNumber={chapter.page}
          coverColor={book.coverColor}
          onClose={() => setShareText(null)}
          text={shareText}
        />
      )}

      <Sheet open={tocOpen} onOpenChange={setTocOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-full overflow-y-auto sm:max-w-md lg:max-w-lg"
          dir="rtl"
        >
          <SheetHeader>
            <SheetTitle>الفهرس</SheetTitle>
          </SheetHeader>
          <ReaderToc bookId={book.id} chapterId={chapter.id} chapters={chapters} onSelect={() => setTocOpen(false)} />
        </SheetContent>
      </Sheet>
    </AppShell>
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
  const controlClass = "inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-3 text-sm transition-colors hover:border-foreground";
  if (!isVisible) {
    return (
      <button
        onClick={onShow}
        className="fixed bottom-20 left-4 z-40 inline-flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold shadow-lg transition-colors hover:border-foreground md:bottom-4"
      >
        <Eye className="h-4 w-4" />
        إظهار الشريط
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:bottom-0">
      <div className="safe-bottom mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-3">
        <button onClick={onToc} className={`${controlClass} gap-2`}>
          <ListTree className="h-4 w-4" />
          الفهرس
        </button>
        <button
          onClick={() => setSettings((current) => ({ ...current, fontSize: Math.max(16, current.fontSize - 2) }))}
          className={`${controlClass} w-11 px-0`}
          aria-label="تصغير الخط"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="hidden h-11 items-center rounded-md border border-border px-3 text-sm tabular-nums text-muted-foreground sm:inline-flex">
          {settings.fontSize}
        </span>
        <button
          onClick={() => setSettings((current) => ({ ...current, fontSize: Math.min(34, current.fontSize + 2) }))}
          className={`${controlClass} w-11 px-0`}
          aria-label="تكبير الخط"
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
        >
          <Type className="h-4 w-4" />
          نوع الخط
        </button>
        <button
          onClick={() => setSettings((current) => ({ ...current, showHarakat: !current.showHarakat }))}
          className={`${controlClass} gap-2`}
        >
          <Bookmark className="h-4 w-4" />
          {settings.showHarakat ? "إخفاء التشكيل" : "إظهار التشكيل"}
        </button>
        <button onClick={onHide} className={`${controlClass} mr-auto gap-2`}>
          <EyeOff className="h-4 w-4" />
          إخفاء الشريط
        </button>
      </div>
    </div>
  );
}

function ReaderToc({
  bookId,
  chapterId,
  chapters,
  className = "",
  onSelect,
}: {
  bookId: number;
  chapterId: number;
  chapters: ChapterSummary[];
  className?: string;
  onSelect?: () => void;
}) {
  return (
    <aside className={className}>
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto border-y border-r border-border p-3">
        <p className="mb-3 px-2 text-sm font-semibold text-foreground">الفهرس</p>
        <BookTocTree
          bookId={bookId}
          chapters={chapters}
          compact
          currentChapterId={chapterId}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
}

function ChapterNav({ chapter, label }: { chapter: ChapterSummary; label: string }) {
  return (
    <Link
      href={`/book/${chapter.bookId}/chapter/${chapter.id}`}
      className="rounded-lg border border-border p-4 transition-colors hover:border-foreground"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-2 font-semibold leading-7">
        {chapter.titleAr}
        <ChevronLeft className="mr-2 inline h-4 w-4 rotate-180" />
      </p>
    </Link>
  );
}
