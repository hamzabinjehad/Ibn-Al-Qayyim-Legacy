import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, "../output/ibn-qayyim");
const TARGET_DIR = path.resolve(__dirname, "../../artifacts/ibn-al-qayyim/public/library-data");
const PUBLIC_DIR = path.resolve(__dirname, "../../artifacts/ibn-al-qayyim/public");
const COVER_METADATA_FILE = path.resolve(__dirname, "../metadata/book-covers.json");

interface SourceIndexBook {
  file: string;
  id: string;
  pages?: number;
  source_id?: number;
  title: string;
  volumes?: number;
}

interface SourceIndex {
  author: string;
  books: SourceIndexBook[];
  books_count: number;
  extracted_at: string;
  source: string;
}

interface SourceEntry {
  level: number;
  page: number;
  title: string;
}

interface SourcePage {
  headings: string[];
  page_num: number;
  text: string;
  vol: string;
}

interface SourceBook {
  author: string;
  id: string;
  index: SourceEntry[];
  pages: SourcePage[];
  source: string;
  source_id: number;
  title: string;
  volumes_count: number;
}

interface ArabicSourceBook {
  "العنوان"?: string;
  "القسم"?: string;
  "البيانات"?: {
    "الناشر"?: string;
    "عدد_الصفحات"?: number | string;
  };
  "الأجزاء"?: Array<{
    "الجزء"?: string;
    "عدد_الصفحات"?: number;
    "الصفحات"?: Array<{
      page?: number;
      text?: string;
    }>;
  }>;
}

interface BookSummary {
  category: string;
  chapterCount: number;
  coverColor: string;
  coverImageAlt?: string;
  coverImageUrl?: string;
  description: string;
  editionLabel?: string;
  id: number;
  pageCount: number;
  publisher?: string;
  slug: string;
  sourceId: number;
  title: string;
  titleAr: string;
  volumes: number;
}

interface BookCoverMetadata {
  coverImageAlt?: string;
  coverImageUrl?: string;
  downloadUrl?: string;
  publisher?: string;
  slug?: string;
  sourceId?: number;
  sourceUrl?: string;
}

interface ChapterSummary {
  bookId: number;
  id: number;
  level: number;
  orderIndex: number;
  page: number;
  parentId: number | null;
  title: string;
  titleAr: string;
}

interface ChapterDetail extends ChapterSummary {
  bookTitle: string;
  category: string;
  content: string;
  nextChapterId: number | null;
  prevChapterId: number | null;
}

const COVER_COLORS = [
  "#f7f7f7",
  "#f3f3f3",
  "#efefef",
  "#fafafa",
  "#f5f5f4",
  "#f4f4f5",
];

const MAX_STATIC_FILE_BYTES = 4_000_000;

function inferCategory(title: string): string {
  if (/تفسير|قرآن|أيمان القرآن|أمثال القرآن/.test(title)) return "التفسير والقرآن";
  if (/فقه|أحكام|جزية|خراج|طلاق|الصلاة|المولود|الطرق الحكمية/.test(title)) return "الفقه والأحكام";
  if (/عقيدة|توحيد|إيمان|الجهمية|النونية|شفاء العليل/.test(title)) return "العقيدة";
  if (/أخلاق|تزكية|قلب|صبر|شكر|محبة|روضة|الفوائد|الداء|الوابل|مدارج/.test(title)) {
    return "التزكية والسلوك";
  }
  if (/سيرة|زاد المعاد|تاريخ|هدي/.test(title)) return "السيرة والهدي";
  if (/حديث|سنة|المنار|سنن/.test(title)) return "الحديث وعلومه";
  return "متنوع";
}

function buildContentMap(pages: SourcePage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const page of pages ?? []) {
    for (const heading of page.headings ?? []) {
      const key = heading.trim();
      if (!key) continue;
      map.set(key, `${map.get(key) ? `${map.get(key)}\n\n` : ""}${page.text ?? ""}`);
    }
  }
  return map;
}

function stripEdition(title: string): string {
  return title
    .replace(/\s+-\s+(ط|ت)\s+.+$/, "")
    .replace(/\s+--\s+.+$/, "")
    .trim();
}

function extractEdition(title: string): { editionLabel?: string; publisher?: string } {
  const match = title.match(/\s+-\s+([\u0637\u062A])\s+(.+)$/u);
  if (!match) return {};

  const labelPrefix = match[1] === "\u0637" ? "\u0637" : "\u062A";
  const publisher = match[2]?.trim();
  if (!publisher) return {};

  return {
    editionLabel: `${labelPrefix} ${publisher}`,
    publisher,
  };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readOptionalJson<T>(filePath: string, fallback: T): T {
  try {
    return readJson<T>(filePath);
  } catch {
    return fallback;
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function hasLocalCoverFile(cover: BookCoverMetadata | undefined): cover is BookCoverMetadata {
  if (!cover?.coverImageUrl) return false;
  return existsSync(path.join(PUBLIC_DIR, cover.coverImageUrl.replace(/^\//, "")));
}

function isArabicBookTitle(title: string): boolean {
  return (title.match(/[\u0600-\u06FF]/gu) ?? []).length >= 2;
}

function normalizeSourceBook(raw: unknown, filePath: string): SourceBook | null {
  const source = raw as Partial<SourceBook>;
  if (source.title && source.id && Array.isArray(source.index) && Array.isArray(source.pages)) {
    if (!isArabicBookTitle(source.title)) return null;
    return source as SourceBook;
  }

  const arabic = raw as ArabicSourceBook;
  const title = arabic["العنوان"];
  const parts = arabic["الأجزاء"];
  if (!title || !Array.isArray(parts)) return null;
  if (!isArabicBookTitle(title)) return null;

  const pages = parts.flatMap((part) =>
    (part["الصفحات"] ?? []).map((page) => ({
      headings: [`صفحة ${page.page ?? ""}`.trim()],
      page_num: page.page ?? 0,
      text: page.text ?? "",
      vol: part["الجزء"] ?? "",
    })),
  );

  if (!pages.length) return null;

  return {
    author: "ابن قيم الجوزية",
    id: slugify(title || path.basename(filePath, ".json")),
    index: pages.map((page, index) => ({
      level: 1,
      page: page.page_num,
      title: page.headings[0] ?? `صفحة ${index + 1}`,
    })),
    pages,
    source: "turath.io",
    source_id: 0,
    title,
    volumes_count: parts.length || 1,
  };
}

function readSourceBook(filePath: string): SourceBook | null {
  return normalizeSourceBook(readJson<unknown>(filePath), filePath);
}

function collectJsonFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectJsonFiles(fullPath));
    } else if (entry.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

function loadSourceIndex(): SourceIndex {
  const indexPath = path.join(SOURCE_DIR, "index.json");
  if (existsSync(indexPath)) {
    return readJson<SourceIndex>(indexPath);
  }

  const previousBooks = readOptionalJson<BookSummary[]>(path.join(TARGET_DIR, "books.json"), []);
  const previousOrder = new Map<number | string, number>();
  previousBooks.forEach((book, index) => {
    previousOrder.set(book.sourceId, index);
    previousOrder.set(book.slug, index);
  });

  const books = collectJsonFiles(SOURCE_DIR)
    .map((filePath): SourceIndexBook | null => {
      const source = readSourceBook(filePath);
      if (!source) return null;

      return {
        file: path.relative(SOURCE_DIR, filePath),
        id: source.id,
        pages: source.pages?.length ?? 0,
        source_id: source.source_id,
        title: source.title,
        volumes: source.volumes_count,
      };
    })
    .filter((book): book is SourceIndexBook => book !== null)
    .sort((a, b) => {
      const aOrder = previousOrder.get(a.source_id ?? a.id) ?? previousOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = previousOrder.get(b.source_id ?? b.id) ?? previousOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.title.localeCompare(b.title, "ar");
    });

  return {
    author: "ابن قيم الجوزية",
    books,
    books_count: books.length,
    extracted_at: new Date().toISOString(),
    source: "turath.io",
  };
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function writeShards<T>(
  dir: string,
  prefix: string,
  items: T[],
  maxBytes = MAX_STATIC_FILE_BYTES,
): Array<{ count: number; file: string }> {
  const shards: Array<{ count: number; file: string }> = [];
  let current: T[] = [];
  let currentBytes = 2;

  const flush = () => {
    if (current.length === 0) return;
    const file = `${prefix}-${String(shards.length + 1).padStart(3, "0")}.json`;
    writeJson(path.join(dir, file), current);
    shards.push({ count: current.length, file });
    current = [];
    currentBytes = 2;
  };

  for (const item of items) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item), "utf8") + 1;
    if (current.length > 0 && currentBytes + itemBytes > maxBytes) flush();
    current.push(item);
    currentBytes += itemBytes;
  }

  flush();
  return shards;
}

function main() {
  const index = loadSourceIndex();
  const coverMetadata = readOptionalJson<BookCoverMetadata[]>(COVER_METADATA_FILE, []);
  const coversBySourceId = new Map(
    coverMetadata
      .filter((item) => typeof item.sourceId === "number")
      .map((item) => [item.sourceId!, item]),
  );
  const coversBySlug = new Map(
    coverMetadata
      .filter((item) => item.slug)
      .map((item) => [item.slug!, item]),
  );

  rmSync(TARGET_DIR, { force: true, recursive: true });
  mkdirSync(path.join(TARGET_DIR, "books"), { recursive: true });
  mkdirSync(path.join(TARGET_DIR, "book-content"), { recursive: true });
  mkdirSync(path.join(TARGET_DIR, "search-index"), { recursive: true });

  const books: BookSummary[] = [];
  const categories = new Map<string, number>();
  const searchIndex: Array<{
    bookId: number;
    bookTitle: string;
    category: string;
    chapterId: number;
    chapterTitle: string;
    content: string;
  }> = [];

  let nextChapterId = 1;

  index.books.forEach((entry, bookIndex) => {
    const source = readSourceBook(path.join(SOURCE_DIR, entry.file));
    if (!source?.index?.length) return;

    const bookId = bookIndex + 1;
    const category = inferCategory(source.title);
    const edition = extractEdition(source.title);
    const coverCandidate = coversBySourceId.get(source.source_id) ?? coversBySlug.get(source.id);
    const cover = hasLocalCoverFile(coverCandidate) ? coverCandidate : undefined;
    const contentMap = buildContentMap(source.pages);
    const parentStack = new Map<number, number>();
    const chapters: ChapterSummary[] = [];

    source.index.forEach((tocEntry, orderIndex) => {
      const level = Math.min(Math.max(tocEntry.level || 1, 1), 4);
      let parentId: number | null = null;

      for (let candidateLevel = level - 1; candidateLevel >= 1; candidateLevel--) {
        if (parentStack.has(candidateLevel)) {
          parentId = parentStack.get(candidateLevel)!;
          break;
        }
      }

      const chapterId = nextChapterId++;
      const chapter: ChapterSummary = {
        bookId,
        id: chapterId,
        level,
        orderIndex,
        page: tocEntry.page,
        parentId,
        title: tocEntry.title,
        titleAr: tocEntry.title,
      };

      chapters.push(chapter);

      for (const key of parentStack.keys()) {
        if (key >= level) parentStack.delete(key);
      }
      parentStack.set(level, chapterId);
    });

    const book: BookSummary = {
      category,
      chapterCount: chapters.length,
      coverColor: COVER_COLORS[bookIndex % COVER_COLORS.length]!,
      coverImageAlt: cover?.coverImageAlt,
      coverImageUrl: cover?.coverImageUrl,
      description: "من مؤلفات الإمام ابن قيم الجوزية.",
      editionLabel: edition.editionLabel,
      id: bookId,
      pageCount: entry.pages ?? source.pages?.length ?? 0,
      publisher: cover?.publisher ?? edition.publisher,
      slug: source.id,
      sourceId: source.source_id,
      title: source.title,
      titleAr: source.title,
      volumes: entry.volumes ?? source.volumes_count ?? 1,
    };

    books.push(book);
    categories.set(category, (categories.get(category) ?? 0) + 1);

    const detailedChapters = chapters.map((chapter, indexInBook): ChapterDetail => {
      const content = contentMap.get(chapter.title) ?? "";
      const detail: ChapterDetail = {
        ...chapter,
        bookTitle: book.titleAr,
        category,
        content,
        nextChapterId: chapters[indexInBook + 1]?.id ?? null,
        prevChapterId: chapters[indexInBook - 1]?.id ?? null,
      };

      searchIndex.push({
        bookId,
        bookTitle: book.titleAr,
        category,
        chapterId: chapter.id,
        chapterTitle: chapter.titleAr,
        content: content.slice(0, 700),
      });

      return detail;
    });

    const contentShards = writeShards(path.join(TARGET_DIR, "book-content"), `book-${bookId}`, detailedChapters);
    let contentCursor = 0;
    const contentParts = contentShards.map((shard) => {
      const shardChapters = detailedChapters.slice(contentCursor, contentCursor + shard.count);
      contentCursor += shard.count;
      return {
        ...shard,
        chapterIds: shardChapters.map((chapter) => chapter.id),
      };
    });

    writeJson(path.join(TARGET_DIR, "books", `${bookId}.json`), {
      ...book,
      baseTitle: stripEdition(book.titleAr),
      chapters,
      contentParts,
      firstChapterId: detailedChapters.find((chapter) => chapter.content.trim())?.id ?? chapters[0]?.id ?? null,
    });
  });

  const categoryList = Array.from(categories.entries())
    .map(([name, count]) => ({ count, name }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ar"));

  writeJson(path.join(TARGET_DIR, "books.json"), books);
  writeJson(path.join(TARGET_DIR, "categories.json"), categoryList);
  const searchShards = writeShards(path.join(TARGET_DIR, "search-index"), "part", searchIndex);
  writeJson(path.join(TARGET_DIR, "search-index", "manifest.json"), {
    count: searchIndex.length,
    shards: searchShards,
  });
  writeJson(path.join(TARGET_DIR, "manifest.json"), {
    author: index.author,
    booksCount: books.length,
    categoriesCount: categoryList.length,
    chaptersCount: nextChapterId - 1,
    generatedAt: new Date().toISOString(),
    source: index.source,
    sourceExtractedAt: index.extracted_at,
    version: 1,
  });

  console.log(`Generated ${books.length} books and ${nextChapterId - 1} chapters in ${TARGET_DIR}`);
}

main();
