import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, ImageDown, Quote, Search } from "lucide-react";
import AppShell from "@/components/editorial/AppShell";
import BookCover from "@/components/BookCover";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/editorial/DataState";
import { DirectionalArrow } from "@/components/editorial/DirectionalIcon";
import PageFrame from "@/components/editorial/PageFrame";
import ProgressLine from "@/components/editorial/ProgressLine";
import SectionHeader from "@/components/editorial/SectionHeader";
import QuoteShareModal from "@/components/QuoteShareModal";
import {
  FEATURED_READING_EDITION_ID,
  FEATURED_READING_WORK_ID,
  prioritizeFeaturedWork,
} from "@/lib/featured-reading";
import { getDailyQuote } from "@/lib/daily-quote";
import { useLocalLibrary } from "@/lib/local-library";
import {
  type BookSummary,
  type WorkSummary,
  useStaticBooks,
  useStaticWorks,
} from "@/lib/static-library";
import {
  editionCountText,
  pageText,
  useUiTranslations,
} from "@/lib/ui-translations";

export default function Home() {
  const { direction, language, t } = useUiTranslations();
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const { data: works, isLoading, isError, refetch } = useStaticWorks();
  const { data: books } = useStaticBooks();
  const { positions } = useLocalLibrary();
  const dailyQuote = useMemo(() => getDailyQuote(), []);
  const [showDailyQuoteShare, setShowDailyQuoteShare] = useState(false);

  const latestPosition = positions[0];
  const allWorks = useMemo(() => prioritizeFeaturedWork(works ?? []), [works]);
  const visibleWorks = useMemo(() => allWorks.slice(0, 4), [allWorks]);
  const continueBook = latestPosition
    ? books?.find((book) => book.id === latestPosition.bookId)
    : undefined;
  const featuredBook =
    books?.find((book) => book.id === FEATURED_READING_EDITION_ID) ??
    books?.find((book) => book.workId === FEATURED_READING_WORK_ID);
  const readingCardBook = continueBook ?? featuredBook;
  const dailyQuotePage = dailyQuote.sourcePageNumber ?? dailyQuote.pageNumber;
  const dailyQuoteHref =
    dailyQuote.href ??
    (dailyQuote.editionId && dailyQuote.sectionId != null
      ? `/edition/${dailyQuote.editionId}/section/${dailyQuote.sectionId}${
          dailyQuote.pageNumber != null ? `#page-${dailyQuote.pageNumber}` : ""
        }`
      : dailyQuote.editionId
        ? `/edition/${dailyQuote.editionId}`
        : undefined);
  const readingActionHref = continueBook
    ? "/saved"
    : featuredBook
      ? `/work/${FEATURED_READING_WORK_ID}`
      : "/library";
  const readingActionLabel = continueBook
    ? "عرض الكل"
    : featuredBook
      ? "الطبعات المتاحة"
      : "عرض جميع الكتب";
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
      <PageFrame maxWidth="max-w-6xl">
        <section className="mx-auto max-w-2xl pt-2 text-center md:pt-6">
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl md:text-[2.75rem]">
            {t("موروث ابن القيم")}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
            {t("\u0645\u0643\u062a\u0628\u0629 \u0631\u0642\u0645\u064a\u0629 \u0644\u0642\u0631\u0627\u0621\u0629 \u0643\u062a\u0628 \u0627\u0628\u0646 \u0627\u0644\u0642\u064a\u0645 \u0648\u0627\u0644\u0628\u062d\u062b \u0641\u064a\u0647\u0627.")}
          </p>
          <p className="sr-only">
            {t(
              "مكتبة رقمية لكتب الإمام ابن قيم الجوزية تجمع الأعمال والطبعات والفهارس والبحث والحفظ المحلي والاقتباسات في تجربة قراءة واحدة.",
            )}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
            data-tour="home-search"
            className="mx-auto mt-5 flex max-w-xl items-center gap-2 rounded-full border border-border/70 bg-muted/35 p-1.5 transition-colors focus-within:border-foreground/25 focus-within:bg-muted/50 sm:mt-6"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("ابحث في الكتب والفصول")}
                className="h-11 w-full rounded-full bg-transparent ps-11 pe-4 text-sm transition-colors placeholder:text-muted-foreground/75 focus:outline-none"
                dir={direction}
                type="search"
              />
            </div>
            <button
              aria-label="بحث"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-[0px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-35"
              disabled={query.trim().length < 2}
              title={t("\u0628\u062d\u062b")}
              type="submit"
            >
              <Search className="h-4 w-4" />
              {t("بحث")}
            </button>
          </form>
        </section>

        {/* Daily quote */}
        <section className="mx-auto mt-6 max-w-2xl md:mt-10">
          <blockquote className="rounded-lg border border-border/50 bg-background/50 p-3.5 sm:p-5">
            <div className="relative">
              <Quote className="mb-2 h-3.5 w-3.5 text-muted-foreground/40 sm:mb-3 sm:h-4 sm:w-4" aria-hidden="true" />
              <p className="line-clamp-2 font-display text-sm leading-7 text-foreground sm:text-base sm:leading-9 md:line-clamp-3" dir="rtl">
                {dailyQuote.text}
              </p>
              <footer className="mt-3 flex items-center justify-between gap-3 sm:mt-4">
                <cite className="min-w-0 truncate text-xs font-semibold not-italic text-muted-foreground">
                  {t("الإمام ابن قيم الجوزية")} —{" "}
                  {dailyQuoteHref ? (
                    <Link
                      href={dailyQuoteHref}
                      className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      {dailyQuote.source}
                      {dailyQuotePage != null
                        ? ` / ${pageText(dailyQuotePage, language)}`
                        : ""}
                    </Link>
                  ) : (
                    dailyQuote.source
                  )}
                </cite>
                <button
                  type="button"
                  onClick={() => setShowDailyQuoteShare(true)}
                  className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted hover:text-foreground sm:w-auto sm:gap-1.5 sm:px-3"
                  title={t("مشاركة أو تحميل كصورة")}
                  aria-label={t("مشاركة أو تحميل كصورة")}
                >
                  <ImageDown className="h-4 w-4" />
                  <span className="hidden text-[0.65rem] font-semibold sm:inline">{t("اقتباس اليوم")}</span>
                </button>
              </footer>
            </div>
          </blockquote>
        </section>


        <section className="mt-7 md:mt-10">
          <div className="min-w-0 space-y-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {continueBook ? t("تابع القراءة") : t("ابدأ القراءة")}
              </h2>
            </div>

            {readingCardBook ? (
              <ContinueReadingCard
                book={readingCardBook}
                latestPosition={continueBook ? latestPosition : undefined}
              />
            ) : (
              <div className="surface-card p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="line-clamp-2 text-sm font-semibold leading-6">
                      {t("ابدأ من المكتبة")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t(
                        "اختر كتابا وابدأ القراءة، وسنحفظ موضعك محليا في هذا المتصفح.",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <section>
              <SectionHeader
                title={t("المكتبة")}
                action={
                  <Link
                    href="/library"
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {t("عرض جميع الكتب")}
                    <DirectionalArrow className="h-4 w-4" />
                  </Link>
                }
              />

              {isLoading ? (
                <LoadingState />
              ) : isError ? (
                <ErrorState
                  retry={() => refetch()}
                  title="تعذر تحميل المكتبة"
                />
              ) : allWorks.length === 0 ? (
                <EmptyState
                  title="لا توجد كتب لهذه اللغة"
                  description="اختر لغة أخرى من القائمة لعرض الكتب المتاحة لها."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {visibleWorks.map((work) => (
                    <LibraryBookCard
                      work={work}
                      key={work.id}
                      progress={progressByBookId.get(work.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </PageFrame>
      {showDailyQuoteShare && (
        <QuoteShareModal
          text={dailyQuote.text}
          bookTitle={dailyQuote.source}
          chapterTitle={
            dailyQuotePage != null
              ? pageText(dailyQuotePage, language)
              : t("اقتباس اليوم")
          }
          onClose={() => setShowDailyQuoteShare(false)}
        />
      )}
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
    : `/edition/${book.id}/section/${book.firstChapterId}`;
  const progress = latestPosition?.progress;

  return (
    <Link
      href={href}
      className="interactive-card grid grid-cols-[1fr_auto] items-center gap-3 p-3 sm:gap-4 sm:p-4"
    >
      <div className="flex min-w-0 flex-col justify-between gap-3">
        <div>
          <p className="line-clamp-3 text-base font-semibold leading-7 sm:text-lg sm:leading-8">{book.titleAr}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("الإمام ابن قيم الجوزية")}
          </p>
          <p className="mt-2 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
            {latestPosition?.chapterTitle ??
              book.editionLabel ??
              book.publisher ??
              t("ابدأ القراءة من أول فصل")}
          </p>
        </div>
        <div>
          {typeof progress === "number" && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border">
                <div
                  className="h-px bg-foreground"
                  style={{ width: `${Math.round(progress)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>
          )}
          <span className="mt-2 inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-semibold sm:px-3 sm:text-sm">
            {latestPosition ? t("مواصلة القراءة") : t("ابدأ القراءة")}
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
        className="!h-20 !w-14 sm:!h-28 sm:!w-20"
      />
    </Link>
  );
}

function LibraryBookCard({
  work,
  progress,
}: {
  work: WorkSummary;
  progress?: number;
}) {
  const { language } = useUiTranslations();
  const roundedProgress =
    typeof progress === "number" ? Math.round(progress) : null;

  return (
    <Link
      href={`/work/${work.id}`}
      className="interactive-card group grid h-full grid-cols-[auto_1fr] items-center gap-3 p-3 sm:min-h-[9rem] sm:gap-4 sm:p-4"
    >
      <BookCover
        coverColor={work.coverColor}
        coverImageAlt={work.coverImageAlt}
        coverImageUrl={work.coverImageUrl}
        title={work.titleAr}
        size="md"
        className="!h-24 !w-16 sm:!h-32 sm:!w-[5.5rem]"
      />
      <div className="flex min-w-0 flex-1 flex-col text-start">
        <h3 className="line-clamp-3 text-base font-semibold leading-7 sm:text-lg sm:leading-8">
          {work.titleAr}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {editionCountText(work.editionCount, language)}
        </p>
        {roundedProgress !== null && (
          <ProgressLine className="mt-3" value={roundedProgress} />
        )}
      </div>
    </Link>
  );
}
