import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, BookOpen, FileText, Library, Search } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import BookCover from "@/components/BookCover";
import { ErrorState, LoadingState } from "@/components/editorial/DataState";
import SectionHeader from "@/components/editorial/SectionHeader";
import { useLocalLibrary } from "@/lib/local-library";
import {
  type BookSummary,
  useLibraryManifest,
  useStaticBooks,
  useStaticCategories,
} from "@/lib/static-library";

export default function Home() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const { data: manifest } = useLibraryManifest();
  const { data: books, isLoading, isError, refetch } = useStaticBooks();
  const { data: categories } = useStaticCategories();
  const { positions } = useLocalLibrary();

  const latestPosition = positions[0];
  const allBooks = books ?? [];
  const continueBook = latestPosition
    ? books?.find((book) => book.id === latestPosition.bookId)
    : undefined;
  const progressByBookId = useMemo(() => {
    const progress = new Map<number, number>();
    positions.forEach((position) => {
      if (!progress.has(position.bookId)) progress.set(position.bookId, position.progress);
    });
    return progress;
  }, [positions]);

  const submitSearch = () => {
    const value = query.trim();
    if (value.length > 1) navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[90rem] px-5 pb-24 pt-8 md:pb-16">
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-3xl font-bold md:text-4xl">موروث ابن القيم</h1>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
            className="relative mx-auto mt-8 max-w-xl"
          >
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث في الكتب والفصول"
              className="h-12 w-full rounded-lg border border-border bg-background pr-11 pl-4 text-sm shadow-[0_18px_48px_-42px_rgba(0,0,0,0.85)] focus:border-foreground focus:outline-none"
              type="search"
            />
          </form>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_16rem]">
          <div className="min-w-0 space-y-9">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">تابع القراءة</h2>
              <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                عرض الكل
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>

            {continueBook ? (
              <ContinueReadingCard book={continueBook} latestPosition={latestPosition} />
            ) : (
              <div className="rounded-lg border border-border p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">ابدأ من المكتبة</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      اختر كتابا وابدأ القراءة، وسنحفظ موضعك محليا في هذا المتصفح.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <section>
              <SectionHeader
                title="المكتبة"
                description="كل الكتب المتاحة للقراءة من البيانات الثابتة."
                action={
                  <Link
                    href="/library"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    عرض جميع الكتب
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                }
              />

              {isLoading ? (
                <LoadingState />
              ) : isError ? (
                <ErrorState retry={() => refetch()} title="تعذر تحميل المكتبة" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {allBooks.map((book) => (
                    <LibraryBookCard book={book} key={book.id} progress={progressByBookId.get(book.id)} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-lg border border-border p-3">
              <Link
                href="/library"
                className="flex items-center justify-between rounded-md bg-muted px-3 py-3 text-sm text-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  كل الكتب
                </span>
                <span className="tabular-nums">{manifest?.booksCount ?? ""}</span>
              </Link>
              <div className="my-3 h-px bg-border" />
              <div className="space-y-1">
                {categories?.map((category) => (
                  <Link
                    key={category.name}
                    href={`/library?category=${encodeURIComponent(category.name)}`}
                    className="flex items-center justify-between rounded-md px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Library className="h-4 w-4" />
                      {category.name}
                    </span>
                    <span className="tabular-nums">{category.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </AppShell>
  );
}

function ContinueReadingCard({
  book,
  latestPosition,
}: {
  book: BookSummary;
  latestPosition?: ReturnType<typeof useLocalLibrary>["positions"][number];
}) {
  const href = latestPosition
    ? `/book/${latestPosition.bookId}/chapter/${latestPosition.chapterId}`
    : `/book/${book.id}`;
  const progress = latestPosition?.progress;

  return (
    <Link
      href={href}
      className="grid gap-5 rounded-lg border border-border p-4 transition-colors hover:border-foreground sm:grid-cols-[1fr_auto]"
    >
      <div className="flex min-w-0 flex-col justify-between gap-6">
        <div>
          <p className="text-sm font-semibold">{book.titleAr}</p>
          <p className="mt-1 text-xs text-muted-foreground">الإمام ابن قيم الجوزية</p>
          <p className="mt-5 text-sm text-muted-foreground">
            {latestPosition?.chapterTitle ?? "ابدأ القراءة من أول فصل"}
          </p>
        </div>
        <div>
          {typeof progress === "number" && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border">
                <div className="h-px bg-foreground" style={{ width: `${Math.round(progress)}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{Math.round(progress)}%</span>
            </div>
          )}
          <span className="mt-3 inline-flex h-9 items-center rounded-md border border-border px-3 text-sm">
            مواصلة القراءة
          </span>
        </div>
      </div>
      <BookCover
        coverColor={book.coverColor}
        coverImageAlt={book.coverImageAlt}
        coverImageUrl={book.coverImageUrl}
        editionLabel={book.editionLabel}
        publisher={book.publisher}
        title={book.titleAr}
        size="md"
        className="mx-auto w-32 sm:w-36"
      />
    </Link>
  );
}

function LibraryBookCard({ book, progress }: { book: BookSummary; progress?: number }) {
  const roundedProgress = typeof progress === "number" ? Math.round(progress) : null;

  return (
    <Link
      href={`/book/${book.id}`}
      className="group rounded-lg border border-border p-4 transition-colors hover:border-foreground"
    >
      <BookCover
        coverColor={book.coverColor}
        coverImageAlt={book.coverImageAlt}
        coverImageUrl={book.coverImageUrl}
        editionLabel={book.editionLabel}
        publisher={book.publisher}
        title={book.titleAr}
        size="md"
        className="mx-auto w-28"
      />
      <div className="mt-4 text-center">
        <h3 className="line-clamp-2 text-base font-semibold leading-7">{book.titleAr}</h3>
        <p className="mt-1 text-xs text-muted-foreground">الإمام ابن قيم الجوزية</p>
      </div>
      {roundedProgress !== null && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">{roundedProgress}%</span>
          <div className="h-px flex-1 bg-border">
            <div className="h-px bg-foreground" style={{ width: `${roundedProgress}%` }} />
          </div>
        </div>
      )}
    </Link>
  );
}
