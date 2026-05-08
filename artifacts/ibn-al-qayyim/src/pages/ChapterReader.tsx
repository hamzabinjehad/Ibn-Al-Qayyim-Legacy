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
} from "lucide-react";

const HIGHLIGHT_COLORS = [
  { value: "#FEF08A", label: "أصفر" },
  { value: "#BBF7D0", label: "أخضر" },
  { value: "#BFDBFE", label: "أزرق" },
  { value: "#FBCFE8", label: "وردي" },
];

interface SelectionState {
  text: string;
  startOffset: number;
  endOffset: number;
  x: number;
  y: number;
  yBottom: number;
}

type Tab = "notes" | "comments";

export default function ChapterReader() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const [, navigate] = useLocation();
  const bookIdNum = parseInt(bookId);
  const chapterIdNum = parseInt(chapterId);
  const sessionId = getSessionId();
  const queryClient = useQueryClient();

  const [selection, setSelection] = useState<SelectionState | null>(null);
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
  const contentRef = useRef<HTMLDivElement>(null);
  const inlineNoteRef = useRef<HTMLTextAreaElement>(null);

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
    const startOffset = preSelectionRange.toString().length;
    const endOffset = startOffset + text.length;

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
      setScrollProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0);
      setShowBackToTop(scrollTop > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [selection]);

  useEffect(() => {
    if (noteMode && inlineNoteRef.current) {
      setTimeout(() => inlineNoteRef.current?.focus(), 50);
    }
  }, [noteMode]);

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
      }
    );
  };

  const handleDeleteNote = (noteId: number) => {
    deleteNote.mutate({ noteId }, { onSuccess: invalidateNotes });
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
      }
    );
  };

  const renderHighlightedContent = () => {
    if (!chapter?.content) return null;
    if (!highlights || highlights.length === 0) {
      return <div className="whitespace-pre-wrap leading-relaxed text-xl">{chapter.content}</div>;
    }

    const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
    const segments: { text: string; highlight?: (typeof highlights)[0] }[] = [];
    let cursor = 0;
    const content = chapter.content;

    for (const hl of sorted) {
      if (hl.startOffset > cursor) {
        segments.push({ text: content.slice(cursor, hl.startOffset) });
      }
      if (hl.endOffset > hl.startOffset) {
        segments.push({ text: content.slice(hl.startOffset, hl.endOffset), highlight: hl });
        cursor = hl.endOffset;
      }
    }
    if (cursor < content.length) {
      segments.push({ text: content.slice(cursor) });
    }

    return (
      <div className="whitespace-pre-wrap leading-relaxed text-xl">
        {segments.map((seg, i) =>
          seg.highlight ? (
            <mark
              key={i}
              style={{ backgroundColor: seg.highlight.color }}
              className="rounded px-0.5 cursor-pointer"
              title="انقر لحذف التظليل"
              onClick={() =>
                deleteHighlight.mutate({ highlightId: seg.highlight!.id }, { onSuccess: invalidateHighlights })
              }
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
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
      <div className="fixed top-14 left-0 right-0 z-40 h-1 bg-border">
        <div
          className="h-full bg-primary transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
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
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
              data-testid="button-toggle-sidebar"
            >
              <PenLine className="w-4 h-4" />
              الملاحظات ({notes?.length ?? 0})
            </button>
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
              className="fixed z-50 bg-card border border-border rounded-xl shadow-xl p-3 flex flex-col gap-2"
              style={(() => {
                const toolbarH = noteMode ? 240 : 130;
                const clampedX = Math.min(Math.max(selection.x, 140), window.innerWidth - 140);
                const showAbove = selection.y > toolbarH + 20;
                return {
                  left: `${clampedX}px`,
                  top: showAbove
                    ? `${selection.y - toolbarH - 8}px`
                    : `${selection.yBottom + 8}px`,
                  transform: "translateX(-50%)",
                  minWidth: "240px",
                  maxWidth: "300px",
                };
              })()}
            >
              {!noteMode ? (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground font-medium">لون التظليل</span>
                    <button onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => handleHighlight(c.value)}
                        className="w-7 h-7 rounded-full border-2 border-transparent hover:border-foreground/30 transition-all hover:scale-110"
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                        data-testid={`button-highlight-${c.label}`}
                      />
                    ))}
                  </div>
                  <div className="border-t border-border pt-2">
                    <button
                      onClick={() => setNoteMode(true)}
                      className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 w-full font-medium"
                      data-testid="button-add-note-from-selection"
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      إضافة ملاحظة على هذا النص
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-primary font-medium flex items-center gap-1">
                      <StickyNote className="w-3 h-3" />
                      ملاحظة على النص
                    </span>
                    <button onClick={() => { setNoteMode(false); setInlineNote(""); }} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Selected text preview */}
                  <div className="text-xs text-muted-foreground bg-muted rounded-lg px-2 py-1.5 border-r-2 border-primary/40 line-clamp-2 leading-relaxed">
                    {selection.text}
                  </div>
                  <textarea
                    ref={inlineNoteRef}
                    value={inlineNote}
                    onChange={(e) => setInlineNote(e.target.value)}
                    placeholder="اكتب ملاحظتك هنا..."
                    rows={3}
                    className="w-full text-sm text-foreground bg-background border border-border rounded-lg px-2 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
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
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                      data-testid="button-save-inline-note"
                    >
                      <PenLine className="w-3 h-3" />
                      حفظ الملاحظة
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Text Content */}
          <div
            ref={contentRef}
            className="relative prose prose-lg max-w-none text-foreground leading-loose select-text"
            style={{ fontFamily: "'Amiri', 'Noto Naskh Arabic', serif" }}
            data-testid="chapter-content"
          >
            {renderHighlightedContent()}
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
                      onClick={() => deleteCommentMutation.mutate({ commentId: comment.id }, { onSuccess: invalidateComments })}
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

        {/* Notes Drawer — overlay on all screen sizes */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />
        )}
        <aside
          className={`${sidebarOpen ? "translate-x-0" : "translate-x-full"} fixed top-14 right-0 z-40 h-[calc(100vh-3.5rem)] w-80 bg-card border-r border-border flex flex-col overflow-hidden shadow-2xl transition-transform duration-300`}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("notes")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === "notes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                data-testid="tab-notes"
              >
                <PenLine className="w-3.5 h-3.5" />
                ملاحظات ({notes?.length ?? 0})
              </button>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-close-sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Add Note */}
            <div className="bg-background rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground mb-2">أو اكتب ملاحظة عامة على الفصل:</p>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="أضف ملاحظة..."
                rows={3}
                className="w-full text-sm text-foreground bg-transparent placeholder:text-muted-foreground focus:outline-none resize-none"
                data-testid="input-new-note"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => handleAddNote()}
                  disabled={!newNote.trim() || createNote.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                  data-testid="button-add-note"
                >
                  <PenLine className="w-3 h-3" />
                  حفظ
                </button>
              </div>
            </div>

            {notes?.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <StickyNote className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">
                  حدِّد نصاً في الكتاب وانقر "إضافة ملاحظة" لربطها بمقطع معين
                </p>
              </div>
            )}

            {notes?.map((note) => (
              <div key={note.id} className="bg-background rounded-xl border border-border p-3" data-testid={`note-${note.id}`}>
                {note.selectedText && (
                  <p className="text-xs text-muted-foreground bg-primary/5 rounded-lg p-2 mb-2 line-clamp-2 border-r-2 border-primary/50 pr-2 leading-relaxed">
                    "{note.selectedText}"
                  </p>
                )}
                {editingNoteId === note.id ? (
                  <div>
                    <textarea
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      rows={3}
                      className="w-full text-sm text-foreground bg-transparent border border-border rounded p-2 focus:outline-none focus:border-primary resize-none"
                      data-testid={`input-edit-note-${note.id}`}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleUpdateNote(note.id)}
                        className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded"
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
                    <div className="flex gap-2 mt-2">
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
        </aside>
      </div>
    </div>
  );
}
