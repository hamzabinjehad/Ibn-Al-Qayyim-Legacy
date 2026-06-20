import { Link } from "wouter";
import { Bookmark } from "lucide-react";
import type { BookSummary, EditionSummary, WorkSummary } from "@/lib/static-library";
import BookCover from "@/components/BookCover";
import { DirectionalArrow } from "./DirectionalIcon";
import ProgressLine from "./ProgressLine";
import { editionCountText, formatNumber, useUiTranslations } from "@/lib/ui-translations";

export function WorkCard({ work, progress }: { work: WorkSummary; progress?: number }) {
  const { language, t } = useUiTranslations();
  const roundedProgress = typeof progress === "number" ? Math.round(progress) : null;
  return (
    <Link
      href={`/work/${work.id}`}
      className="interactive-card group flex h-full min-h-[17.5rem] flex-col p-3.5 sm:min-h-[22rem] sm:p-5"
    >
      <BookCover
        coverColor={work.coverColor}
        coverImageAlt={work.coverImageAlt}
        coverImageUrl={work.coverImageUrl}
        title={work.titleAr}
        size="md"
        className="mx-auto !h-36 !w-24 sm:!h-52 sm:!w-36"
      />
      <div className="mt-4 flex flex-1 flex-col text-center">
        <h3 className="line-clamp-2 text-base font-semibold leading-7">
          {work.titleAr}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {editionCountText(work.editionCount, language)}
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground sm:mt-3">{work.description}</p>
        {work.pageCount > 0 && (
          <p className="mt-2 text-xs text-muted-foreground/70">
            {formatNumber(work.pageCount, language)} {t("صفحة")}
          </p>
        )}
      </div>
      {roundedProgress !== null && (
        <ProgressLine className="mt-4" value={roundedProgress} />
      )}
    </Link>
  );
}

export function WorkRow({ work }: { work: WorkSummary }) {
  const { language, t } = useUiTranslations();

  return (
    <Link
      href={`/work/${work.id}`}
      className="interactive-card grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3 p-3.5 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4"
    >
      <BookCover
        coverColor={work.coverColor}
        coverImageAlt={work.coverImageAlt}
        coverImageUrl={work.coverImageUrl}
        title={work.titleAr}
        size="sm"
        className="!h-28 !w-20 sm:!h-[8.5rem] sm:!w-24"
      />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {editionCountText(work.editionCount, language)}
          {work.pageCount > 0 && (
            <span className="ms-2 opacity-70">· {formatNumber(work.pageCount, language)} {t("صفحة")}</span>
          )}
        </p>
        <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-7 sm:mt-2 sm:text-lg sm:leading-8">{work.titleAr}</h3>
        <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-2 sm:leading-7">{work.description}</p>
      </div>
      <div className="col-span-2 self-end text-xs text-muted-foreground sm:col-auto sm:text-end">
        <p className="inline-flex items-center gap-1">
          {t("فتح الكتاب")}
          <DirectionalArrow className="h-3.5 w-3.5" />
        </p>
      </div>
    </Link>
  );
}

export function BookCard({ book, progress }: { book: BookSummary; progress?: number }) {
  const { t } = useUiTranslations();
  const roundedProgress = typeof progress === "number" ? Math.round(progress) : null;
  return (
    <Link
      href={`/edition/${book.id}`}
      className="interactive-card group flex h-full min-h-[16.5rem] flex-col p-3.5 sm:min-h-[21rem] sm:p-5"
    >
      <BookCover
        coverColor={book.coverColor}
        coverImageAlt={book.coverImageAlt}
        coverImageUrl={book.coverImageUrl}
        editionLabel={book.editionLabel}
        publisher={book.publisher}
        title={book.titleAr}
        size="md"
        className="mx-auto !h-36 !w-24 sm:!h-52 sm:!w-36"
      />
      <div className="mt-4 flex flex-1 flex-col text-center">
        <h3 className="line-clamp-2 text-base font-semibold leading-7">
          {book.titleAr}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {book.editionLabel ?? book.publisher ?? t("طبعة متاحة")}
        </p>
      </div>
      {roundedProgress !== null && (
        <ProgressLine className="mt-4" value={roundedProgress} />
      )}
    </Link>
  );
}

export function BookRow({ book }: { book: BookSummary | EditionSummary }) {
  const { t } = useUiTranslations();

  return (
    <Link
      href={`/edition/${book.id}`}
      className="interactive-card grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3 p-3.5 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4"
    >
      <BookCover
        coverColor={book.coverColor}
        coverImageAlt={book.coverImageAlt}
        coverImageUrl={book.coverImageUrl}
        editionLabel={book.editionLabel}
        publisher={book.publisher}
        title={book.titleAr}
        size="sm"
        className="!h-28 !w-20 sm:!h-[8.5rem] sm:!w-24"
      />
      <div className="min-w-0">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bookmark className="h-3.5 w-3.5" />
          {book.editionLabel ?? book.publisher ?? t("طبعة متاحة")}
        </p>
        <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-7 sm:mt-2 sm:text-lg sm:leading-8">{book.titleAr}</h3>
        <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-2 sm:leading-7">
          {book.workTitleAr}
        </p>
      </div>
      <div className="col-span-2 self-end text-xs text-muted-foreground sm:col-auto sm:text-end">
        <p className="inline-flex items-center gap-1">
          {t("فتح الطبعة")}
          <DirectionalArrow className="h-3.5 w-3.5" />
        </p>
      </div>
    </Link>
  );
}
