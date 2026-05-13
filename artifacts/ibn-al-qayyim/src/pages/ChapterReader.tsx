import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowRight,
  Bookmark,
  ChevronLeft,
  Copy,
  Highlighter,
  ListTree,
  Minus,
  Plus,
  StickyNote,
  Type,
  X,
} from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { ErrorState, LoadingState } from "@/components/editorial/DataState";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { stripHarakat, useLocalLibrary } from "@/lib/local-library";
import { type ChapterSummary, useStaticBook, useStaticBookChapter } from "@/lib/static-library";

export default function ChapterReader() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const bookIdNum = Number(bookId);
  const chapterIdNum = Number(chapterId);
  const { data: book } = useStaticBook(bookIdNum);
  const { data: chapter, isLoading, isError, refetch } = useStaticBookChapter(bookIdNum, chapterIdNum);
  const { addHighlight, addNote, savePosition, settings, setSettings } = useLocalLibrary();
  const [tocOpen, setTocOpen] = useState(false);
  const [selection, setSelection] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [progress, setProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const body = settings.showHarakat ? chapter?.content ?? "" : stripHarakat(chapter?.content ?? "");
  const fontFamily = settings.fontFamily === "amiri" ? "var(--app-font-serif)" : "var(--app-font-sans)";

  const chapters = book?.chapters ?? [];
  const currentIndex = chapters.findIndex((item) => item.id === chapterIdNum);
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? chapters[currentIndex + 1] : null;

  const readingMinutes = useMemo(() => {
    const count = body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(count / 180));
  }, [body]);

  const saveCurrentPosition = useCallback(() => {
    if (!chapter || !book) return;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const currentProgress = docHeight > 0 ? Math.min(100, (window.scrollY / docHeight) * 100) : 0;
    savePosition({
      bookId: book.id,
      bookTitle: book.titleAr,
      chapterId: chapter.id,
      chapterTitle: chapter.titleAr,
      progress: currentProgress,
      savedAt: Date.now(),
      scrollY: window.scrollY,
    });
  }, [book, chapter, savePosition]);

  useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, (window.scrollY / docHeight) * 100) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [chapterIdNum]);

  useEffect(() => {
    const interval = window.setInterval(saveCurrentPosition, 3000);
    return () => window.clearInterval(interval);
  }, [saveCurrentPosition]);

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
        <div className="h-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
      </div>

      <main className="mx-auto grid max-w-[90rem] gap-8 px-5 pb-36 pt-8 lg:grid-cols-[18rem_minmax(0,46rem)_18rem]">
        <ReaderToc
          bookId={book.id}
          chapterId={chapter.id}
          chapters={chapters}
          className="hidden lg:block"
        />

        <article className="min-w-0">
          <header className="border-b border-border pb-8 text-center">
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
            className="reader-text mx-auto mt-10 whitespace-pre-wrap text-right leading-[2.35] text-foreground"
            style={{ fontFamily, fontSize: settings.fontSize }}
          >
            {body || "لا يوجد نص متاح لهذا الفصل بعد."}
          </div>

          <footer className="mt-16 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
            {prev ? <ChapterNav chapter={prev} label="الفصل السابق" /> : <span />}
            {next ? <ChapterNav chapter={next} label="الفصل التالي" /> : <span />}
          </footer>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-lg border border-border p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">أدوات القراءة</p>
            <p className="mt-2 leading-7">حدد نصا لإضافة تظليل أو ملاحظة محلية. يحفظ موضع القراءة تلقائيا.</p>
            <div className="mt-4 h-px bg-border" />
            <p className="mt-4 tabular-nums">{Math.round(progress)}% من الفصل</p>
          </div>
        </aside>
      </main>

      <ReaderToolbar
        onToc={() => setTocOpen(true)}
        settings={settings}
        setSettings={setSettings}
      />

      {selection && (
        <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-lg border border-border bg-background p-3 shadow-lg md:bottom-20">
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
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                addHighlight({ ...selectionPayload(), color: "#f7efd8" });
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
                clearSelection();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold"
            >
              <StickyNote className="h-4 w-4" />
              حفظ ملاحظة
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(selection)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm"
            >
              <Copy className="h-4 w-4" />
              نسخ
            </button>
          </div>
        </div>
      )}

      <Sheet open={tocOpen} onOpenChange={setTocOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md" dir="rtl">
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
  onToc,
  settings,
  setSettings,
}: {
  onToc: () => void;
  settings: ReturnType<typeof useLocalLibrary>["settings"];
  setSettings: ReturnType<typeof useLocalLibrary>["setSettings"];
}) {
  const controlClass = "inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-3 text-sm transition-colors hover:border-foreground";
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:bottom-0">
      <div className="safe-bottom mx-auto flex max-w-[90rem] items-center gap-2 overflow-x-auto px-4 py-3">
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
          className={`${controlClass} mr-auto gap-2`}
        >
          <Bookmark className="h-4 w-4" />
          {settings.showHarakat ? "إخفاء التشكيل" : "إظهار التشكيل"}
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
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-lg border border-border p-3">
        <p className="mb-3 px-2 text-sm font-semibold text-foreground">الفهرس</p>
        <div className="space-y-1">
          {chapters.map((item) => (
            <Link
              key={item.id}
              href={`/book/${bookId}/chapter/${item.id}`}
              onClick={onSelect}
              className={`block rounded-md px-3 py-2 text-sm leading-6 transition-colors hover:bg-muted ${
                item.id === chapterId ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
              style={{ marginRight: `${Math.max(0, item.level - 1) * 10}px` }}
            >
              {item.titleAr}
            </Link>
          ))}
        </div>
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
