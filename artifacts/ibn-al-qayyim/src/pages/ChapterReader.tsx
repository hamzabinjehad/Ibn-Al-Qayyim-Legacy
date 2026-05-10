import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  useGetChapter,
  useGetBook,
  useListChapters,
  useListHighlights,
  useCreateHighlight,
  useDeleteHighlight,
  useListNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useListComments,
  useCreateComment,
  useDeleteComment,
  getListHighlightsQueryKey,
  getListNotesQueryKey,
  getListCommentsQueryKey,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { getSessionId } from "@/lib/session";
import {
  ChevronLeft,
  ChevronRight,
  X,
  PenLine,
  MessageSquare,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
  BookOpen,
  StickyNote,
  Share2,
  Type,
  Bookmark,
  Highlighter,
  Palette,
} from "lucide-react";
import QuoteShareModal from "@/components/QuoteShareModal";

const HIGHLIGHT_COLORS = [
  { value: "#FEF08A", label: "أصفر" },
  { value: "#BBF7D0", label: "أخضر" },
  { value: "#BFDBFE", label: "أزرق" },
  { value: "#FBCFE8", label: "وردي" },
];

const ARABIC_FONTS = [
  { id: "harmattan",    label: "سما",        family: "'Harmattan', sans-serif" },
  { id: "amiri",        label: "الأميري",    family: "'Amiri', serif" },
  { id: "noto-naskh",   label: "نوتو نسخ",   family: "'Noto Naskh Arabic', serif" },
  { id: "scheherazade", label: "قياث",       family: "'Scheherazade New', serif" },
] as const;

type FontId = (typeof ARABIC_FONTS)[number]["id"];

const FONT_SIZE_STEPS = [14, 16, 18, 20, 22, 24, 26, 28, 32] as const;
type FontSizeStep = (typeof FONT_SIZE_STEPS)[number];
const DEFAULT_FONT_SIZE: FontSizeStep = 20;

const FONT_STORAGE_KEY      = "ibn-al-qayyim:font";
const FONT_SIZE_STORAGE_KEY = "ibn-al-qayyim:font-size";
const HARAKAT_STORAGE_KEY   = "ibn-al-qayyim:harakat";

const READING_POS_KEY = (bookId: number, chapterId: number) =>
  `ibn-al-qayyim:reading:${bookId}:${chapterId}`;

interface ReadingPosition {
  scrollY: number;
  progress: number;
  savedAt: number;
}

const HARAKAT_RE = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/;
const stripHarakat = (text: string) => text.replace(new RegExp(HARAKAT_RE.source, "g"), "");

// Maps a character position in stripped (harakat-free) text back to the
// corresponding position in the original text that includes harakat.
function strippedToRawOffset(raw: string, strippedPos: number): number {
  let stripped = 0;
  for (let i = 0; i < raw.length; i++) {
    if (stripped === strippedPos) return i;
    if (!HARAKAT_RE.test(raw[i])) stripped++;
  }
  return raw.length;
}

interface SelectionState {
  text: string;
  startOffset: number;
  endOffset: number;
  x: number;
  y: number;
  yBottom: number;
}

type Tab = "notes" | "highlights" | "comments";

export default function ChapterReader() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const [, navigate] = useLocation();
  const bookIdNum = parseInt(bookId);
  const chapterIdNum = parseInt(chapterId);
  const sessionId = getSessionId();
  const queryClient = useQueryClient();

  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [shareQuote, setShareQuote] = useState<string | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [inlineNote, setInlineNote] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyAuthor, setReplyAuthor] = useState("");
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [fontId, setFontId] = useState<FontId>(
    () => (localStorage.getItem(FONT_STORAGE_KEY) as FontId | null) ?? "amiri"
  );
  const [fontSize, setFontSize] = useState<FontSizeStep>(() => {
    const stored = parseInt(localStorage.getItem(FONT_SIZE_STORAGE_KEY) ?? "");
    return (FONT_SIZE_STEPS as readonly number[]).includes(stored)
      ? (stored as FontSizeStep)
      : DEFAULT_FONT_SIZE;
  });
  const [showHarakat, setShowHarakat] = useState(
    () => localStorage.getItem(HARAKAT_STORAGE_KEY) !== "false"
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedPos, setSavedPos] = useState<ReadingPosition | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const inlineNoteRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const saveScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs so handleTextSelection (stable callback) can read latest values
  const showHarakatRef = useRef(showHarakat);
  const chapterContentRef = useRef<string | undefined>(undefined);

  const currentFont = ARABIC_FONTS.find((f) => f.id === fontId) ?? ARABIC_FONTS[0];
  const fontSizeIdx = FONT_SIZE_STEPS.indexOf(fontSize as never);
  const canDecrease = fontSizeIdx > 0;
  const canIncrease = fontSizeIdx < FONT_SIZE_STEPS.length - 1;

  const { data: chapter, isLoading: loadingChapter } = useGetChapter(chapterIdNum, {
    query: { enabled: !!chapterIdNum },
  });
  const { data: book } = useGetBook(bookIdNum, { query: { enabled: !!bookIdNum } });
  const { data: chapters } = useListChapters(bookIdNum, { query: { enabled: !!bookIdNum } });

  const { data: highlights } = useListHighlights(
    { chapterId: chapterIdNum, sessionId },
    { query: { enabled: !!chapterIdNum } }
  );
  const { data: notes } = useListNotes(
    { chapterId: chapterIdNum, sessionId },
    { query: { enabled: !!chapterIdNum } }
  );
  const { data: comments } = useListComments(
    { chapterId: chapterIdNum },
    { query: { enabled: !!chapterIdNum } }
  );

  const createHighlight = useCreateHighlight();
  const deleteHighlight = useDeleteHighlight();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const createComment = useCreateComment();
  const deleteCommentMutation = useDeleteComment();
  const { toast } = useToast();

  const invalidateHighlights = () =>
    queryClient.invalidateQueries({ queryKey: getListHighlightsQueryKey({ chapterId: chapterIdNum, sessionId }) });
  const invalidateNotes = () =>
    queryClient.invalidateQueries({ queryKey: getListNotesQueryKey({ chapterId: chapterIdNum, sessionId }) });
  const invalidateComments = () =>
    queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey({ chapterId: chapterIdNum }) });

  const readingTimeMinutes = useMemo(() => {
    if (!chapter?.content) return null;
    const wordCount = chapter.content.trim().split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 180);
    return minutes;
  }, [chapter?.content]);

  // Prev/Next chapter navigation
  const sortedChapters = chapters ? [...chapters].sort((a, b) => a.orderIndex - b.orderIndex) : [];
  const currentIdx = sortedChapters.findIndex((c) => c.id === chapterIdNum);
  const prevChapter = currentIdx > 0 ? sortedChapters[currentIdx - 1] : null;
  const nextChapter = currentIdx !== -1 && currentIdx < sortedChapters.length - 1 ? sortedChapters[currentIdx + 1] : null;

  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      return;
    }
    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();
    if (!text || text.length < 2) return;
    if (!contentRef.current?.contains(range.commonAncestorContainer)) return;

    const rect = range.getBoundingClientRect();

    const preSelectionRange = range.cloneRange();
    if (contentRef.current.firstChild) {
      preSelectionRange.selectNodeContents(contentRef.current);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
    }
    let startOffset = preSelectionRange.toString().length;
    let endOffset = startOffset + text.length;

    // DOM text is harakat-stripped when showHarakat=false; convert positions
    // back to raw-content positions so stored offsets are always against the
    // original text (with harakat), keeping highlights stable across toggles.
    const rawContent = chapterContentRef.current;
    if (!showHarakatRef.current && rawContent) {
      startOffset = strippedToRawOffset(rawContent, startOffset);
      endOffset   = strippedToRawOffset(rawContent, endOffset);
    }

    setNoteMode(false);
    setInlineNote("");
    setSelection({
      text,
      startOffset,
      endOffset,
      x: rect.left + rect.width / 2,
      y: rect.top,
      yBottom: rect.bottom,
    });
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelection);
    return () => document.removeEventListener("mouseup", handleTextSelection);
  }, [handleTextSelection]);

  // إغلاق النافذة عند التمرير + تتبع مسار القراءة
  useEffect(() => {
    const handleScroll = () => {
      if (selection) {
        setSelection(null);
        setNoteMode(false);
        setInlineNote("");
      }
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      setScrollProgress(progress);
      setShowBackToTop(scrollTop > 400);

      if (saveScrollTimerRef.current) clearTimeout(saveScrollTimerRef.current);
      saveScrollTimerRef.current = setTimeout(() => {
        if (progress > 3) {
          const pos: ReadingPosition = { scrollY: scrollTop, progress, savedAt: Date.now() };
          localStorage.setItem(READING_POS_KEY(bookIdNum, chapterIdNum), JSON.stringify(pos));
          setSavedPos(pos);
        }
      }, 2000);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (saveScrollTimerRef.current) clearTimeout(saveScrollTimerRef.current);
    };
  }, [selection, bookIdNum, chapterIdNum]);

  useEffect(() => {
    if (noteMode && inlineNoteRef.current) {
      setTimeout(() => inlineNoteRef.current?.focus(), 50);
    }
  }, [noteMode]);

  useEffect(() => {
    localStorage.setItem(FONT_STORAGE_KEY, fontId);
  }, [fontId]);

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(HARAKAT_STORAGE_KEY, showHarakat.toString());
    showHarakatRef.current = showHarakat;
  }, [showHarakat]);

  useEffect(() => {
    chapterContentRef.current = chapter?.content;
  }, [chapter?.content]);

  useEffect(() => {
    if (!bookIdNum || !chapterIdNum) return;
    const stored = localStorage.getItem(READING_POS_KEY(bookIdNum, chapterIdNum));
    if (!stored) return;
    try {
      const pos = JSON.parse(stored) as ReadingPosition;
      if (pos.progress > 5) {
        setSavedPos(pos);
        setShowResumeBanner(true);
      }
    } catch {}
  }, [bookIdNum, chapterIdNum]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  const handleHighlight = (color: string) => {
    if (!selection) return;
    createHighlight.mutate(
      {
        data: {
          chapterId: chapterIdNum,
          sessionId,
          selectedText: selection.text,
          startOffset: selection.startOffset,
          endOffset: selection.endOffset,
          color,
        },
      },
      {
        onSuccess: () => {
          invalidateHighlights();
          setSelection(null);
          window.getSelection()?.removeAllRanges();
        },
        onError: () =>
          toast({ title: "خطأ في التظليل", description: "تعذّر حفظ التظليل، حاول مرة أخرى", variant: "destructive" }),
      }
    );
  };

  const handleAddNote = (text?: string, selected?: string) => {
    const content = text ?? newNote;
    if (!content.trim()) return;
    createNote.mutate(
      {
        data: {
          chapterId: chapterIdNum,
          sessionId,
          content: content.trim(),
          selectedText: selected ?? selection?.text,
        },
      },
      {
        onSuccess: () => {
          invalidateNotes();
          setNewNote("");
          setInlineNote("");
          setNoteMode(false);
          setSelection(null);
          window.getSelection()?.removeAllRanges();
        },
        onError: () =>
          toast({ title: "خطأ في الحفظ", description: "تعذّر حفظ الملاحظة، حاول مرة أخرى", variant: "destructive" }),
      }
    );
  };

  const handleUpdateNote = (noteId: number) => {
    if (!editingNoteText.trim()) return;
    updateNote.mutate(
      { noteId, data: { content: editingNoteText.trim() } },
      {
        onSuccess: () => {
          invalidateNotes();
          setEditingNoteId(null);
          setEditingNoteText("");
        },
        onError: () =>
          toast({ title: "خطأ في التحديث", description: "تعذّر تحديث الملاحظة", variant: "destructive" }),
      }
    );
  };

  const handleDeleteNote = (noteId: number) => {
    deleteNote.mutate(
      { noteId },
      {
        onSuccess: invalidateNotes,
        onError: () =>
          toast({ title: "خطأ في الحذف", description: "تعذّر حذف الملاحظة", variant: "destructive" }),
      }
    );
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !commentAuthor.trim()) return;
    createComment.mutate(
      {
        data: {
          chapterId: chapterIdNum,
          authorName: commentAuthor.trim(),
          content: newComment.trim(),
        },
      },
      {
        onSuccess: () => {
          invalidateComments();
          setNewComment("");
        },
        onError: () =>
          toast({ title: "خطأ في الإرسال", description: "تعذّر إرسال التعليق، حاول مرة أخرى", variant: "destructive" }),
      }
    );
  };

  const handleReply = (parentId: number) => {
    if (!replyText.trim() || !replyAuthor.trim()) return;
    createComment.mutate(
      {
        data: {
          chapterId: chapterIdNum,
          authorName: replyAuthor.trim(),
          content: replyText.trim(),
          parentId,
        },
      },
      {
        onSuccess: () => {
          invalidateComments();
          setReplyTo(null);
          setReplyText("");
          setReplyAuthor("");
          setExpandedComments((prev) => new Set([...prev, parentId]));
        },
        onError: () =>
          toast({ title: "خطأ في الإرسال", description: "تعذّر إرسال الرد، حاول مرة أخرى", variant: "destructive" }),
      }
    );
  };

  const resumeReading = () => {
    if (!savedPos) return;
    window.scrollTo({ top: savedPos.scrollY, behavior: "smooth" });
    setShowResumeBanner(false);
  };

  const saveBookmark = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
    const pos: ReadingPosition = { scrollY: scrollTop, progress, savedAt: Date.now() };
    localStorage.setItem(READING_POS_KEY(bookIdNum, chapterIdNum), JSON.stringify(pos));
    setSavedPos(pos);
    setShowResumeBanner(false);
    toast({ title: "تم حفظ نقطة التوقف", description: `عند ${Math.round(progress)}٪ من الفصل` });
  };

  const clearBookmark = () => {
    localStorage.removeItem(READING_POS_KEY(bookIdNum, chapterIdNum));
    setSavedPos(null);
    setShowResumeBanner(false);
    toast({ title: "تم حذف نقطة التوقف" });
  };

  const display = (text: string) => (showHarakat ? text : stripHarakat(text));

  const renderHighlightedContent = () => {
    if (!chapter?.content) return null;
    if (!highlights || highlights.length === 0) {
      return <div className="whitespace-pre-wrap leading-relaxed">{display(chapter.content)}</div>;
    }

    const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
    const segments: { text: string; highlight?: (typeof highlights)[0] }[] = [];
    let cursor = 0;
    const content = chapter.content;

    for (const hl of sorted) {
      if (hl.endOffset <= cursor) continue; // fully covered by previous highlight
      if (hl.startOffset > cursor) {
        segments.push({ text: content.slice(cursor, hl.startOffset) });
      }
      const start = Math.max(hl.startOffset, cursor);
      segments.push({ text: content.slice(start, hl.endOffset), highlight: hl });
      cursor = hl.endOffset;
    }
    if (cursor < content.length) {
      segments.push({ text: content.slice(cursor) });
    }

    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {segments.map((seg, i) =>
          seg.highlight ? (
            <mark
              key={i}
              style={{ backgroundColor: seg.highlight.color }}
              className="rounded px-0.5 cursor-pointer"
              title="انقر لحذف التظليل"
              onClick={() =>
                deleteHighlight.mutate(
                  { highlightId: seg.highlight!.id },
                  {
                    onSuccess: invalidateHighlights,
                    onError: () =>
                      toast({ title: "خطأ في الحذف", description: "تعذّر حذف التظليل", variant: "destructive" }),
                  }
                )
              }
            >
              {display(seg.text)}
            </mark>
          ) : (
            <span key={i}>{display(seg.text)}</span>
          )
        )}
      </div>
    );
  };

  if (loadingChapter) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse">
          <div className="h-6 bg-muted rounded w-64 mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-5 bg-muted rounded w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <Navbar />

      {/* Reading progress bar */}
      <div className="fixed top-16 left-0 right-0 z-40 h-1 bg-border">
        <div
          className="h-full bg-primary transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
        {savedPos && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-background shadow-sm"
            style={{ left: `${savedPos.progress}%`, transform: "translate(-50%, -50%)" }}
            title={`نقطة التوقف عند ${Math.round(savedPos.progress)}٪`}
          />
        )}
      </div>

      <div className="flex max-w-7xl mx-auto relative">
        {/* Main Content */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap">
            <Link href="/library" className="hover:text-primary">المكتبة</Link>
            <ChevronLeft className="w-3 h-3 rotate-180" />
            <Link href={`/book/${bookIdNum}`} className="hover:text-primary">{book?.titleAr}</Link>
            <ChevronLeft className="w-3 h-3 rotate-180" />
            <span className="text-foreground">{chapter?.titleAr}</span>
          </div>

          {/* Header row */}
          <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{chapter?.titleAr}</h1>
            <div className="flex items-center gap-2">
              {/* Bookmark button */}
              <div className="flex items-center gap-1">
                <button
                  onClick={saveBookmark}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors border ${savedPos ? "bg-amber-500/10 border-amber-500 text-amber-600" : "bg-card border-border text-foreground hover:border-amber-500 hover:text-amber-600"}`}
                  title="حفظ نقطة التوقف الحالية"
                  data-testid="button-save-bookmark"
                >
                  <Bookmark className={`w-4 h-4 ${savedPos ? "fill-amber-400" : ""}`} />
                  <span className="hidden sm:inline">
                    {savedPos ? `عند ${Math.round(savedPos.progress)}٪` : "نقطة توقف"}
                  </span>
                </button>
                {savedPos && (
                  <button
                    onClick={clearBookmark}
                    className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                    title="حذف نقطة التوقف"
                    data-testid="button-clear-bookmark"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Reading settings button + panel */}
              <div ref={settingsRef} className="relative">
                <button
                  onClick={() => setSettingsOpen((v) => !v)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors border ${settingsOpen ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-foreground hover:border-primary hover:text-primary"}`}
                  data-testid="button-reading-settings"
                  title="إعدادات القراءة"
                >
                  <Type className="w-4 h-4" />
                  <span className="hidden sm:inline">إعدادات القراءة</span>
                </button>

                {settingsOpen && (
                  <div className="absolute left-0 top-full mt-2 z-50 bg-card border border-border rounded-xl shadow-xl p-4 w-72" dir="rtl">

                    {/* ── حجم الخط ── */}
                    <p className="text-xs font-semibold text-muted-foreground mb-3">حجم الخط</p>
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <button
                        onClick={() => canDecrease && setFontSize(FONT_SIZE_STEPS[fontSizeIdx - 1])}
                        disabled={!canDecrease}
                        className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-lg font-bold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        data-testid="button-font-decrease"
                        aria-label="تصغير الخط"
                      >
                        −
                      </button>
                      <div className="flex-1 flex items-center justify-center gap-1.5">
                        <span className="text-base font-bold text-foreground tabular-nums">{fontSize}</span>
                        <span className="text-xs text-muted-foreground">px</span>
                        <div className="flex gap-0.5 mr-1">
                          {FONT_SIZE_STEPS.map((s) => (
                            <div
                              key={s}
                              className={`h-1 rounded-full transition-all ${s === fontSize ? "w-3 bg-primary" : "w-1 bg-border"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => canIncrease && setFontSize(FONT_SIZE_STEPS[fontSizeIdx + 1])}
                        disabled={!canIncrease}
                        className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-lg font-bold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        data-testid="button-font-increase"
                        aria-label="تكبير الخط"
                      >
                        +
                      </button>
                    </div>

                    {/* ── نوع الخط ── */}
                    <div className="border-t border-border pt-4 mb-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">نوع الخط</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {ARABIC_FONTS.map((font) => (
                          <button
                            key={font.id}
                            onClick={() => setFontId(font.id)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-right ${fontId === font.id ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40 text-foreground"}`}
                            data-testid={`font-option-${font.id}`}
                          >
                            <span style={{ fontFamily: font.family }} className="text-base leading-none">
                              {font.label}
                            </span>
                            <span style={{ fontFamily: font.family }} className="text-xs text-muted-foreground">
                              بِسْمِ اللَّهِ
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── التشكيل ── */}
                    <div className="border-t border-border pt-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">عرض النص</p>
                      <button
                        onClick={() => setShowHarakat((v) => !v)}
                        className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg border border-border hover:border-primary/50 transition-all"
                        data-testid="button-toggle-harakat"
                      >
                        <span className="text-sm text-foreground">إظهار التشكيل (الحركات)</span>
                        <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${showHarakat ? "bg-primary" : "bg-muted"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${showHarakat ? "right-0.5" : "left-0.5"}`} />
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all border ${sidebarOpen ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary hover:text-primary"}`}
                data-testid="button-toggle-sidebar"
              >
                <PenLine className="w-4 h-4" />
                <span className="hidden sm:inline">الملاحظات</span>
                {((notes?.length ?? 0) + (highlights?.length ?? 0)) > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sidebarOpen ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}>
                    {(notes?.length ?? 0) + (highlights?.length ?? 0)}
                  </span>
                )}
              </button>
            </div>
          </div>
          {readingTimeMinutes !== null && (
            <p className="text-xs text-muted-foreground mb-6">وقت القراءة التقديري: {readingTimeMinutes} دقيقة</p>
          )}

          {/* Chapter navigation — top */}
          {sortedChapters.length > 1 && (
            <div className="flex items-center justify-between mb-8 gap-3">
              <button
                onClick={() => prevChapter && navigate(`/book/${bookIdNum}/chapter/${prevChapter.id}`)}
                disabled={!prevChapter}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm hover:border-primary hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                data-testid="button-prev-chapter"
              >
                <ChevronRight className="w-4 h-4" />
                {prevChapter ? <span className="max-w-[180px] truncate">{prevChapter.titleAr}</span> : "لا يوجد سابق"}
              </button>

              <span className="text-xs text-muted-foreground shrink-0">
                {currentIdx + 1} / {sortedChapters.length}
              </span>

              <button
                onClick={() => nextChapter && navigate(`/book/${bookIdNum}/chapter/${nextChapter.id}`)}
                disabled={!nextChapter}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm hover:border-primary hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                data-testid="button-next-chapter"
              >
                {nextChapter ? <span className="max-w-[180px] truncate">{nextChapter.titleAr}</span> : "لا يوجد تالٍ"}
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Selection Toolbar */}
          {selection && (
            <div
              className="fixed z-50 bg-card border border-border rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5"
              style={(() => {
                const toolbarH = noteMode ? 252 : 136;
                const clampedX = Math.min(Math.max(selection.x, 150), window.innerWidth - 150);
                const showAbove = selection.y > toolbarH + 24;
                return {
                  left: `${clampedX}px`,
                  top: showAbove
                    ? `${selection.y - toolbarH - 10}px`
                    : `${selection.yBottom + 10}px`,
                  transform: "translateX(-50%)",
                  minWidth: "260px",
                  maxWidth: "320px",
                };
              })()}
            >
              {!noteMode ? (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">تظليل النص</span>
                    </div>
                    <button
                      onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Color swatches */}
                  <div className="flex gap-2 justify-center py-0.5">
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => handleHighlight(c.value)}
                        className="w-8 h-8 rounded-full border-2 border-transparent hover:border-foreground/40 hover:scale-110 transition-all shadow-sm"
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                        data-testid={`button-highlight-${c.label}`}
                      />
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="border-t border-border/60 pt-2 flex flex-col gap-1">
                    <button
                      onClick={() => setNoteMode(true)}
                      className="flex items-center gap-2 text-xs text-foreground hover:bg-muted rounded-lg px-2.5 py-1.5 w-full transition-colors"
                      data-testid="button-add-note-from-selection"
                    >
                      <StickyNote className="w-3.5 h-3.5 text-primary" />
                      إضافة ملاحظة
                    </button>
                    <button
                      onClick={() => {
                        setShareQuote(selection.text);
                        setSelection(null);
                        window.getSelection()?.removeAllRanges();
                      }}
                      className="flex items-center gap-2 text-xs text-foreground hover:bg-muted rounded-lg px-2.5 py-1.5 w-full transition-colors"
                      data-testid="button-share-quote"
                    >
                      <Share2 className="w-3.5 h-3.5 text-amber-500" />
                      مشاركة الاقتباس
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <StickyNote className="w-3.5 h-3.5" />
                      ملاحظة على النص
                    </span>
                    <button
                      onClick={() => { setNoteMode(false); setInlineNote(""); }}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground bg-primary/5 rounded-lg px-2.5 py-2 border-r-2 border-primary/50 line-clamp-2 leading-relaxed">
                    "{selection.text}"
                  </div>
                  <textarea
                    ref={inlineNoteRef}
                    value={inlineNote}
                    onChange={(e) => setInlineNote(e.target.value)}
                    placeholder="اكتب ملاحظتك هنا..."
                    rows={3}
                    className="w-full text-sm text-foreground bg-background border border-border rounded-xl px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                    data-testid="input-inline-note"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.ctrlKey) handleAddNote(inlineNote, selection.text);
                      if (e.key === "Escape") { setNoteMode(false); setInlineNote(""); }
                    }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">Ctrl+Enter للحفظ</span>
                    <button
                      onClick={() => handleAddNote(inlineNote, selection.text)}
                      disabled={!inlineNote.trim() || createNote.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
                      data-testid="button-save-inline-note"
                    >
                      <PenLine className="w-3 h-3" />
                      حفظ
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Text Content */}
          <div className="max-w-3xl mx-auto">
            <div
              ref={contentRef}
              className="relative text-foreground leading-[2.2] select-text bg-card/40 rounded-2xl px-6 py-6 md:px-10 md:py-8 border border-border/40"
              style={{ fontFamily: currentFont.family, fontSize: `${fontSize}px` }}
              data-testid="chapter-content"
            >
              {renderHighlightedContent()}
            </div>
          </div>

          {/* Chapter navigation — bottom */}
          {sortedChapters.length > 1 && (
            <div className="flex items-stretch justify-between mt-16 mb-8 gap-3">
              <button
                onClick={() => prevChapter && navigate(`/book/${bookIdNum}/chapter/${prevChapter.id}`)}
                disabled={!prevChapter}
                className="flex-1 flex flex-col items-start gap-1 px-5 py-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                data-testid="button-prev-chapter-bottom"
              >
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  الفصل السابق
                </span>
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors text-right">
                  {prevChapter?.titleAr ?? "—"}
                </span>
              </button>

              <Link
                href={`/book/${bookIdNum}`}
                className="flex flex-col items-center justify-center gap-1 px-4 py-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all"
                data-testid="button-back-to-book"
              >
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">الكتاب</span>
              </Link>

              <button
                onClick={() => nextChapter && navigate(`/book/${bookIdNum}/chapter/${nextChapter.id}`)}
                disabled={!nextChapter}
                className="flex-1 flex flex-col items-end gap-1 px-5 py-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                data-testid="button-next-chapter-bottom"
              >
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  الفصل التالي
                  <ChevronLeft className="w-3 h-3" />
                </span>
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors text-left">
                  {nextChapter?.titleAr ?? "—"}
                </span>
              </button>
            </div>
          )}

          {/* Comments Section */}
          <div id="comments" className="mt-8 border-t border-border pt-10">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">التعليقات</h2>
              <span className="text-sm text-muted-foreground">({comments?.length ?? 0})</span>
            </div>

            {/* Add Comment */}
            <div className="bg-card border border-border rounded-xl p-5 mb-6">
              <input
                type="text"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                placeholder="اسمك..."
                className="w-full mb-3 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                data-testid="input-comment-author"
              />
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="أضف تعليقك..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                data-testid="input-new-comment"
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || !commentAuthor.trim() || createComment.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                  data-testid="button-submit-comment"
                >
                  <Send className="w-3.5 h-3.5" />
                  إرسال
                </button>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {comments?.map((comment) => (
                <div key={comment.id} className="bg-card border border-border rounded-xl p-5" data-testid={`comment-${comment.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {comment.authorName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{comment.authorName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        deleteCommentMutation.mutate(
                          { commentId: comment.id },
                          {
                            onSuccess: invalidateComments,
                            onError: () =>
                              toast({ title: "خطأ في الحذف", description: "تعذّر حذف التعليق", variant: "destructive" }),
                          }
                        )
                      }
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      data-testid={`button-delete-comment-${comment.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{comment.content}</p>

                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() =>
                          setExpandedComments((prev) => {
                            const next = new Set(prev);
                            if (next.has(comment.id)) next.delete(comment.id);
                            else next.add(comment.id);
                            return next;
                          })
                        }
                        className="flex items-center gap-1 text-xs text-primary hover:underline mb-2"
                        data-testid={`button-toggle-replies-${comment.id}`}
                      >
                        {expandedComments.has(comment.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {comment.replies.length} رد
                      </button>
                      {expandedComments.has(comment.id) && (
                        <div className="border-r-2 border-primary/20 pr-4 space-y-3 mr-2">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex items-start gap-2" data-testid={`reply-${reply.id}`}>
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs shrink-0">
                                {reply.authorName.charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-foreground">{reply.authorName}</p>
                                <p className="text-xs text-foreground/80 leading-relaxed">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3">
                    {replyTo === comment.id ? (
                      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <input
                          type="text"
                          value={replyAuthor}
                          onChange={(e) => setReplyAuthor(e.target.value)}
                          placeholder="اسمك..."
                          className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                          data-testid={`input-reply-author-${comment.id}`}
                        />
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="ردّك..."
                          rows={2}
                          className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                          data-testid={`input-reply-text-${comment.id}`}
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setReplyTo(null)} className="text-xs text-muted-foreground hover:text-foreground">إلغاء</button>
                          <button
                            onClick={() => handleReply(comment.id)}
                            disabled={!replyText.trim() || !replyAuthor.trim()}
                            className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded hover:opacity-90 disabled:opacity-50"
                            data-testid={`button-submit-reply-${comment.id}`}
                          >
                            رد
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyTo(comment.id)}
                        className="text-xs text-primary hover:underline"
                        data-testid={`button-reply-${comment.id}`}
                      >
                        رد
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Resume reading banner */}
        {showResumeBanner && savedPos && (
          <div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-amber-400/60 rounded-xl shadow-xl px-4 py-3 text-sm"
            dir="rtl"
            data-testid="resume-reading-banner"
          >
            <Bookmark className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
            <span className="text-foreground">
              توقفت عند{" "}
              <span className="font-bold text-amber-600">{Math.round(savedPos.progress)}٪</span>
            </span>
            <button
              onClick={resumeReading}
              className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs hover:bg-amber-600 transition-colors shrink-0"
              data-testid="button-resume-reading"
            >
              استمر من هنا
            </button>
            <button
              onClick={() => setShowResumeBanner(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Back to top */}
        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 left-6 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
            aria-label="العودة إلى الأعلى"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}

        {/* Notes/Highlights Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30" onClick={() => setSidebarOpen(false)} />
        )}
        <aside
          className={`${sidebarOpen ? "translate-x-0" : "translate-x-full"} fixed top-16 right-0 z-40 h-[calc(100vh-4rem)] w-full max-w-[22rem] bg-card border-l border-border flex flex-col overflow-hidden shadow-2xl transition-transform duration-300 ease-in-out`}
          dir="rtl"
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("notes")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === "notes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                data-testid="tab-notes"
              >
                <StickyNote className="w-3.5 h-3.5" />
                ملاحظات
                {(notes?.length ?? 0) > 0 && (
                  <span className={`text-[10px] px-1.5 rounded-full ${activeTab === "notes" ? "bg-white/20" : "bg-muted-foreground/20"}`}>
                    {notes!.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("comments")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === "comments" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                data-testid="tab-highlights"
              >
                <Highlighter className="w-3.5 h-3.5" />
                تظليلات
                {(highlights?.length ?? 0) > 0 && (
                  <span className={`text-[10px] px-1.5 rounded-full ${activeTab === "comments" ? "bg-white/20" : "bg-muted-foreground/20"}`}>
                    {highlights!.length}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              data-testid="button-close-sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Notes Tab ── */}
          {activeTab === "notes" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Add Note */}
              <div className="bg-background rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">ملاحظة عامة على الفصل</p>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="اكتب ملاحظتك هنا..."
                  rows={3}
                  className="w-full text-sm text-foreground bg-transparent placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
                  data-testid="input-new-note"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleAddNote()}
                    disabled={!newNote.trim() || createNote.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
                    data-testid="button-add-note"
                  >
                    <PenLine className="w-3 h-3" />
                    حفظ
                  </button>
                </div>
              </div>

              {notes?.length === 0 && (
                <div className="text-center py-10 space-y-3">
                  <StickyNote className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">لا توجد ملاحظات بعد</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      حدِّد نصاً وانقر "إضافة ملاحظة"
                    </p>
                  </div>
                </div>
              )}

              {notes?.map((note) => (
                <div key={note.id} className="bg-background rounded-xl border border-border p-3 group" data-testid={`note-${note.id}`}>
                  {note.selectedText && (
                    <p className="text-xs text-muted-foreground bg-primary/5 rounded-lg p-2 mb-2.5 line-clamp-2 border-r-2 border-primary/60 pr-2.5 leading-relaxed">
                      "{note.selectedText}"
                    </p>
                  )}
                  {editingNoteId === note.id ? (
                    <div>
                      <textarea
                        value={editingNoteText}
                        onChange={(e) => setEditingNoteText(e.target.value)}
                        rows={3}
                        className="w-full text-sm text-foreground bg-transparent border border-border rounded-lg p-2 focus:outline-none focus:border-primary resize-none"
                        data-testid={`input-edit-note-${note.id}`}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleUpdateNote(note.id)}
                          className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-lg font-medium"
                          data-testid={`button-save-note-${note.id}`}
                        >
                          حفظ
                        </button>
                        <button onClick={() => setEditingNoteId(null)} className="text-xs text-muted-foreground hover:text-foreground">
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-foreground leading-relaxed">{note.content}</p>
                      <div className="flex gap-2 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.content); }}
                          className="text-xs text-primary hover:underline"
                          data-testid={`button-edit-note-${note.id}`}
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-xs text-destructive hover:underline"
                          data-testid={`button-delete-note-${note.id}`}
                        >
                          حذف
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Highlights Tab ── */}
          {activeTab === "comments" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(!highlights || highlights.length === 0) ? (
                <div className="text-center py-10 space-y-3">
                  <Highlighter className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">لا توجد تظليلات بعد</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      حدِّد نصاً واختر لوناً للتظليل
                    </p>
                  </div>
                </div>
              ) : (
                highlights.map((hl) => (
                  <div
                    key={hl.id}
                    className="group bg-background rounded-xl border border-border p-3 flex items-start gap-2.5"
                    data-testid={`highlight-${hl.id}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full mt-1 shrink-0 border border-black/10"
                      style={{ backgroundColor: hl.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm text-foreground leading-relaxed line-clamp-3 px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: hl.color + "66" }}
                      >
                        {hl.selectedText}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {new Date(hl.createdAt).toLocaleDateString("ar-SA")}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        deleteHighlight.mutate(
                          { highlightId: hl.id },
                          {
                            onSuccess: invalidateHighlights,
                            onError: () =>
                              toast({ title: "خطأ في الحذف", description: "تعذّر حذف التظليل", variant: "destructive" }),
                          }
                        )
                      }
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all mt-0.5 shrink-0"
                      title="حذف التظليل"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </aside>
      </div>

      {shareQuote && (
        <QuoteShareModal
          text={shareQuote}
          bookTitle={book?.titleAr ?? "بدائع التفسير"}
          chapterTitle={chapter?.titleAr ?? ""}
          onClose={() => setShareQuote(null)}
        />
      )}
    </div>
  );
}
