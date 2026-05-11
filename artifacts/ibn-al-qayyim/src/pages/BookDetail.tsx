import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetBook, useListChapters } from "@/lib/api";
import type { Chapter } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { AlertTriangle, ChevronLeft, ChevronDown, ChevronUp, BookOpen, BookMarked } from "lucide-react";

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

function TreeNode({
  node,
  bookId,
  depth = 0,
  index,
}: {
  node: ChapterNode;
  bookId: number;
  depth?: number;
  index?: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isLeaf = node.children.length === 0;
  const isRoot = depth === 0;

  if (isLeaf) {
    return (
      <Link
        href={`/book/${bookId}/chapter/${node.id}`}
        className={`flex items-center justify-between px-4 py-3 rounded-lg border border-border/60 bg-card hover:border-primary hover:bg-primary/5 transition-all group${depth > 0 ? " mr-4" : ""}`}
      >
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary shrink-0 transition-colors" />
          <span className="text-sm text-foreground group-hover:text-primary transition-colors">
            {node.titleAr}
          </span>
        </div>
        <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary rotate-180 shrink-0 transition-colors" />
      </Link>
    );
  }

  return (
    <div
      className={
        isRoot
          ? "rounded-xl border border-border overflow-hidden"
          : "rounded-lg border border-border/60 overflow-hidden mr-4"
      }
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/50 transition-colors text-right"
      >
        <div className="flex items-center gap-4">
          {isRoot && index !== undefined && (
            <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">
              {index + 1}
            </span>
          )}
          <span className={isRoot ? "font-semibold text-foreground" : "text-sm font-medium text-foreground"}>
            {node.titleAr}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-border bg-muted/20 px-3 py-3 space-y-2">
          {node.children.map((child, i) => (
            <TreeNode key={child.id} node={child} bookId={bookId} depth={depth + 1} index={i} />
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

  const { data: book, isLoading: loadingBook, isError: bookError } = useGetBook(id, {
    query: { enabled: !!id },
  });
  const { data: chapters, isLoading: loadingChapters, isError: chaptersError } = useListChapters(id, {
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

  if (bookError) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <p className="text-foreground font-semibold text-lg mb-1">تعذّر تحميل الكتاب</p>
          <p className="text-muted-foreground text-sm mb-6">تحقق من اتصالك بالإنترنت وحاول مجدداً.</p>
          <Link href="/library" className="inline-flex px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            العودة إلى المكتبة
          </Link>
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

          {chaptersError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <p className="text-sm font-medium text-foreground">تعذّر تحميل الفهرس</p>
              <p className="text-xs">تحقق من اتصالك وحاول تحديث الصفحة.</p>
            </div>
          ) : loadingChapters ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : tree.length > 0 ? (
            <div className="space-y-2">
              {tree.map((node, idx) => (
                <TreeNode key={node.id} node={node} bookId={id} depth={0} index={idx} />
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
