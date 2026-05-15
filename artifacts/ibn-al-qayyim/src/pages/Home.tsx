import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, BookOpen, Search } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import BookCover from "@/components/BookCover";
import { EmptyState, ErrorState, LoadingState } from "@/components/editorial/DataState";
import PageFrame from "@/components/editorial/PageFrame";
import ProgressLine from "@/components/editorial/ProgressLine";
import SectionHeader from "@/components/editorial/SectionHeader";
import { useLocalLibrary } from "@/lib/local-library";
import {
  type BookSummary,
  type WorkSummary,
  useStaticBooks,
  useStaticWorks,
} from "@/lib/static-library";
import { editionCountText, useUiTranslations } from "@/lib/ui-translations";

export default function Home() {
  const { direction, t } = useUiTranslations();
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const { data: works, isLoading, isError, refetch } = useStaticWorks();
  const { data: books } = useStaticBooks();
  const { positions } = useLocalLibrary();

  const latestPosition = positions[0];
  const allWorks = works ?? [];
  const continueBook = latestPosition
    ? books?.find((book) => book.id === latestPosition.bookId)
    : undefined;
  const progressByBookId = useMemo(() => {
    const progress = new Map<number, number>();
    positions.forEach((position) => {
      const key = position.workId ?? position.bookId;
      if (!progress.has(key)) progress.set(key, position.progress);
    });
    return progress;
  }, [positions]);

  const submitSearch = () => {
    const value = query.trim();
    if (value.length > 1) navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <AppShell>
      <PageFrame>
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">{t("موروث ابن القيم")}</h1>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
            data-tour="home-search"
            className="mx-auto mt-8 grid max-w-2xl gap-2 rounded-xl border border-border bg-background p-2 shadow-[0_24px_58px_-46px_rgba(0,0,0,0.9)] sm:grid-cols-[1fr_auto]"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("ابحث في الكتب والفصول")}
                className="h-12 w-full rounded-lg bg-transparent ps-11 pe-4 text-sm transition-colors focus:outline-none"
                dir={direction}
                type="search"
              />
            </div>
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              disabled={query.trim().length < 2}
              type="submit"
            >
              <Search className="h-4 w-4" />
              {t("بحث")}
            </button>
          </form>
        </section>

        <section className="mt-12">
          <div className="min-w-0 space-y-9">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">{t("تابع القراءة")}</h2>
              <Link href="/notes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                {t("عرض الكل")}
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
                    <p className="text-sm font-semibold">{t("ابدأ من المكتبة")}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t("اختر كتابا وابدأ القراءة، وسنحفظ موضعك محليا في هذا المتصفح.")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <section>
              <SectionHeader
                title={t("المكتبة")}
                description={t("كتب ابن القيم المتاحة للقراءة من البيانات المحلية.")}
                action={
                  <Link
                    href="/library"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("عرض جميع الكتب")}
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                }
              />

              {isLoading ? (
                <LoadingState />
              ) : isError ? (
                <ErrorState retry={() => refetch()} title="تعذر تحميل المكتبة" />
              ) : allWorks.length === 0 ? (
                <EmptyState title="لا توجد كتب لهذه اللغة" description="اختر لغة أخرى من القائمة لعرض الكتب المتاحة لها." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {allWorks.map((work) => (
                    <LibraryBookCard work={work} key={work.id} progress={progressByBookId.get(work.id)} />
                  ))}
                </div>
              )}
            </section>
          </div>

        </section>
      </PageFrame>
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
  const { t } = useUiTranslations();
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
          <p className="mt-1 text-xs text-muted-foreground">{t("الإمام ابن قيم الجوزية")}</p>
          <p className="mt-5 text-sm text-muted-foreground">
            {latestPosition?.chapterTitle ?? t("ابدأ القراءة من أول فصل")}
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
            {t("مواصلة القراءة")}
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

function LibraryBookCard({ work, progress }: { work: WorkSummary; progress?: number }) {
  const { language } = useUiTranslations();
  const roundedProgress = typeof progress === "number" ? Math.round(progress) : null;

  return (
    <Link
      href={`/work/${work.id}`}
      className="interactive-card group p-4"
    >
      <BookCover
        coverColor={work.coverColor}
        coverImageAlt={work.coverImageAlt}
        coverImageUrl={work.coverImageUrl}
        title={work.titleAr}
        size="md"
        className="mx-auto w-28"
      />
      <div className="mt-4 text-center">
        <h3 className="line-clamp-2 text-base font-semibold leading-7">{work.titleAr}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {editionCountText(work.editionCount, language)}
        </p>
      </div>
      {roundedProgress !== null && (
        <ProgressLine className="mt-4" value={roundedProgress} />
      )}
    </Link>
  );
}
