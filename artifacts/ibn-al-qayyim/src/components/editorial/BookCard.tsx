import { Link } from "wouter";
import { Bookmark } from "lucide-react";
import type { BookSummary, EditionSummary, WorkSummary } from "@/lib/static-library";
import BookCover from "@/components/BookCover";
import { DirectionalArrow } from "./DirectionalIcon";
import ProgressLine from "./ProgressLine";
import { editionCountText, useUiTranslations } from "@/lib/ui-translations";

export function WorkCard({ work, progress }: { work: WorkSummary; progress?: number }) {
  const { language } = useUiTranslations();
  const roundedProgress = typeof progress === "number" ? Math.round(progress) : null;
  return (
    <Link
      href={`/work/${work.id}`}
      className="interactive-card group flex h-full min-h-[22rem] flex-col p-4 sm:p-5"
    >
      <BookCover
        coverColor={work.coverColor}
        coverImageAlt={work.coverImageAlt}
        coverImageUrl={work.coverImageUrl}
        title={work.titleAr}
        size="md"
        className="mx-auto !h-44 !w-32 sm:!h-52 sm:!w-36"
      />
      <div className="mt-4 flex flex-1 flex-col text-center">
        <h3 className="line-clamp-2 text-base font-semibold leading-7 transition-colors group-hover:text-muted-foreground">
          {work.titleAr}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {editionCountText(work.editionCount, language)}
        </p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{work.description}</p>
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
      className="interactive-card grid min-w-0 gap-4 p-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center"
    >
      <BookCover
        coverColor={work.coverColor}
        coverImageAlt={work.coverImageAlt}
        coverImageUrl={work.coverImageUrl}
        title={work.titleAr}
        size="sm"
        className="hidden w-24 sm:flex"
      />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {editionCountText(work.editionCount, language)}
        </p>
        <h3 className="mt-2 text-lg font-semibold leading-8">{work.titleAr}</h3>
        <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-7 text-muted-foreground">{work.description}</p>
      </div>
      <div className="self-end text-xs text-muted-foreground sm:text-end">
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
      className="interactive-card group flex h-full min-h-[21rem] flex-col p-4 sm:p-5"
    >
      <BookCover
        coverColor={book.coverColor}
        coverImageAlt={book.coverImageAlt}
        coverImageUrl={book.coverImageUrl}
        editionLabel={book.editionLabel}
        publisher={book.publisher}
        title={book.titleAr}
        size="md"
        className="mx-auto !h-44 !w-32 sm:!h-52 sm:!w-36"
      />
      <div className="mt-4 flex flex-1 flex-col text-center">
        <h3 className="line-clamp-2 text-base font-semibold leading-7 transition-colors group-hover:text-muted-foreground">
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
      className="interactive-card grid min-w-0 gap-4 p-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center"
    >
      <BookCover
        coverColor={book.coverColor}
        coverImageAlt={book.coverImageAlt}
        coverImageUrl={book.coverImageUrl}
        editionLabel={book.editionLabel}
        publisher={book.publisher}
        title={book.titleAr}
        size="sm"
        className="hidden w-24 sm:flex"
      />
      <div className="min-w-0">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bookmark className="h-3.5 w-3.5" />
          {book.editionLabel ?? book.publisher ?? t("طبعة متاحة")}
        </p>
        <h3 className="mt-2 text-lg font-semibold leading-8">{book.titleAr}</h3>
        <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          {book.workTitleAr}
        </p>
      </div>
      <div className="self-end text-xs text-muted-foreground sm:text-end">
        <p className="inline-flex items-center gap-1">
          {t("فتح الطبعة")}
          <DirectionalArrow className="h-3.5 w-3.5" />
        </p>
      </div>
    </Link>
  );
}
