import type { BookDetail, ChapterSummary } from "@/lib/static-library";

type BookWithChapters = BookDetail & {
  chapters: ChapterSummary[];
};

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function calculateBookPageProgress(
  book: Pick<BookWithChapters, "chapters"> | null | undefined,
  chapter: Pick<ChapterSummary, "id" | "orderIndex" | "page"> | null | undefined,
) {
  if (!book || !chapter || book.chapters.length === 0) return 0;

  const pages = book.chapters.map((item) => item.page).filter(Number.isFinite);
  const currentPage = Number.isFinite(chapter.page) ? chapter.page : null;
  const pagesAreMonotonic = book.chapters.every(
    (item, index, list) => index === 0 || item.page >= list[index - 1]!.page,
  );

  if (pagesAreMonotonic && pages.length > 0 && currentPage !== null) {
    const minPage = Math.min(...pages);
    const maxPage = Math.max(...pages);
    const pageSpan = maxPage - minPage + 1;
    if (pageSpan > 0) {
      return clampProgress(((currentPage - minPage + 1) / pageSpan) * 100);
    }
  }

  const currentIndex = book.chapters.findIndex((item) => item.id === chapter.id);
  const index = currentIndex >= 0 ? currentIndex : chapter.orderIndex;
  return clampProgress(((index + 1) / book.chapters.length) * 100);
}
