import { useQuery } from "@tanstack/react-query";
import { prioritizeFeaturedEdition } from "@/lib/featured-reading";
import { useLanguage, type LanguageCode, type TextDirection } from "@/lib/i18n";
import { formatNumber, translateUi } from "@/lib/ui-translations";

const DATA_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/library-data`;
const DATA_BASE_CANDIDATES = Array.from(new Set([DATA_BASE, "/library-data"]));

export interface LibraryManifest {
  author: string;
  booksCount: number;
  categoriesCount: number;
  chaptersCount: number;
  editionsCount?: number;
  generatedAt: string;
  languageCode?: LanguageCode;
  pagesCount?: number;
  source: string;
  sourceExtractedAt: string;
  version: number;
}

export interface CategorySummary {
  count: number;
  name: string;
}

export interface WorkSummary {
  category: string;
  coverColor: string;
  coverImageAlt?: string;
  coverImageUrl?: string;
  defaultEditionId: number;
  description: string;
  editionCount: number;
  id: number;
  languageCode: LanguageCode;
  pageCount: number;
  sectionCount: number;
  slug: string;
  title: string;
  titleAr: string;
  volumeCount: number;
}

export interface EditionSummary {
  category: string;
  coverColor: string;
  coverImageAlt?: string;
  coverImageUrl?: string;
  defaultSectionId: number;
  direction: TextDirection;
  editionLabel?: string;
  id: number;
  kind: "original" | "translation";
  languageCode: LanguageCode;
  languageName: string;
  pageCount: number;
  publisher?: string;
  reviewerName?: string;
  sectionCount: number;
  sourceId: number;
  sourceFile?: string;
  sourceTitle?: string;
  status: "draft" | "reviewed" | "published";
  title: string;
  titleAr: string;
  translatorName?: string;
  volumeCount: number;
  workId: number;
  workTitleAr: string;
}

export interface SectionSummary {
  direction: TextDirection;
  editionId: number;
  endPage: number;
  id: number;
  languageCode: LanguageCode;
  orderIndex: number;
  parentId: number | null;
  startPage: number;
  title: string;
  titleAr: string;
  type: "bab" | "fasl" | "heading" | "topic";
  workId: number;
}

export interface PageDetail {
  direction: TextDirection;
  editionId: number;
  id: number;
  languageCode: LanguageCode;
  orderIndex: number;
  pageNumber: number;
  sectionId: number | null;
  sourcePageNumber?: number;
  text: string;
  volume: string;
  workId: number;
}

export interface WorkDetail extends WorkSummary {
  editionIds: number[];
  editions: EditionSummary[];
  sectionIds: number[];
}

export interface EditionDetail extends EditionSummary {
  pageParts: Array<{ count: number; file: string; pageIds: number[] }>;
  pages: PageDetail[];
  sections: SectionSummary[];
}

export interface SectionDetail extends SectionSummary {
  category: string;
  content: string;
  editionTitle: string;
  nextSectionId: number | null;
  pages: PageDetail[];
  prevSectionId: number | null;
  workTitle: string;
}

// Compatibility aliases used by older local-library helpers and a few generic cards.
export type BookSummary = EditionSummary & {
  chapterCount: number;
  firstChapterId: number;
  volumes: number;
};
export type BookDetail = EditionDetail;
export type ChapterSummary = SectionSummary & { page: number };
export type ChapterDetail = SectionDetail & {
  bookId: number;
  bookTitle: string;
  page: number;
};

interface SearchDocument {
  bookId: number;
  bookTitle: string;
  category: string;
  content: string;
  editionId: number;
  languageCode: LanguageCode;
  pageId: number;
  pageNumber: number;
  sectionId: number | null;
  sectionTitle: string;
  snippetTitle: string;
  workId: number;
  workTitle: string;
}

interface SearchManifest {
  count: number;
  editionShards?: Record<number, number[]>;
  languageCode?: string;
  shards: Array<{ count: number; file: string }>;
}

export interface LibrarySearchResult {
  bookId: number;
  bookTitle: string;
  category: string;
  chapterId: number;
  chapterTitle: string;
  editionId: number;
  languageCode: LanguageCode;
  matchCount: number;
  matchIn: "title" | "content" | "both";
  pageId: number;
  pageNumber: number;
  sectionId: number | null;
  snippet: string;
  workId: number;
  workTitle: string;
}

const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(language: LanguageCode, path: string): Promise<T> {
  const cacheKey = `library-data:${language}:${path}`;
  if (!cache.has(cacheKey)) {
    cache.set(
      cacheKey,
      (async () => {
        let lastError: unknown;
        for (const base of DATA_BASE_CANDIDATES) {
          const languageUrl = `${base}/${language}/${path}`;
          try {
            const response = await fetch(languageUrl);
            if (!response.ok) {
              lastError = new Error(`Unable to load ${languageUrl}`);
              continue;
            }
            return (await response.json()) as T;
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError instanceof Error
          ? lastError
          : new Error(`Unable to load library data: ${path}`);
      })(),
    );
  }
  return cache.get(cacheKey)! as Promise<T>;
}

function matchesLanguage(
  item: { languageCode?: LanguageCode },
  language: LanguageCode,
) {
  return item.languageCode === language;
}

function containsArabic(value: string | undefined): boolean {
  return Boolean(value && /[\u0600-\u06FF]/u.test(value));
}

function localizedFallbackTitle(language: LanguageCode) {
  if (language === "de") return "Übersetzte Ausgabe";
  if (language === "en") return "Translated edition";
  return "طبعة متاحة";
}

function displayTitle(language: LanguageCode, title: string, titleAr: string) {
  if (language === "ar") return titleAr || title;
  const translatedTitle = translateUi(language, title);
  if (translatedTitle && !containsArabic(translatedTitle))
    return translatedTitle;
  const translatedArabicTitle = translateUi(language, titleAr);
  if (translatedArabicTitle && !containsArabic(translatedArabicTitle))
    return translatedArabicTitle;
  return localizedFallbackTitle(language);
}

function displayMetadata(language: LanguageCode, value: string | undefined) {
  if (!value) return undefined;
  if (language === "ar") return value;
  return containsArabic(value) ? undefined : value;
}

function normalizeVolumeNumber(value: string): string | undefined {
  const match = value.match(/[0-9\u0660-\u0669\u06F0-\u06F9]+/u);
  if (!match) return undefined;
  return match[0]
    .replace(/[\u0660-\u0669]/gu, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06F0-\u06F9]/gu, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    );
}

function localizedVolumeLabel(volume: string, language: LanguageCode): string {
  if (language === "ar" || !containsArabic(volume)) return volume;

  const volumeNumber = normalizeVolumeNumber(volume);
  if (language === "de") return volumeNumber ? `Band ${volumeNumber}` : "Buch";
  if (language === "en")
    return volumeNumber ? `Volume ${volumeNumber}` : "Book";
  return volume;
}

function localizedEditionAvailabilityText(
  count: number,
  language: LanguageCode,
) {
  if (language === "de")
    return count === 1
      ? "1 Ausgabe verfügbar"
      : `${formatNumber(count, language)} Ausgaben verfügbar`;
  if (language === "en")
    return count === 1
      ? "1 edition available"
      : `${formatNumber(count, language)} editions available`;
  return count === 1
    ? "طبعة واحدة متاحة"
    : count === 2
      ? "طبعتان متاحتان"
      : `${formatNumber(count, language)} طبعات متاحة`;
}

function localizeWork(
  work: WorkSummary,
  language: LanguageCode,
  editions: EditionSummary[] = [],
) {
  const firstEdition = editions[0];
  const editionCount = editions.length || work.editionCount;
  return {
    ...work,
    coverColor: firstEdition?.coverColor ?? work.coverColor,
    coverImageAlt: firstEdition?.coverImageAlt ?? work.coverImageAlt,
    coverImageUrl: firstEdition?.coverImageUrl ?? work.coverImageUrl,
    defaultEditionId: firstEdition?.id ?? work.defaultEditionId,
    description:
      language === "ar"
        ? work.description
        : localizedEditionAvailabilityText(editionCount, language),
    editionCount,
    languageCode: language,
    pageCount: editions.length
      ? editions.reduce((total, edition) => total + edition.pageCount, 0)
      : work.pageCount,
    sectionCount: editions.length
      ? editions.reduce((total, edition) => total + edition.sectionCount, 0)
      : work.sectionCount,
    titleAr: displayTitle(language, work.title, work.titleAr),
    volumeCount: editions.length
      ? editions.reduce((total, edition) => total + edition.volumeCount, 0)
      : work.volumeCount,
  } satisfies WorkSummary;
}

function localizeEdition(edition: EditionSummary, language: LanguageCode) {
  return {
    ...edition,
    editionLabel: displayMetadata(language, edition.editionLabel),
    publisher: displayMetadata(language, edition.publisher),
    reviewerName: displayMetadata(language, edition.reviewerName),
    sourceTitle: displayMetadata(language, edition.sourceTitle),
    titleAr: displayTitle(language, edition.title, edition.titleAr),
    workTitleAr: displayTitle(language, edition.title, edition.workTitleAr),
  } satisfies EditionSummary;
}

function localizeSection(section: SectionSummary, language: LanguageCode) {
  return {
    ...section,
    titleAr: displayTitle(language, section.title, section.titleAr),
  } satisfies SectionSummary;
}

function localizeEditionDetail(edition: EditionDetail, language: LanguageCode) {
  const localizedEdition = localizeEdition(edition, language);
  return {
    ...edition,
    ...localizedEdition,
    pages: edition.pages.map((page) => ({
      ...page,
      volume: localizedVolumeLabel(page.volume, language),
    })),
    sections: edition.sections.map((section) =>
      localizeSection(section, language),
    ),
  } satisfies EditionDetail;
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
  if (matchIndex === -1) return content.slice(0, 320);

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

function toChapterSummary(section: SectionSummary): ChapterSummary {
  return { ...section, page: section.startPage };
}

function toChapterDetail(section: SectionDetail): ChapterDetail {
  return {
    ...section,
    bookId: section.editionId,
    bookTitle: section.editionTitle,
    page: section.startPage,
  };
}

function toBookSummary(edition: EditionSummary): BookSummary {
  return {
    ...edition,
    chapterCount: edition.sectionCount,
    firstChapterId: edition.defaultSectionId,
    volumes: edition.volumeCount,
  };
}

export function sectionTypeLabel(
  type: SectionSummary["type"],
  language: LanguageCode = "ar",
) {
  if (type === "bab") return translateUi(language, "باب");
  if (type === "fasl") return translateUi(language, "فصل");
  if (type === "topic") return translateUi(language, "موضوع");
  return translateUi(language, "عنوان");
}

export function useLibraryManifest() {
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["static-library", language, "manifest"],
    queryFn: () => fetchJson<LibraryManifest>(language, "manifest.json"),
    staleTime: Infinity,
  });
}

export function useStaticWorks(category?: string) {
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["static-library", language, "works", category ?? ""],
    queryFn: async () => {
      const works = await fetchJson<WorkSummary[]>(language, "works.json");
      const editions = (
        await fetchJson<EditionSummary[]>(language, "editions.json")
      )
        .filter((edition) => matchesLanguage(edition, language))
        .map((edition) => localizeEdition(edition, language));
      const editionsByWork = new Map<number, EditionSummary[]>();
      editions.forEach((edition) => {
        const current = editionsByWork.get(edition.workId) ?? [];
        current.push(edition);
        editionsByWork.set(edition.workId, current);
      });
      editionsByWork.forEach((workEditions, workId) => {
        editionsByWork.set(workId, prioritizeFeaturedEdition(workEditions));
      });

      return works
        .filter((work) => {
          const workEditions = editionsByWork.get(work.id) ?? [];
          return (
            workEditions.length > 0 && (!category || work.category === category)
          );
        })
        .map((work) =>
          localizeWork(work, language, editionsByWork.get(work.id)),
        );
    },
    staleTime: Infinity,
  });
}

export function useStaticWork(workId: number | undefined) {
  const { language } = useLanguage();
  return useQuery({
    enabled: !!workId,
    queryKey: ["static-library", language, "work", workId],
    queryFn: async () => {
      const work = await fetchJson<WorkDetail>(
        language,
        `works/${workId}.json`,
      );
      const editions = work.editions
        .filter((edition) => matchesLanguage(edition, language))
        .map((edition) => localizeEdition(edition, language));
      if (editions.length === 0)
        throw new Error(`Work ${workId} has no ${language} editions`);

      const orderedEditions = prioritizeFeaturedEdition(editions);
      const summary = localizeWork(work, language, orderedEditions);
      return {
        ...work,
        ...summary,
        defaultEditionId: orderedEditions[0]?.id ?? summary.defaultEditionId,
        editionIds: orderedEditions.map((edition) => edition.id),
        editions: orderedEditions,
      } satisfies WorkDetail;
    },
    staleTime: Infinity,
  });
}

export function useStaticEditions(workId?: number) {
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["static-library", language, "editions", workId ?? ""],
    queryFn: async () => {
      if (workId) {
        const work = await fetchJson<WorkDetail>(
          language,
          `works/${workId}.json`,
        );
        return prioritizeFeaturedEdition(
          work.editions
            .filter((edition) => matchesLanguage(edition, language))
            .map((edition) => localizeEdition(edition, language)),
        );
      }
      const editions = await fetchJson<EditionSummary[]>(
        language,
        "editions.json",
      );
      return editions
        .filter((edition) => matchesLanguage(edition, language))
        .map((edition) => localizeEdition(edition, language));
    },
    staleTime: Infinity,
  });
}

export function useStaticEdition(editionId: number | undefined) {
  const { language } = useLanguage();
  return useQuery({
    enabled: !!editionId,
    queryKey: ["static-library", language, "edition", editionId],
    queryFn: async () => {
      const edition = await fetchJson<EditionDetail>(
        language,
        `editions/${editionId}.json`,
      );
      if (!matchesLanguage(edition, language))
        throw new Error(`Edition ${editionId} is not available in ${language}`);
      return localizeEditionDetail(edition, language);
    },
    staleTime: Infinity,
  });
}

export function useStaticSection(
  editionId: number | undefined,
  sectionId: number | undefined,
) {
  const { language } = useLanguage();
  return useQuery({
    enabled: !!editionId && !!sectionId,
    queryKey: ["static-library", language, "section", editionId, sectionId],
    queryFn: async () => {
      const rawEdition = await fetchJson<EditionDetail>(
        language,
        `editions/${editionId}.json`,
      );
      if (!matchesLanguage(rawEdition, language))
        throw new Error(`Edition ${editionId} is not available in ${language}`);
      const edition = localizeEditionDetail(rawEdition, language);
      const section = edition.sections.find((item) => item.id === sectionId);
      if (!section) throw new Error(`Section ${sectionId} not found`);
      const pages = edition.pages.filter(
        (page) =>
          page.pageNumber >= section.startPage &&
          page.pageNumber <= section.endPage,
      );
      const siblings = edition.sections;
      const currentIndex = siblings.findIndex((item) => item.id === section.id);
      return {
        ...section,
        category: edition.category,
        content: pages.map((page) => page.text).join("\n\n"),
        editionTitle: edition.titleAr,
        nextSectionId: siblings[currentIndex + 1]?.id ?? null,
        pages,
        prevSectionId: siblings[currentIndex - 1]?.id ?? null,
        workTitle: edition.workTitleAr,
      } satisfies SectionDetail;
    },
    staleTime: Infinity,
  });
}

export function useStaticCategories() {
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["static-library", language, "categories"],
    queryFn: () => fetchJson<CategorySummary[]>(language, "categories.json"),
    staleTime: Infinity,
  });
}

export function useStaticBooks(category?: string) {
  const { language } = useLanguage();
  return useQuery({
    queryKey: ["static-library", language, "edition-books", category ?? ""],
    queryFn: async () => {
      const editions = await fetchJson<EditionSummary[]>(
        language,
        "editions.json",
      );
      const books = editions
        .filter((edition) => matchesLanguage(edition, language))
        .map((edition) => toBookSummary(localizeEdition(edition, language)));
      return category
        ? books.filter((book) => book.category === category)
        : books;
    },
    staleTime: Infinity,
  });
}

export function useStaticBook(bookId: number | undefined) {
  const { language } = useLanguage();
  return useQuery({
    enabled: !!bookId,
    queryKey: ["static-library", language, "book-compat", bookId],
    queryFn: async () => {
      const rawEdition = await fetchJson<EditionDetail>(
        language,
        `editions/${bookId}.json`,
      );
      if (!matchesLanguage(rawEdition, language))
        throw new Error(`Edition ${bookId} is not available in ${language}`);
      const edition = localizeEditionDetail(rawEdition, language);
      return {
        ...edition,
        baseTitle: edition.workTitleAr,
        chapterCount: edition.sectionCount,
        chapters: edition.sections.map(toChapterSummary),
        contentParts: edition.pageParts.map((part) => ({
          ...part,
          chapterIds: part.pageIds,
        })),
        firstChapterId: edition.defaultSectionId,
        volumes: edition.volumeCount,
      };
    },
    staleTime: Infinity,
  });
}

export function useStaticBookChapter(
  bookId: number | undefined,
  chapterId: number | undefined,
) {
  const query = useStaticSection(bookId, chapterId);
  return {
    ...query,
    data: query.data ? toChapterDetail(query.data) : undefined,
  };
}

export function useStaticSearch(
  query: string,
  options: {
    bookId?: number;
    category?: string;
    enabled?: boolean;
    sectionId?: number;
    workId?: number;
  } = {},
) {
  const { language } = useLanguage();
  return useQuery({
    enabled: (options.enabled ?? true) && normalizeArabic(query).length > 1,
    queryKey: [
      "static-library",
      language,
      "search",
      query,
      options.bookId ?? "",
      options.workId ?? "",
      options.sectionId ?? "",
      options.category ?? "",
    ],
    queryFn: async () => {
      const manifest = await fetchJson<SearchManifest>(
        language,
        "search-index/manifest.json",
      );
      const normalizedQuery = normalizeArabic(query);
      const matches: LibrarySearchResult[] = [];

      // When searching within a specific edition, use the editionShards index to
      // load only the shards that contain that edition's pages instead of all shards.
      const targetShardIndices =
        options.bookId && manifest.editionShards
          ? (manifest.editionShards[options.bookId] ?? null)
          : null;

      const shardsToSearch = targetShardIndices
        ? manifest.shards.filter((_, i) => targetShardIndices.includes(i))
        : manifest.shards;

      let reachedRequestedBook = false;

      for (const shard of shardsToSearch) {
        const docs = await fetchJson<SearchDocument[]>(
          language,
          `search-index/${shard.file}`,
        );

        // When no editionShards index is available, fall back to the sequential
        // early-exit heuristic: stop once we've passed the target edition's shards.
        if (!targetShardIndices && options.bookId) {
          if (
            reachedRequestedBook &&
            docs.every((doc) => doc.editionId !== options.bookId)
          ) {
            break;
          }
          if (docs.some((doc) => doc.editionId === options.bookId)) {
            reachedRequestedBook = true;
          }
        }

        docs.forEach((doc) => {
          if (!matchesLanguage(doc, language)) return false;
          if (options.bookId && doc.editionId !== options.bookId) return false;
          if (options.workId && doc.workId !== options.workId) return false;
          if (options.sectionId && doc.sectionId !== options.sectionId)
            return false;
          if (options.category && doc.category !== options.category)
            return false;
          const inTitle = normalizeArabic(
            `${doc.workTitle} ${doc.bookTitle} ${doc.sectionTitle}`,
          ).includes(normalizedQuery);
          const inContent = normalizeArabic(doc.content).includes(
            normalizedQuery,
          );
          if (!inTitle && !inContent) return false;

          const titleMatches = countMatches(
            `${doc.workTitle} ${doc.bookTitle} ${doc.sectionTitle}`,
            query,
          );
          const contentMatches = countMatches(doc.content, query);
          const matchIn =
            titleMatches > 0 && contentMatches > 0
              ? "both"
              : titleMatches > 0
                ? "title"
                : "content";
          matches.push({
            bookId: doc.editionId,
            bookTitle: doc.bookTitle,
            category: doc.category,
            chapterId: doc.sectionId ?? doc.pageId,
            chapterTitle: doc.sectionTitle,
            editionId: doc.editionId,
            languageCode: doc.languageCode,
            matchCount: titleMatches + contentMatches,
            matchIn,
            pageId: doc.pageId,
            pageNumber: doc.pageNumber,
            sectionId: doc.sectionId,
            snippet: buildSnippet(doc.content, query),
            workId: doc.workId,
            workTitle: doc.workTitle,
          });

          return true;
        });

        if (
          !options.bookId &&
          !options.workId &&
          !options.sectionId &&
          matches.length >= 120
        ) {
          break;
        }
      }

      return matches.sort((a, b) => b.matchCount - a.matchCount).slice(0, 80);
    },
  });
}
