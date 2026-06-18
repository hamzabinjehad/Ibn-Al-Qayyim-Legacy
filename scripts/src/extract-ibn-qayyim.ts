import { getBookInfo, getPage, search } from "turath-sdk";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

// ─── Config ────────────────────────────────────────────────────────────────
const OUTPUT_DIR = join(process.cwd(), "output", "ibn-qayyim");
const PAGE_CONCURRENCY = 5;
const DELAY_BETWEEN_PAGES = 400;
const DELAY_BETWEEN_BOOKS = 800;
const MAX_STALE_PAGES = 4;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Utilities ─────────────────────────────────────────────────────────────
function slugify(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^؀-ۿa-zA-Z0-9-]/g, "")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
}

function stripHtml(html: string): string {
  // Preserve title spans as [[H:text]] markers before stripping other tags
  const withHeadings = html.replace(
    /<span\b[^>]*data-type=["']title["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_match, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      return text ? `\n[[H:${text}]]\n` : "\n";
    }
  );

  return withHeadings
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|h[1-6]|li|tr|span)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Load existing index ───────────────────────────────────────────────────
interface IndexBook {
  id: string;
  title: string;
  source_id: number;
  pages: number;
  volumes: number;
  file: string;
}

interface IndexFile {
  author: string;
  author_id: number;
  source: string;
  extracted_at: string;
  books_count: number;
  books: IndexBook[];
  failed: { id: number; title: string; error: string }[];
}

type ExtractedBookSummary = {
  slug: string;
  title: string;
  source_id: number;
  pages: number;
  volumes: number;
};

type FailedBookSummary = IndexFile["failed"][number];

async function loadExistingIndex(): Promise<IndexFile | null> {
  const indexPath = join(OUTPUT_DIR, "index.json");
  if (!existsSync(indexPath)) return null;
  try {
    const raw = await readFile(indexPath, "utf-8");
    return JSON.parse(raw) as IndexFile;
  } catch {
    return null;
  }
}

// ─── Step 1: Discover Ibn Qayyim's author_id ──────────────────────────────
function indexBookToSummary(book: IndexBook): ExtractedBookSummary {
  return {
    slug: book.id,
    title: book.title,
    source_id: book.source_id,
    pages: book.pages,
    volumes: book.volumes,
  };
}

async function writeExtractionIndex(
  authorId: number,
  books: ExtractedBookSummary[],
  failed: FailedBookSummary[]
) {
  await writeFile(
    join(OUTPUT_DIR, "index.json"),
    JSON.stringify(
      {
        author: "ابن قيم الجوزية",
        author_id: authorId,
        source: "turath.io",
        extracted_at: new Date().toISOString(),
        books_count: books.length,
        books: books.map(({ slug, title, source_id, pages, volumes }) => ({
          id: slug,
          title,
          source_id,
          pages,
          volumes,
          file: `${slug}.json`,
        })),
        failed,
      },
      null,
      2
    ),
    "utf-8"
  );
}

async function findAuthorId(): Promise<number> {
  console.log("🔍 البحث عن ابن قيم الجوزية...");
  for (const q of ["ابن قيم الجوزية", "ابن القيم الجوزية", "ابن القيم"]) {
    const res = await search(q);
    for (const item of res.data) {
      if (
        item.author_id &&
        (item.meta.author_name?.includes("ابن قيم") ||
          item.meta.author_name?.includes("ابن القيم"))
      ) {
        console.log(`   ✅ author_id = ${item.author_id}  (${item.meta.author_name})`);
        return item.author_id;
      }
    }
    await sleep(500);
  }
  throw new Error("لم يُعثر على author_id لابن القيم");
}

// ─── Step 2: Collect unique book IDs via paginated search ─────────────────
async function collectBooks(authorId: number): Promise<Map<number, string>> {
  const books = new Map<number, string>();

  // Comprehensive queries to maximise book discovery
  const queries = [
    "الله", "الإسلام", "القرآن", "السنة", "العلم", "الإيمان",
    "التوبة", "الصلاة", "الزكاة", "الحج", "الصيام", "الجهاد",
    "الذكر", "الدعاء", "القلب", "النفس", "الروح", "الموت",
    "الجنة", "النار", "القيامة", "الملائكة", "الأنبياء",
    "الفقه", "الحديث", "التفسير", "العقيدة", "الأخلاق",
    "الصبر", "الشكر", "التوكل", "الزهد", "الورع",
    "ابن القيم", "ابن قيم", "الجوزية",
  ];

  for (const query of queries) {
    process.stdout.write(`   📖 "${query}"... `);
    let page = 1;
    let stale = 0;

    while (true) {
      const res = await search(query, { author: authorId, page });
      if (!res.data.length) break;

      let newCount = 0;
      for (const item of res.data) {
        if (item.book_id && item.meta.book_name && !books.has(item.book_id)) {
          books.set(item.book_id, item.meta.book_name);
          newCount++;
        }
      }

      if (newCount === 0) { stale++; if (stale >= MAX_STALE_PAGES) break; }
      else stale = 0;
      if (res.data.length < 10) break;

      page++;
      await sleep(400);
    }
    console.log(`المجموع: ${books.size}`);
    await sleep(500);
  }
  return books;
}

// ─── Step 3: Fetch all pages of a book ────────────────────────────────────
type PageEntry = { page_num: number; vol: string; headings: string[]; text: string };

async function fetchAllPages(bookId: number, totalPages: number): Promise<PageEntry[]> {
  const pages: PageEntry[] = [];
  let fetched = 0;

  for (let start = 1; start <= totalPages; start += PAGE_CONCURRENCY) {
    const batch: number[] = [];
    for (let pg = start; pg < start + PAGE_CONCURRENCY && pg <= totalPages; pg++) {
      batch.push(pg);
    }

    const results = await Promise.allSettled(
      batch.map((pg) => getPage(bookId, pg))
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const pg = batch[i]!;
      if (r.status === "fulfilled") {
        const { meta, text } = r.value;
        pages.push({
          page_num: meta.page_id ?? pg,
          vol: meta.vol ?? "1",
          headings: meta.headings ?? [],
          text: stripHtml(text),
        });
        fetched++;
      } else {
        pages.push({ page_num: pg, vol: "1", headings: [], text: "" });
      }
    }

    process.stdout.write(`\r      صفحة ${Math.min(start + PAGE_CONCURRENCY - 1, totalPages)}/${totalPages} (${fetched} ✅)   `);
    if (start + PAGE_CONCURRENCY <= totalPages) await sleep(DELAY_BETWEEN_PAGES);
  }

  console.log();
  return pages.sort((a, b) => a.page_num - b.page_num);
}

// ─── Step 4: Extract a single book (with retries) ─────────────────────────
async function extractBook(
  bookId: number,
  titleFallback: string,
  idx: number,
  total: number
): Promise<{ slug: string; title: string; source_id: number; pages: number; volumes: number }> {
  console.log(`\n[${idx}/${total}] 📖 "${titleFallback}" (id=${bookId})`);

  let bookInfo: Awaited<ReturnType<typeof getBookInfo>> | null = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      bookInfo = await getBookInfo(bookId);
      break;
    } catch (err) {
      if (attempt === RETRY_ATTEMPTS) throw err;
      console.log(`   ⚠️  محاولة ${attempt}/${RETRY_ATTEMPTS} فشلت، إعادة المحاولة...`);
      await sleep(RETRY_DELAY * attempt);
    }
  }

  if (!bookInfo) throw new Error("فشل جلب معلومات الكتاب بعد كل المحاولات");

  const title = bookInfo.meta?.name ?? titleFallback;
  const volumesArr = bookInfo.indexes?.volumes ?? [];
  const totalPages = bookInfo.indexes?.page_map?.length ?? 0;
  const headings = bookInfo.indexes?.headings ?? [];

  console.log(`   جلب ${totalPages} صفحة...`);
  const pages = totalPages > 0 ? await fetchAllPages(bookId, totalPages) : [];

  const slug = slugify(title) || `book-${bookId}`;

  const output = {
    id: slug,
    title,
    author: "ابن قيم الجوزية",
    source: "turath.io",
    source_id: bookId,
    volumes_count: volumesArr.length || 1,
    volumes: volumesArr,
    index: headings,
    pages,
    extracted_at: new Date().toISOString(),
  };

  const filePath = join(OUTPUT_DIR, `${slug}.json`);
  await writeFile(filePath, JSON.stringify(output, null, 2), "utf-8");

  console.log(`   ✅ ${slug}.json | الصفحات: ${pages.length} | الأجزاء: ${volumesArr.length || 1}`);
  return { slug, title, source_id: bookId, pages: pages.length, volumes: volumesArr.length || 1 };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("   استخراج كتب الإمام ابن قيم الجوزية من turath.io   ");
  console.log("═══════════════════════════════════════════════════════\n");

  await mkdir(OUTPUT_DIR, { recursive: true });

  // Load previously extracted data to enable resume / skip logic
  const existingIndex = await loadExistingIndex();
  const alreadyExtracted = new Set<number>(
    existingIndex?.books.map((b) => b.source_id).filter((id) => id > 0) ?? []
  );
  const previouslySucceeded: IndexBook[] = existingIndex?.books ?? [];

  if (alreadyExtracted.size > 0) {
    console.log(`📂 وُجد ${alreadyExtracted.size} كتاب مستخرج مسبقاً — سيتم تخطيها\n`);
  }

  const authorId = existingIndex?.author_id ?? (await findAuthorId());
  await sleep(500);

  console.log(`\n📚 جمع الكتب (author_id=${authorId})...`);
  const booksMap = await collectBooks(authorId);

  // Inject previously-failed books so they get a fresh retry
  const knownFailed = existingIndex?.failed ?? [];
  for (const f of knownFailed) {
    if (!booksMap.has(f.id)) booksMap.set(f.id, f.title);
  }

  if (!booksMap.size) { console.error("❌ لم تُوجد كتب!"); process.exit(1); }

  // Filter out already-extracted books
  const booksList = Array.from(booksMap.entries())
    .map(([id, title]) => ({ id, title }))
    .filter(({ id }) => !alreadyExtracted.has(id));

  console.log(`\n📊 كتب مُكتشفة: ${booksMap.size} | جديدة/فاشلة للاستخراج: ${booksList.length}\n`);

  const succeeded: ExtractedBookSummary[] = [];
  const failed: FailedBookSummary[] = [];
  const mergedSucceeded = () => [
    ...previouslySucceeded.map(indexBookToSummary),
    ...succeeded,
  ];

  for (let i = 0; i < booksList.length; i++) {
    const book = booksList[i]!;
    try {
      const result = await extractBook(book.id, book.title, i + 1, booksList.length);
      succeeded.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ "${book.title}": ${msg}`);
      failed.push({ id: book.id, title: book.title, error: msg });
    }
    await writeExtractionIndex(authorId, mergedSucceeded(), failed);
    if (i < booksList.length - 1) await sleep(DELAY_BETWEEN_BOOKS);
  }

  // Merge with previously succeeded
  const allSucceeded = mergedSucceeded();

  // Write merged index
  await writeFile(
    join(OUTPUT_DIR, "index.json"),
    JSON.stringify(
      {
        author: "ابن قيم الجوزية",
        author_id: authorId,
        source: "turath.io",
        extracted_at: new Date().toISOString(),
        books_count: allSucceeded.length,
        books: allSucceeded.map(({ slug, title, source_id, pages, volumes }) => ({
          id: slug,
          title,
          source_id,
          pages,
          volumes,
          file: `${slug}.json`,
        })),
        failed,
      },
      null,
      2
    ),
    "utf-8"
  );

  // Report
  const totalPages = allSucceeded.reduce((s, b) => s + b.pages, 0);
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("                    التقرير النهائي                     ");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`✅ كتب مُستخرجة (إجمالي): ${allSucceeded.length}`);
  console.log(`   منها مستخرجة مسبقاً:  ${previouslySucceeded.length}`);
  console.log(`   منها جديدة/مُعاد استخراجها: ${succeeded.length}`);
  console.log(`📄 إجمالي الصفحات:     ${totalPages.toLocaleString()}`);
  console.log(`❌ كتب فاشلة:          ${failed.length}`);
  if (failed.length) {
    console.log("\nالكتب الفاشلة:");
    for (const f of failed) console.log(`  - [${f.id}] ${f.title}: ${f.error}`);
  }
  console.log(`\n📁 المخرجات: ${OUTPUT_DIR}`);
  console.log("═══════════════════════════════════════════════════════");
}

main().catch((err) => { console.error("خطأ فادح:", err); process.exit(1); });
