import { useQuery } from "@tanstack/react-query";

const DATA_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/library-data`;

export interface LibraryManifest {
  author: string;
  booksCount: number;
  categoriesCount: number;
  chaptersCount: number;
  generatedAt: string;
  source: string;
  sourceExtractedAt: string;
  version: number;
}

export interface CategorySummary {
  count: number;
  name: string;
}

export interface BookSummary {
  category: string;
  chapterCount: number;
  coverColor: string;
  description: string;
  id: number;
  pageCount: number;
  slug: string;
  sourceId: number;
  title: string;
  titleAr: string;
  volumes: number;
}

export interface ChapterSummary {
  bookId: number;
  id: number;
  level: number;
  orderIndex: number;
  page: number;
  parentId: number | null;
  title: string;
  titleAr: string;
}

export interface BookDetail extends BookSummary {
  baseTitle: string;
  chapters: ChapterSummary[];
  contentParts: Array<{ chapterIds: number[]; count: number; file: string }>;
  firstChapterId: number | null;
}

export interface ChapterDetail extends ChapterSummary {
  bookTitle: string;
  category: string;
  content: string;
  nextChapterId: number | null;
  prevChapterId: number | null;
}

interface SearchDocument {
  bookId: number;
  bookTitle: string;
  category: string;
  chapterId: number;
  chapterTitle: string;
  content: string;
}

interface SearchManifest {
  count: number;
  shards: Array<{ count: number; file: string }>;
}

export interface LibrarySearchResult {
  bookId: number;
  bookTitle: string;
  category: string;
  chapterId: number;
  chapterTitle: string;
  matchCount: number;
  matchIn: "title" | "content" | "both";
  snippet: string;
}

const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(path: string): Promise<T> {
  const url = `${DATA_BASE}/${path}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${url}`);
        return response.json() as Promise<T>;
      }),
    );
  }
  return cache.get(url)! as Promise<T>;
}

function normalizeArabic(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, "")
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

function buildSnippet(content: string, query: string): string {
  const normalizedContent = normalizeArabic(content);
  const normalizedQuery = normalizeArabic(query);
  const matchIndex = normalizedContent.indexOf(normalizedQuery);

  if (matchIndex === -1) {
    return content.slice(0, 320);
  }

  const start = Math.max(0, matchIndex - 160);
  const end = Math.min(content.length, matchIndex + query.length + 220);
  return `${start > 0 ? "..." : ""}${content.slice(start, end)}${end < content.length ? "..." : ""}`;
}

function countMatches(value: string, query: string): number {
  const normalizedValue = normalizeArabic(value);
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return 0;
  let count = 0;
  let index = 0;
  while (index < normalizedValue.length) {
    const next = normalizedValue.indexOf(normalizedQuery, index);
    if (next === -1) break;
    count++;
    index = next + normalizedQuery.length;
  }
  return count;
}

export function useLibraryManifest() {
  return useQuery({
    queryKey: ["static-library", "manifest"],
    queryFn: () => fetchJson<LibraryManifest>("manifest.json"),
    staleTime: Infinity,
  });
}

export function useStaticBooks(category?: string) {
  return useQuery({
    queryKey: ["static-library", "books", category ?? ""],
    queryFn: async () => {
      const books = await fetchJson<BookSummary[]>("books.json");
      return category ? books.filter((book) => book.category === category) : books;
    },
    staleTime: Infinity,
  });
}

export function useStaticCategories() {
  return useQuery({
    queryKey: ["static-library", "categories"],
    queryFn: () => fetchJson<CategorySummary[]>("categories.json"),
    staleTime: Infinity,
  });
}

export function useStaticBook(bookId: number | undefined) {
  return useQuery({
    enabled: !!bookId,
    queryKey: ["static-library", "book", bookId],
    queryFn: () => fetchJson<BookDetail>(`books/${bookId}.json`),
    staleTime: Infinity,
  });
}

export function useStaticChapter(chapterId: number | undefined) {
  return useQuery({
    enabled: !!chapterId,
    queryKey: ["static-library", "chapter", chapterId],
    queryFn: async () => {
      const books = await fetchJson<BookSummary[]>("books.json");
      for (const book of books) {
        const detail = await fetchJson<BookDetail>(`books/${book.id}.json`);
        const part = detail.contentParts.find((item) => item.chapterIds.includes(chapterId!));
        if (!part) continue;
        const chapters = await fetchJson<ChapterDetail[]>(`book-content/${part.file}`);
        const chapter = chapters.find((item) => item.id === chapterId);
        if (chapter) return chapter;
      }
      throw new Error(`Chapter ${chapterId} not found`);
    },
    staleTime: Infinity,
  });
}

export function useStaticBookChapter(bookId: number | undefined, chapterId: number | undefined) {
  return useQuery({
    enabled: !!bookId && !!chapterId,
    queryKey: ["static-library", "book-content", bookId, chapterId],
    queryFn: async () => {
      const book = await fetchJson<BookDetail>(`books/${bookId}.json`);
      const part = book.contentParts.find((item) => item.chapterIds.includes(chapterId!));
      if (!part) throw new Error(`Chapter ${chapterId} not found`);
      const chapters = await fetchJson<ChapterDetail[]>(`book-content/${part.file}`);
      const chapter = chapters.find((item) => item.id === chapterId);
      if (!chapter) throw new Error(`Chapter ${chapterId} not found`);
      return chapter;
    },
    staleTime: Infinity,
  });
}

export function useStaticSearch(query: string, options: { bookId?: number; category?: string; enabled?: boolean } = {}) {
  return useQuery({
    enabled: (options.enabled ?? true) && normalizeArabic(query).length > 1,
    queryKey: ["static-library", "search", query, options.bookId ?? "", options.category ?? ""],
    queryFn: async () => {
      const manifest = await fetchJson<SearchManifest>("search-index/manifest.json");
      const shards = await Promise.all(
        manifest.shards.map((shard) => fetchJson<SearchDocument[]>(`search-index/${shard.file}`)),
      );
      const docs = shards.flat();
      const normalizedQuery = normalizeArabic(query);

      return docs
        .filter((doc) => {
          if (options.bookId && doc.bookId !== options.bookId) return false;
          if (options.category && doc.category !== options.category) return false;
          const inTitle = normalizeArabic(doc.chapterTitle).includes(normalizedQuery);
          const inBook = normalizeArabic(doc.bookTitle).includes(normalizedQuery);
          const inContent = normalizeArabic(doc.content).includes(normalizedQuery);
          return inTitle || inBook || inContent;
        })
        .map((doc): LibrarySearchResult => {
          const titleMatches = countMatches(`${doc.bookTitle} ${doc.chapterTitle}`, query);
          const contentMatches = countMatches(doc.content, query);
          const matchIn =
            titleMatches > 0 && contentMatches > 0 ? "both" : titleMatches > 0 ? "title" : "content";
          return {
            bookId: doc.bookId,
            bookTitle: doc.bookTitle,
            category: doc.category,
            chapterId: doc.chapterId,
            chapterTitle: doc.chapterTitle,
            matchCount: titleMatches + contentMatches,
            matchIn,
            snippet: buildSnippet(doc.content, query),
          };
        })
        .sort((a, b) => b.matchCount - a.matchCount)
        .slice(0, 80);
    },
  });
}
