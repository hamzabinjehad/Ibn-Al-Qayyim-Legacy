export const FEATURED_READING_WORK_ID = 11;
export const FEATURED_READING_EDITION_ID = 20;

type WorkLike = {
  id: number;
};

type EditionLike = {
  id: number;
  workId: number;
};

export function isFeaturedReadingWork(work: WorkLike) {
  return work.id === FEATURED_READING_WORK_ID;
}

export function isFeaturedReadingEdition(edition: EditionLike) {
  return edition.id === FEATURED_READING_EDITION_ID;
}

export function prioritizeFeaturedWork<T extends WorkLike>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      Number(isFeaturedReadingWork(b)) - Number(isFeaturedReadingWork(a)),
  );
}

export function prioritizeFeaturedEdition<T extends EditionLike>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      Number(isFeaturedReadingEdition(b)) - Number(isFeaturedReadingEdition(a)),
  );
}
