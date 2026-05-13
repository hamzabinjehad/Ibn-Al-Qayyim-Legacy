import { Link } from "wouter";
import { Bookmark, FileText } from "lucide-react";
import type { BookSummary } from "@/lib/static-library";
import BookCover from "@/components/BookCover";

export function BookCard({ book, progress }: { book: BookSummary; progress?: number }) {
  const roundedProgress = typeof progress === "number" ? Math.round(progress) : null;
  return (
    <Link
      href={`/book/${book.id}`}
      className="group block rounded-lg border border-border bg-background p-4 transition-colors hover:border-foreground"
    >
      <BookCover
        coverColor={book.coverColor}
        coverImageAlt={book.coverImageAlt}
        coverImageUrl={book.coverImageUrl}
        editionLabel={book.editionLabel}
        publisher={book.publisher}
        title={book.titleAr}
        size="md"
        className="mx-auto max-w-40"
      />
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">{book.category}</p>
        <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-7 transition-colors group-hover:text-muted-foreground">
          {book.titleAr}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {book.chapterCount} فصل / {book.pageCount} صفحة
        </p>
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

export function BookRow({ book }: { book: BookSummary }) {
  return (
    <Link
      href={`/book/${book.id}`}
      className="grid gap-4 rounded-lg border border-border bg-background p-4 transition-colors hover:border-foreground sm:grid-cols-[auto_1fr_auto]"
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
      <div>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bookmark className="h-3.5 w-3.5" />
          {book.category}
        </p>
        <h3 className="mt-2 text-lg font-semibold leading-8">{book.titleAr}</h3>
        <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-7 text-muted-foreground">{book.description}</p>
      </div>
      <div className="self-end text-xs text-muted-foreground tabular-nums sm:text-left">
        <p>{book.chapterCount} فصل</p>
        <p className="mt-1 inline-flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" />
          {book.pageCount} صفحة
        </p>
      </div>
    </Link>
  );
}
