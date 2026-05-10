import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetBook, useListChapters } from "@/lib/api";
import type { Chapter } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { ChevronLeft, ChevronDown, ChevronUp, BookOpen, List, BookMarked } from "lucide-react";

// ─── Hierarchy helpers ────────────────────────────────────────────────────────

interface ChapterNode extends Chapter {
  children: ChapterNode[];
}

function buildTree(chapters: Chapter[]): ChapterNode[] {
  const sorted = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);

  // If all chapters are level 1 (flat/legacy data), return them as-is at root
  const hasHierarchy = sorted.some((c) => c.level > 1);
  if (!hasHierarchy) {
    return sorted.map((c) => ({ ...c, children: [] }));
  }

  const nodeMap = new Map<number, ChapterNode>();
  sorted.forEach((c) => nodeMap.set(c.id, { ...c, children: [] }));

  const roots: ChapterNode[] = [];
  sorted.forEach((c) => {
    const node = nodeMap.get(c.id)!;
    if (c.parentId && nodeMap.has(c.parentId)) {
      nodeMap.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FaslRow({ chapter, bookId }: { chapter: ChapterNode; bookId: number }) {
  return (
    <Link
      href={`/book/${bookId}/chapter/${chapter.id}`}
      className="flex items-center justify-between px-4 py-3 rounded-lg border border-border/60 bg-card hover:border-primary hover:bg-primary/5 transition-all group"
    >
      <div className="flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary shrink-0 transition-colors" />
        <span className="text-sm text-foreground group-hover:text-primary transition-colors">
          {chapter.titleAr}
        </span>
      </div>
      <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary rotate-180 shrink-0 transition-colors" />
    </Link>
  );
}

function BabRow({ node, bookId, index }: { node: ChapterNode; bookId: number; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const hasFasls = node.children.length > 0;
  const isFaslItself = node.level >= 2;

  // A level-2+ node with no children is itself a clickable فصل
  if (isFaslItself && !hasFasls) {
    return <FaslRow chapter={node} bookId={bookId} />;
  }

  // Top-level باب that is itself readable (no children) — direct link
  if (!hasFasls) {
    return (
      <Link
        href={`/book/${bookId}/chapter/${node.id}`}
        className="flex items-center justify-between px-5 py-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all group"
      >
        <div className="flex items-center gap-4">
          <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <span className="font-medium text-foreground group-hover:text-primary transition-colors">
            {node.titleAr}
          </span>
        </div>
        <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary rotate-180 transition-colors" />
      </Link>
    );
  }

  // باب with فصول — collapsible section
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/50 transition-colors text-right"
      >
        <div className="flex items-center gap-4">
          <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <div>
            <p className="font-semibold text-foreground">{node.titleAr}</p>
            {node.title && (
              <p className="text-xs text-muted-foreground">{node.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {node.children.length} فصل
          </span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
          {node.children.map((child) => (
            <FaslRow key={child.id} chapter={child} bookId={bookId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookDetail() {
  const { bookId } = useParams<{ bookId: string }>();
  const id = parseInt(bookId);

  const { data: book, isLoading: loadingBook } = useGetBook(id, {
    query: { enabled: !!id },
  });
  const { data: chapters, isLoading: loadingChapters } = useListChapters(id, {
    query: { enabled: !!id },
  });

  if (loadingBook) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4" />
          <div className="h-48 bg-muted rounded mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground text-lg">الكتاب غير موجود</p>
          <Link href="/library" className="text-primary hover:underline mt-4 inline-block">
            العودة إلى المكتبة
          </Link>
        </div>
      </div>
    );
  }

  const tree = chapters ? buildTree(chapters) : [];
  const totalFasls = chapters?.filter((c) => !chapters.some((p) => p.parentId === c.id)).length ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/library" className="hover:text-primary transition-colors">المكتبة</Link>
          <ChevronLeft className="w-4 h-4 rotate-180" />
          <span className="text-foreground">{book.titleAr}</span>
        </div>

        {/* Book Header */}
        <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm mb-8">
          <div
            className="h-40 flex items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: book.coverColor }}
          >
            <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice">
              <defs>
                <pattern id="pat-detail" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <polygon points="12,1 23,6.5 23,17.5 12,23 1,17.5 1,6.5" fill="none" stroke="white" strokeWidth="0.7"/>
                  <circle cx="12" cy="12" r="2.5" fill="none" stroke="white" strokeWidth="0.5"/>
                  <line x1="12" y1="1" x2="12" y2="5" stroke="white" strokeWidth="0.4"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="0.4"/>
                </pattern>
              </defs>
              <rect width="200" height="160" fill="url(#pat-detail)"/>
            </svg>
            <BookOpen className="w-16 h-16 text-white/50 relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full mb-3 inline-block">
                  {book.category}
                </span>
                <h1 className="text-3xl font-bold text-foreground mb-1">{book.titleAr}</h1>
                <p className="text-sm text-muted-foreground">{book.title}</p>
              </div>
              <div className="flex gap-3">
                <div className="text-center bg-muted rounded-xl p-4 min-w-[70px]">
                  <p className="text-2xl font-bold text-primary">{tree.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">باب</p>
                </div>
                <div className="text-center bg-muted rounded-xl p-4 min-w-[70px]">
                  <p className="text-2xl font-bold text-primary">{totalFasls}</p>
                  <p className="text-xs text-muted-foreground mt-1">فصل</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-muted-foreground leading-relaxed">{book.description}</p>
          </div>
        </div>

        {/* Table of Contents */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BookMarked className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">فهرس الكتاب</h2>
          </div>

          {loadingChapters ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : tree.length > 0 ? (
            <div className="space-y-2">
              {tree.map((node, idx) => (
                <BabRow key={node.id} node={node} bookId={id} index={idx} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">لا توجد فصول متاحة بعد</p>
          )}
        </div>
      </div>
    </div>
  );
}
