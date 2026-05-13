import { Link, useParams } from "wouter";
import { ArrowLeft, BookMarked, ChevronLeft, FileText, Library } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import { ErrorState, LoadingState } from "@/components/editorial/DataState";
import BookCover from "@/components/BookCover";
import { type ChapterSummary, useStaticBook } from "@/lib/static-library";

interface ChapterNode extends ChapterSummary {
  children: ChapterNode[];
}

function buildTree(chapters: ChapterSummary[]): ChapterNode[] {
  const nodeMap = new Map<number, ChapterNode>();
  const roots: ChapterNode[] = [];
  chapters.forEach((chapter) => nodeMap.set(chapter.id, { ...chapter, children: [] }));
  chapters.forEach((chapter) => {
    const node = nodeMap.get(chapter.id)!;
    if (chapter.parentId && nodeMap.has(chapter.parentId)) {
      nodeMap.get(chapter.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export default function BookDetail() {
  const { bookId } = useParams<{ bookId: string }>();
  const id = Number(bookId);
  const { data: book, isLoading, isError, refetch } = useStaticBook(id);

  if (isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  if (isError || !book) {
    return (
      <AppShell>
        <main className="mx-auto max-w-4xl px-5 py-16">
          <ErrorState retry={() => refetch()} title="تعذر تحميل الكتاب" />
        </main>
      </AppShell>
    );
  }

  const tree = buildTree(book.chapters);

  return (
    <AppShell>
      <main className="mx-auto max-w-[90rem] px-5 pb-24 pt-10 md:pb-16">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/library" className="hover:text-foreground">
            المكتبة
          </Link>
          <ChevronLeft className="h-4 w-4 rotate-180" />
          <span className="line-clamp-1 text-foreground">{book.titleAr}</span>
        </div>

        <section className="grid min-w-0 gap-8 border-b border-border pb-10 lg:grid-cols-[18rem_1fr_16rem]">
          <BookCover coverColor={book.coverColor} title={book.titleAr} size="lg" className="mx-auto w-full max-w-72" />
          <div className="self-center">
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Library className="h-4 w-4" />
              {book.category}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight md:text-6xl">{book.titleAr}</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">{book.description}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {book.firstChapterId && (
                <Link
                  href={`/book/${book.id}/chapter/${book.firstChapterId}`}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground"
                >
                  ابدأ القراءة
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
          <aside className="self-end rounded-lg border border-border p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">بيانات الكتاب</p>
            <div className="mt-4 space-y-3">
              <p className="flex items-center justify-between">
                <span>الفصول</span>
                <span className="tabular-nums text-foreground">{book.chapterCount}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>الصفحات</span>
                <span className="tabular-nums text-foreground">{book.pageCount}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>الأجزاء</span>
                <span className="tabular-nums text-foreground">{book.volumes}</span>
              </p>
            </div>
          </aside>
        </section>

        <section className="grid min-w-0 gap-8 pt-10 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0">
            <div className="mb-5 flex items-center gap-2">
              <BookMarked className="h-5 w-5" />
              <h2 className="text-2xl font-semibold">فهرس الكتاب</h2>
            </div>
            <div className="space-y-2">
              {tree.map((node) => (
                <ChapterNodeView bookId={book.id} key={node.id} node={node} />
              ))}
            </div>
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-lg border border-border p-4 text-sm text-muted-foreground">
              <FileText className="mb-3 h-5 w-5 text-foreground" />
              <p className="font-semibold text-foreground">قراءة متصلة</p>
              <p className="mt-2 leading-7">اختر فصلا من الفهرس، وسيحفظ القارئ موضعك وملاحظاتك محليا.</p>
            </div>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}

function ChapterNodeView({ bookId, node }: { bookId: number; node: ChapterNode }) {
  const hasChildren = node.children.length > 0;
  return (
    <div className={`${node.level === 1 ? "border border-border" : "mr-4 border-r border-border"} rounded-lg`}>
      <Link
        href={`/book/${bookId}/chapter/${node.id}`}
        className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
      >
        <span className={`${node.level === 1 ? "font-semibold" : "text-sm"} leading-7`}>{node.titleAr}</span>
        <span className="text-xs text-muted-foreground tabular-nums">ص {node.page}</span>
      </Link>
      {hasChildren && (
        <div className="space-y-1 border-t border-border p-2">
          {node.children.map((child) => (
            <ChapterNodeView bookId={bookId} key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
