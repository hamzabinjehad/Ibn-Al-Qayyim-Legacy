/**
 * Enrich existing ibn-qayyim JSON files with footnote content from the Shamela
 * Lucene index (extracted via extract_shamela.groovy).
 *
 * Input:  C:/Users/hamza/AppData/Local/Temp/shamela_footnotes.json
 * Source: scripts/output/ibn-qayyim/**\/*.json
 * SQLite: C:/shamela4/database/book/{id}/{id}.db
 * Master: C:/shamela4/database/master.db
 *
 * The script appends footnote text to each page's `text` field using the
 * standard `_________` separator, so splitPageFootnotes() can parse it.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import initSqlJs from "sql.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LuceneRecord {
  book: number;
  page: number; // = SQLite id for this book
  id: string;
  foot: string;
}

interface SqlitePageRow {
  id: number;
  part: string;
  page: number;
}

interface JsonPage {
  text: string;
  page: number;
}

interface JsonJuz {
  الجزء: string;
  الصفحات: JsonPage[];
}

interface JsonBook {
  العنوان: string;
  القسم: string;
  البيانات: string;
  الأجزاء: JsonJuz[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LUCENE_JSON = "C:/Users/hamza/AppData/Local/Temp/shamela_footnotes.json";
const MASTER_DB = "C:/shamela4/database/master.db";
const BOOK_DB_DIR = "C:/shamela4/database/book";
const SOURCE_DIR = join(process.cwd(), "output", "ibn-qayyim");

// Map Arabic ordinal juz names → SQLite numeric part names
const ORDINAL_TO_NUM: Record<string, string> = {
  "الجزء الأول": "1",
  "الجزء الثاني": "2",
  "الجزء الثالث": "3",
  "الجزء الرابع": "4",
  "الجزء الخامس": "5",
  "الجزء السادس": "6",
  "الجزء السابع": "7",
  "الجزء الثامن": "8",
  "الجزء التاسع": "9",
  "الجزء العاشر": "10",
  "الجزء الحادي عشر": "11",
  "الجزء الثاني عشر": "12",
};

function normalizeJuzName(juzName: string): string {
  return ORDINAL_TO_NUM[juzName] ?? juzName;
}

// Strip HTML tags from foot content, preserve basic structure
function stripFootHtml(html: string): string {
  return html
    .replace(/<span\b[^>]*data-type=["']title["'][^>]*>([\s\S]*?)<\/span>/gi, "\n$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
}

// Convert (¬N) footnote markers to (N) with ASCII digits
// ¬١ → 1, ¬٢ → 2, etc.
const ARABIC_INDIC_DIGIT: Record<string, string> = {
  "٠": "0","١": "1","٢": "2","٣": "3","٤": "4",
  "٥": "5","٦": "6","٧": "7","٨": "8","٩": "9",
};

function normalizeFootnoteMarkers(text: string): string {
  return text.replace(/\(¬([٠-٩]+)\)/g, (_m, digits: string) => {
    const ascii = [...digits].map((d) => ARABIC_INDIC_DIGIT[d] ?? d).join("");
    return `(${ascii})`;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Loading Lucene footnotes...");
  const luceneData: LuceneRecord[] = JSON.parse(readFileSync(LUCENE_JSON, "utf-8"));

  // Build map: bookId → Map<sqlite_id, foot>
  const luceneMap = new Map<number, Map<number, string>>();
  for (const rec of luceneData) {
    if (!luceneMap.has(rec.book)) luceneMap.set(rec.book, new Map());
    luceneMap.get(rec.book)!.set(rec.page, rec.foot);
  }
  console.log(`Loaded ${luceneData.length} Lucene records for ${luceneMap.size} books.`);

  // Load SQLite
  const SQL = await initSqlJs();

  // Load master.db: book_name → book_id
  const masterDb = new SQL.Database(new Uint8Array(readFileSync(MASTER_DB)));
  const masterRows = masterDb.exec(
    "SELECT b.book_id, b.book_name FROM book b JOIN author_book ab ON b.book_id = ab.book_id WHERE ab.author_id = 14"
  );
  const nameToId = new Map<string, number>();
  for (const [id, name] of masterRows[0]?.values ?? []) {
    nameToId.set(String(name), Number(id));
  }
  console.log(`Loaded ${nameToId.size} book name mappings.`);

  // Process all JSON files
  let filesProcessed = 0;
  let filesEnriched = 0;
  let totalFootnotesAdded = 0;

  function processDir(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        processDir(full);
      } else if (
        entry.name.endsWith(".json") &&
        !entry.name.includes("index") &&
        !entry.name.includes("Deutsch") &&
        !entry.name.includes(".progress.")
      ) {
        processFile(full);
      }
    }
  }

  function processFile(filePath: string) {
    const fileName = basename(filePath, extname(filePath));
    filesProcessed++;

    // Match file name to Shamela book ID
    const bookId = nameToId.get(fileName);
    if (!bookId) {
      return; // No matching Shamela book
    }

    const footMap = luceneMap.get(bookId);
    if (!footMap || footMap.size === 0) {
      return; // No footnotes for this book
    }

    // Load the book's SQLite for (part, page) → sqlite_id mapping
    const dbPath = join(BOOK_DB_DIR, String(bookId % 1000).padStart(0), `${bookId}`, `${bookId}.db`);
    const actualDbPath = findDbPath(bookId);
    if (!actualDbPath) {
      console.warn(`  No SQLite found for book ${bookId} (${fileName})`);
      return;
    }

    const bookDb = new SQL.Database(new Uint8Array(readFileSync(actualDbPath)));
    const rows = bookDb.exec("SELECT id, part, page FROM page ORDER BY id");
    bookDb.close();

    // Build lookup: `part|page` → sqlite_id
    const pageToId = new Map<string, number>();
    for (const [id, part, page] of rows[0]?.values ?? []) {
      pageToId.set(`${part}|${page}`, Number(id));
    }

    // Enrich the JSON file
    const json: JsonBook = JSON.parse(readFileSync(filePath, "utf-8"));
    let footnoteCount = 0;
    let changed = false;

    for (const juz of json["الأجزاء"]) {
      const sqlitePart = normalizeJuzName(juz["الجزء"]);

      for (const page of juz["الصفحات"]) {
        // Skip if already has footnotes
        if (page.text.includes("_________")) continue;

        // Fallback to "null" part for single-volume books where SQLite stores NULL
        const sqliteId = pageToId.get(`${sqlitePart}|${page.page}`)
          ?? pageToId.get(`null|${page.page}`);
        if (sqliteId === undefined) continue;

        const rawFoot = footMap.get(sqliteId) ?? "";
        if (!rawFoot.trim()) continue;

        const cleanFoot = normalizeFootnoteMarkers(stripFootHtml(rawFoot));
        if (!cleanFoot) continue;

        page.text = `${page.text}\n_________\n${cleanFoot}`;
        footnoteCount++;
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(filePath, JSON.stringify(json, null, 2), "utf-8");
      filesEnriched++;
      totalFootnotesAdded += footnoteCount;
      console.log(`  ✅ ${fileName}: +${footnoteCount} footnoted pages`);
    }
  }

  function findDbPath(bookId: number): string | null {
    // Try to find the SQLite in the book directory structure
    const subdir = String(bookId).slice(-3);
    const candidates = [
      join(BOOK_DB_DIR, subdir, `${bookId}.db`),
      join(BOOK_DB_DIR, String(bookId), `${bookId}.db`),
    ];

    // Also scan subdirectories since Shamela uses last 3 digits
    try {
      const dirs = readdirSync(BOOK_DB_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);

      for (const d of dirs) {
        const candidate = join(BOOK_DB_DIR, d, `${bookId}.db`);
        try {
          readFileSync(candidate); // throws if not found
          return candidate;
        } catch {}
      }
    } catch {}
    return null;
  }

  processDir(SOURCE_DIR);

  console.log(`\n═══════════════════════════════════════`);
  console.log(`Files processed:  ${filesProcessed}`);
  console.log(`Files enriched:   ${filesEnriched}`);
  console.log(`Footnotes added:  ${totalFootnotesAdded}`);
  console.log(`═══════════════════════════════════════`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
