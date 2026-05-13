/**
 * Seeds the database from the extracted Ibn Al-Qayyim JSON files in scripts/output/ibn-qayyim/.
 *
 * Structure of each JSON file:
 *   index: Array<{ title: string; level: number; page: number }>  — table of contents
 *   pages: Array<{ page_num: number; vol: string; headings: string[]; text: string }>
 *
 * Seeding strategy:
 *   - Each entry in `index` becomes a chapter row.
 *   - level 1   → باب كبير (section header; may have children)
 *   - level 2-3 → فصل أو باب فرعي
 *   - level 4+  → فصل نصي
 *   - parentId is derived by tracking the last seen ancestor at each level.
 *   - content = pages whose first heading matches this entry's title, concatenated.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db, pool, booksTable, chaptersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../../output/ibn-qayyim");
const PUBLIC_DIR = path.join(__dirname, "../../artifacts/ibn-al-qayyim/public");
const COVER_METADATA_FILE = path.join(__dirname, "../metadata/book-covers.json");

// ─── Types ────────────────────────────────────────────────────────────────────

interface IndexEntry {
  title: string;
  level: number;
  page: number;
}

interface PageEntry {
  page_num: number;
  vol: string;
  headings: string[];
  text: string;
}

interface ExtractedBook {
  id: string;
  title: string;
  author: string;
  source: string;
  source_id: number;
  volumes_count: number;
  index: IndexEntry[];
  pages: PageEntry[];
}

interface BookCoverMetadata {
  coverImageAlt?: string;
  coverImageUrl: string;
  publisher?: string;
  slug?: string;
  sourceId?: number;
  sourceUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COVER_COLORS = [
  "#1a5276", "#145a32", "#6e2f1a", "#4a235a",
  "#1b4f72", "#212f3d", "#7d6608", "#943126",
  "#0e6655", "#6c3483", "#1f618d", "#7b241c",
];

function inferCategory(title: string): string {
  if (/تفسير|قرآن/.test(title)) return "التفسير";
  if (/فقه|أحكام|جزية|خراج/.test(title)) return "الفقه";
  if (/عقيدة|توحيد|إيمان/.test(title)) return "العقيدة";
  if (/أخلاق|تزكية|قلب|صبر|شكر|محبة|روضة/.test(title)) return "الرقائق والأخلاق";
  if (/سيرة|تاريخ/.test(title)) return "السيرة";
  if (/حديث|سنة/.test(title)) return "علوم الحديث";
  return "متنوع";
}

function buildContentMap(pages: PageEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const page of pages) {
    for (const heading of page.headings) {
      const key = heading.trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? "") + (map.has(key) ? "\n\n" : "") + page.text);
    }
  }
  return map;
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

function readOptionalJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function hasLocalCoverFile(cover: BookCoverMetadata | undefined): cover is BookCoverMetadata {
  if (!cover?.coverImageUrl) return false;
  return existsSync(path.join(PUBLIC_DIR, cover.coverImageUrl.replace(/^\//, "")));
}

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

// ─── Seed a single book ───────────────────────────────────────────────────────

async function seedBook(extracted: ExtractedBook, colorIndex: number): Promise<void> {
  if (!extracted.index?.length || !extracted.pages?.length) {
    console.log(`  ⏭️  "${extracted.title}" — فهرس فارغ، تخطي`);
    return;
  }

  const category = inferCategory(extracted.title);
  const coverColor = COVER_COLORS[colorIndex % COVER_COLORS.length]!;
  const edition = extractEdition(extracted.title);
  const coverCandidate = coversBySourceId.get(extracted.source_id) ?? coversBySlug.get(extracted.id);
  const cover = hasLocalCoverFile(coverCandidate) ? coverCandidate : undefined;

  // Check if book already exists
  const existing = await db
    .select({ id: booksTable.id })
    .from(booksTable)
    .where(eq(booksTable.titleAr, extracted.title))
    .limit(1);

  let bookId: number;

  if (existing.length > 0) {
    bookId = existing[0]!.id;
    await db.delete(chaptersTable).where(eq(chaptersTable.bookId, bookId));
    await db.update(booksTable)
      .set({
        coverImageAlt: cover?.coverImageAlt ?? null,
        coverImageUrl: cover?.coverImageUrl ?? null,
        editionLabel: edition.editionLabel ?? null,
        pageCount: extracted.pages.length,
        publisher: cover?.publisher ?? edition.publisher ?? null,
      })
      .where(eq(booksTable.id, bookId));
  } else {
    const [inserted] = await db
      .insert(booksTable)
      .values({
        title: extracted.title,
        titleAr: extracted.title,
        description: `من مؤلفات الإمام ابن قيم الجوزية رحمه الله. المصدر: turath.io`,
        category,
        coverColor,
        coverImageAlt: cover?.coverImageAlt ?? null,
        coverImageUrl: cover?.coverImageUrl ?? null,
        pageCount: extracted.pages.length,
        publisher: cover?.publisher ?? edition.publisher ?? null,
        editionLabel: edition.editionLabel ?? null,
      })
      .returning({ id: booksTable.id });
    bookId = inserted!.id;
  }

  const contentMap = buildContentMap(extracted.pages);

  // parentStack: level → last inserted chapter id at that level
  const parentStack = new Map<number, number>();

  for (let i = 0; i < extracted.index.length; i++) {
    const entry = extracted.index[i]!;
    const level = Math.min(entry.level, 4);

    let parentId: number | null = null;
    for (let l = level - 1; l >= 1; l--) {
      if (parentStack.has(l)) {
        parentId = parentStack.get(l)!;
        break;
      }
    }

    const content = contentMap.get(entry.title) ?? "";

    const [row] = await db
      .insert(chaptersTable)
      .values({
        bookId,
        title: entry.title,
        titleAr: entry.title,
        content,
        orderIndex: i,
        level,
        parentId,
      })
      .returning({ id: chaptersTable.id });

    const newId = row!.id;

    // Clear all stacks at this level and below (they no longer apply as ancestors)
    for (const key of parentStack.keys()) {
      if (key >= level) parentStack.delete(key);
    }
    parentStack.set(level, newId);
  }

  console.log(`  ✅  "${extracted.title}" — ${extracted.index.length} مدخل`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("   زرع قاعدة البيانات من ملفات JSON المستخرجة           ");
  console.log("═══════════════════════════════════════════════════════\n");

  const indexPath = path.join(OUTPUT_DIR, "index.json");
  const bookIndex: { books: Array<{ file: string; title: string }> } =
    JSON.parse(readFileSync(indexPath, "utf-8"));

  console.log(`📚 عدد الكتب في الفهرس: ${bookIndex.books.length}\n`);

  let succeeded = 0;
  let skipped = 0;

  for (let i = 0; i < bookIndex.books.length; i++) {
    const entry = bookIndex.books[i]!;
    const filePath = path.join(OUTPUT_DIR, entry.file);

    let extracted: ExtractedBook;
    try {
      extracted = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      console.log(`  ⚠️  "${entry.title}" — فشل قراءة الملف`);
      skipped++;
      continue;
    }

    try {
      await seedBook(extracted, i);
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌  "${entry.title}": ${msg}`);
      skipped++;
    }
  }

  await pool.end();

  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`✅ نجح: ${succeeded} كتاب`);
  console.log(`⏭️  تخطي/فشل: ${skipped} كتاب`);
  console.log("═══════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("خطأ فادح:", err);
  process.exit(1);
});
