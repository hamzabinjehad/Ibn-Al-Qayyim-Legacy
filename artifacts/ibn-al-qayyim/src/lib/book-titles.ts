import type { BookSummary } from "@/lib/static-library";

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g;

export function extractBaseTitle(title: string): string {
  return title
    .replace(/\s*=\s*.+$/, "")
    .replace(/\s*-\s*(ط|ت)\s+.+$/, "")
    .replace(/\s+-\s+.+$/, "")
    .trim();
}

export function normalizeArabicTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function getEditionsForWork(books: BookSummary[], matchTitle: string): BookSummary[] {
  const normalizedMatch = normalizeArabicTitle(matchTitle);
  const withBaseTitles = books.map((book) => ({
    book,
    normalizedBase: normalizeArabicTitle(extractBaseTitle(book.titleAr)),
  }));

  const exactMatches = withBaseTitles.filter(({ normalizedBase }) => normalizedBase === normalizedMatch);
  const matches = exactMatches.length > 0 ? exactMatches : withBaseTitles.filter(({ normalizedBase }) => {
    return (
      normalizedBase.includes(normalizedMatch) ||
      normalizedMatch.includes(normalizedBase)
    );
  });

  return matches.map(({ book }) => book);
}
