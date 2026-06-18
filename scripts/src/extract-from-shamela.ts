/**
 * Extract Ibn Al-Qayyim's books from shamela.ws with full footnote content.
 *
 * Required env vars:
 *   SHAMELA_API_KEY        - API key from dev.shamela.ws
 *   SHAMELA_BOOKS_ENDPOINT - Books metadata endpoint URL
 *   SHAMELA_MASTER_ENDPOINT - Master database endpoint URL
 *
 * Output: output/shamela/<slug>.json  (same structure as turath output)
 */

import {
  configure,
  getMaster,
  getBook,
  splitPageBodyFromFooter,
  mapPageCharacterContent,
  removeArabicNumericPageMarkers,
  stripHtmlTags,
} from "shamela";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const OUTPUT_DIR = join(process.cwd(), "output", "shamela");
const SLEEP_BETWEEN_BOOKS = 3000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function slugify(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^؀-ۿa-zA-Z0-9-]/g, "")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
}

// Convert shamela body HTML → plain text, preserving [[H:...]] heading markers.
// Mirrors the stripHtml() in extract-ibn-qayyim.ts, with extra shamela pre-processing.
function stripBodyHtml(html: string): string {
  const mapped = mapPageCharacterContent(html);
  const noPageMarkers = removeArabicNumericPageMarkers(mapped);

  const withHeadings = noPageMarkers.replace(
    /<span\b[^>]*data-type=["']title["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_match, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      return text ? `\n[[H:${text}]]\n` : "\n";
    },
  );

  return withHeadings
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|h[1-6]|li|tr|span)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Convert shamela footer HTML → plain numbered footnote text.
// The frontend splitPageFootnotes() can then parse it back.
function stripFooterHtml(html: string): string {
  const mapped = mapPageCharacterContent(html);
  return stripHtmlTags(mapped)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

interface ExtractedPage {
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
  pages: ExtractedPage[];
  extracted_at: string;
}

async function extractBook(
  bookId: number,
  bookName: string,
  outPath: string,
): Promise<{ pages: number; pagesWithFootnotes: number }> {
  const bookData = await getBook(bookId);
  const pages: ExtractedPage[] = [];
  let pagesWithFootnotes = 0;

  for (const page of bookData.pages) {
    const [bodyHtml, footerHtml] = splitPageBodyFromFooter(page.content);

    const bodyText = stripBodyHtml(bodyHtml);
    const footerText = footerHtml.trim() ? stripFooterHtml(footerHtml) : "";

    const text = footerText ? `${bodyText}\n_________\n${footerText}` : bodyText;

    if (footerText) pagesWithFootnotes++;

    pages.push({
      page_num: page.page ?? 0,
      vol: page.part ?? "1",
      headings: [],
      text,
    });
  }

  const output: ExtractedBook = {
    id: slugify(bookName) || `book-${bookId}`,
    title: bookName,
    author: "ابن قيم الجوزية",
    source: "shamela.ws",
    source_id: bookId,
    pages,
    extracted_at: new Date().toISOString(),
  };

  await writeFile(outPath, JSON.stringify(output, null, 2), "utf-8");
  return { pages: pages.length, pagesWithFootnotes };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("   استخراج كتب ابن القيم الجوزية من موقع الشاملة      ");
  console.log("═══════════════════════════════════════════════════════\n");

  if (!process.env.SHAMELA_API_KEY || !process.env.SHAMELA_BOOKS_ENDPOINT || !process.env.SHAMELA_MASTER_ENDPOINT) {
    console.error("❌ المتغيرات المطلوبة غير معيَّنة. يرجى تعيين:");
    console.error("   SHAMELA_API_KEY");
    console.error("   SHAMELA_BOOKS_ENDPOINT");
    console.error("   SHAMELA_MASTER_ENDPOINT");
    console.error("\n   احصل على مفتاح API من: dev.shamela.ws أو بالتواصل مع mail@shamela.ws");
    process.exit(1);
  }

  configure({
    apiKey: process.env.SHAMELA_API_KEY,
    booksEndpoint: process.env.SHAMELA_BOOKS_ENDPOINT,
    masterPatchEndpoint: process.env.SHAMELA_MASTER_ENDPOINT,
  });

  await mkdir(OUTPUT_DIR, { recursive: true });

  // ─── Step 1: Download master database ─────────────────────────────────────
  console.log("📥 تحميل قاعدة بيانات الشاملة الرئيسية...");
  const master = await getMaster();
  console.log(`   ✅ ${master.authors.length} مؤلف، ${master.books.length} كتاب\n`);

  // ─── Step 2: Find Ibn Al-Qayyim's author IDs ──────────────────────────────
  const ibnQayyimAuthors = master.authors.filter(
    (a) => a.name.includes("ابن قيم") || a.name.includes("ابن القيم"),
  );

  if (ibnQayyimAuthors.length === 0) {
    throw new Error("لم يُعثر على ابن القيم في قاعدة البيانات");
  }

  console.log("👤 المؤلفون المُعثور عليهم:");
  for (const author of ibnQayyimAuthors) {
    console.log(`   - [${author.id}] ${author.name} (ت ${author.death_number})`);
  }
  console.log();

  const authorIds = new Set(ibnQayyimAuthors.map((a) => String(a.id)));

  // ─── Step 3: Filter books by author ───────────────────────────────────────
  const ibnQayyimBooks = master.books.filter((book) => {
    const ids = book.author
      .split(/[, ]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.some((id) => authorIds.has(id));
  });

  console.log(`📚 ${ibnQayyimBooks.length} كتاب لابن القيم الجوزية\n`);

  const succeeded: { id: string; title: string; source_id: number; pages: number }[] = [];
  const failed: { id: number; title: string; error: string }[] = [];

  // ─── Step 4: Extract each book ────────────────────────────────────────────
  for (let i = 0; i < ibnQayyimBooks.length; i++) {
    const book = ibnQayyimBooks[i]!;
    const idx = i + 1;
    const slug = slugify(book.name) || `book-${book.id}`;
    const outPath = join(OUTPUT_DIR, `${slug}.json`);

    console.log(`\n[${idx}/${ibnQayyimBooks.length}] 📖 "${book.name}" (id=${book.id})`);

    if (existsSync(outPath)) {
      console.log(`   ⏭  موجود مسبقاً، تخطي`);
      try {
        const raw = JSON.parse(await readFile(outPath, "utf-8")) as ExtractedBook;
        succeeded.push({ id: slug, title: book.name, source_id: book.id, pages: raw.pages?.length ?? 0 });
      } catch {}
      continue;
    }

    try {
      const { pages, pagesWithFootnotes } = await extractBook(book.id, book.name, outPath);
      succeeded.push({ id: slug, title: book.name, source_id: book.id, pages });
      console.log(`   ✅ ${pages} صفحة (${pagesWithFootnotes} تحتوي حواشٍ)`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ فشل: ${error}`);
      failed.push({ id: book.id, title: book.name, error });
    }

    if (idx < ibnQayyimBooks.length) await sleep(SLEEP_BETWEEN_BOOKS);
  }

  // ─── Step 5: Write summary index ──────────────────────────────────────────
  await writeFile(
    join(OUTPUT_DIR, "index.json"),
    JSON.stringify(
      {
        author: "ابن قيم الجوزية",
        source: "shamela.ws",
        extracted_at: new Date().toISOString(),
        books_count: succeeded.length,
        books: succeeded.map(({ id, title, source_id, pages }) => ({
          id,
          title,
          source_id,
          pages,
          file: `${id}.json`,
        })),
        failed,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`✅ الكتب المستخرجة: ${succeeded.length}`);
  if (failed.length > 0) console.log(`❌ الكتب الفاشلة:   ${failed.length}`);
  console.log(`📂 المخرجات في:    ${OUTPUT_DIR}`);
  console.log(`═══════════════════════════════════════════════════════`);
}

main().catch((err) => {
  console.error("خطأ فادح:", err);
  process.exit(1);
});
