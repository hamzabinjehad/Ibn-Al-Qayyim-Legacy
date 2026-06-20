/**
 * extract-quotes.ts
 *
 * Extracts quality standalone quotes from Ibn al-Qayyim's books
 * stored in the local library-data JSON files — no external AI API needed.
 *
 * Usage:  cd scripts && pnpm tsx src/extract-quotes.ts
 * Output: artifacts/ibn-al-qayyim/src/lib/daily-quote.ts
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIB_DIR = path.resolve(__dirname, "../../artifacts/ibn-al-qayyim/public/library-data/ar");
const OUT_FILE = path.resolve(__dirname, "../../artifacts/ibn-al-qayyim/src/lib/daily-quote.ts");

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkMeta { id: number; titleAr: string; }
interface EditionPage { text: string; sectionId?: number; workId?: number; }
interface PagePart { file: string; }
interface EditionData {
  id: number; workId: number; workTitleAr?: string; languageCode: string;
  pages?: EditionPage[]; pageParts?: PagePart[];
}
interface Quote { text: string; source: string; }

// ── Text cleaning ─────────────────────────────────────────────────────────────

// Arabic tashkeel / diacritics range
const RE_TASHKEEL = /[ً-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g;

function clean(raw: string): string {
  return raw
    .replace(/\[\[H:[^\]]*\]\]/g, " ")    // [[H:heading]]
    .replace(/\[\[[^\]]*\]\]/g, " ")       // [[any tag]]
    .replace(/\(\([^)]*\)\)/g, " ")        // ((sub-heading))
    .replace(/\{[^}]{0,150}\}/g, " ")      // {Quranic verse}
    .replace(/\[[^\]]{0,8}\]/g, " ")       // [244/ب] [1/أ] [ب] short bracket refs
    .replace(/\([^؀-ۿ][^)]{0,6}\)/g, " ") // (1) (a) footnote markers
    .replace(/\([أ-ي](?:[،,]\s*[أ-ي])?\)\s*:?/g, " ") // (ب) (ب، ج): manuscript copy refs
    .replace(/«[^»]{0,80}»/g, " ")
    .replace(/_+/g, " ")                   // _____ separator lines
    .replace(RE_TASHKEEL, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Quality filters ───────────────────────────────────────────────────────────

const REJECT_PATTERNS: RegExp[] = [
  // Hadith and citation markers
  /رواه/,
  /أخرجه/,
  /وروى/,
  /حدثنا/,
  /أخبرنا/,
  /أسنده/,
  /\bسنده\b/,
  /\bإسناده\b/,
  /صححه|حسّنه|ضعّفه/,
  /الترمذي|البخاري|مسلم\b|أبو داود|النسائي|ابن ماجه|الطبراني|الدارمي|الحاكم/,
  /ابن حبان|ابن خزيمة|ابن حجر/,
  /الألباني|السيوطي|العسقلاني/,
  /صحّحه|حسّنه|ضعّفه|ضعفه|صححه/,  // hadith grading verbs
  /صلى الله عليه وسلم/,
  /جبريل|جبرائيل/,                  // often appear in hadith narrations
  // Attribution / bibliographic / manuscript references
  /^قال[^\w]/,
  /^قوله/,
  /^انظر/,
  /^راجع/,
  /^ينظر/,
  /^المصدر/,
  /^المرجع/,
  /^انتهى/,
  /^قلت:?/,          // author's interjection "قلت:"
  /^في الأصل/,       // manuscript comparison notes
  /المطبوع|المخطوط/,  // manuscript references
  /المجروحين/,
  /^الجزء/,
  /^الباب/,
  /^الفصل/,
  /^فصل[\s:]/,       // chapter dividers (note: \b doesn't work for Arabic in JS)
  /^الفرع/,
  /^المسألة/,
  /^مسألة/,
  /^الوجه\s/,        // "الوجه الثالث والعشرون:" argument-point markers
  /^تنبيه/,
  /^فائدة\s/,
  // Quranic verse citations (we want Ibn al-Qayyim's own words)
  /قال تعالى/,
  /قوله تعالى/,
  // Manuscript / editorial / textual-criticism references
  /خطية|نسخة\s*خطية|نسخ\s*خطية/,
  /كذا في/,
  /^في [أبجدهوز]\s/,       // "في ج (..." manuscript copy reference
  /^الأصول\s/,
  /محفوظات\s*مكتبة|برقم\s*\d/,
  /المكتبة العامة|المكتبة الوطنية|المكتبة السعودية/,
  /صورة الصفحة|من النسخة/,
  /ص\/\s*\d|ص\s*\d{2,}/,
  // Explanatory / commentary markers
  /^يعني:/,
  /^أي:/,
  // Ordinal list items
  /^(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)\s*:/,
  /^(أولا|ثانيا|ثالثا|رابعا|خامسا)\s*:/,
  // Scientific / hadith-science terms
  /\bإسناد\b/,
  /\bالإسناد\b/,
  /\bصحيح\b/,
  /\bضعيف\b/,
  /\bحسن\b.*\bإسناد/,
  // Arabic grammar analysis terms (linguistics context)
  /\bمرفوع\b.*\bمنصوب\b|\bمنصوب\b.*\bمرفوع\b/,
  /\bالمبتدأ\b.*\bالخبر\b/,
  // Numeric list items
  /^\d+[–\-\.\)]/,
  /^[١٢٣٤٥٦٧٨٩]\s*[-–\.\)]/,
  // Lingering markers after cleaning
  /\(\s*\d+\s*\)/,
  /\[\d/,
  /تحقيق/,
];

// Sentence fragments that start mid-thought
const RE_CONNECTIVE = new RegExp(
  "^(" + [
    "وم", "وف", "وق", "وأ", "وإ", "وك", "وه", "وت", "وع", "وذ", "وب",
    "فق", "فإ", "فه", "فأ", "فك", "فل", "فع",
    "ثم ", "بل ", "لكن ", "وهذا ", "وذلك ", "وهو ", "وهي ", "وهم ",
    "كذلك ", "ولهذا ", "ولذلك ", "ولما ", "ومما ", "وما ", "ومن ",
    "وإذ", "كما ", "أيضا ", "أي ",
    "إلا ", "إلا ان", "غير ان",  // "إلا" at sentence start = fragment
  ].join("|") + ")",
);

function isGoodQuote(s: string): boolean {
  if (s.length < 65 || s.length > 255) return false;

  // Must be mostly Arabic
  const arabicCount = (s.match(/[؀-ۿ]/g) ?? []).length;
  if (arabicCount / s.length < 0.72) return false;

  // Leftover braces / page refs from cleaning
  if (/[{}]/.test(s)) return false;
  if (/\[\d/.test(s)) return false;

  if (REJECT_PATTERNS.some((r) => r.test(s))) return false;
  if (RE_CONNECTIVE.test(s)) return false;

  // Too many digits
  if ((s.match(/[٠-٩۰-۹0-9]/g) ?? []).length > 4) return false;

  // Should end with sentence-closing punctuation
  if (!/[.؟!]$/.test(s)) return false;

  // Avoid highly repetitive text
  const words = s.split(/\s+/);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  if (Math.max(...freq.values()) > 4) return false;

  return true;
}

// ── Sentence splitting ────────────────────────────────────────────────────────

function splitParagraph(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.؟!])\s+(?=[^\d٠-٩])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Seeded shuffle (reproducible output) ─────────────────────────────────────

function seededShuffle<T>(array: T[], seed: number): T[] {
  let s = seed >>> 0;
  const rng = (): number => {
    s = (Math.imul(1_664_525, s) + 1_013_904_223) >>> 0;
    return s / 4_294_967_296;
  };
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]] as [T, T];
  }
  return array;
}

// ── Per-edition processing ────────────────────────────────────────────────────

function extractFromPages(pages: EditionPage[], workTitle: string): Quote[] {
  const quotes: Quote[] = [];
  for (const page of pages) {
    const raw = page.text;
    if (!raw || typeof raw !== "string") continue;
    if (raw.startsWith("[[H:")) continue;
    // Skip pages dominated by Quranic verses
    if ((raw.match(/\{/g) ?? []).length > 2) continue;

    const paragraph = clean(raw);
    if (paragraph.length < 68) continue;

    for (const s of splitParagraph(paragraph)) {
      if (isGoodQuote(s)) quotes.push({ text: s, source: workTitle });
    }
  }
  return quotes;
}

function loadEditionPages(data: EditionData): EditionPage[] {
  if (Array.isArray(data.pages) && data.pages.length > 0) return data.pages;
  const pages: EditionPage[] = [];
  if (Array.isArray(data.pageParts)) {
    for (const part of data.pageParts) {
      const partPath = path.join(LIB_DIR, "edition-pages", part.file);
      if (existsSync(partPath)) {
        const partData = JSON.parse(readFileSync(partPath, "utf8")) as EditionPage[];
        if (Array.isArray(partData)) pages.push(...partData);
      }
    }
  }
  return pages;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log("Loading works metadata …");
  const works = JSON.parse(readFileSync(path.join(LIB_DIR, "works.json"), "utf8")) as WorkMeta[];
  const worksById = new Map(works.map((w) => [w.id, w.titleAr]));

  const editionsDir = path.join(LIB_DIR, "editions");
  const editionFiles = readdirSync(editionsDir)
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => parseInt(a) - parseInt(b));

  const quotesByWork = new Map<string, Quote[]>();

  for (const file of editionFiles) {
    let data: EditionData;
    try {
      data = JSON.parse(readFileSync(path.join(editionsDir, file), "utf8")) as EditionData;
    } catch (e) {
      console.warn(`  ✗ ${file}: ${(e as Error).message}`);
      continue;
    }
    if (data.languageCode !== "ar") continue;

    const workTitle = worksById.get(data.workId) ?? data.workTitleAr;
    if (!workTitle) continue;

    const pages = loadEditionPages(data);
    const quotes = extractFromPages(pages, workTitle);

    if (!quotesByWork.has(workTitle)) quotesByWork.set(workTitle, []);
    quotesByWork.get(workTitle)!.push(...quotes);

    const total = quotesByWork.get(workTitle)!.length;
    const name  = workTitle.slice(0, 36).padEnd(36);
    console.log(`  ✓ ${name} — ${pages.length} pages → ${quotes.length} quotes  (total: ${total})`);
  }

  // Books known for wisdom/spiritual content get a higher quota
  const PREFERRED_WORKS = new Set([
    "مدارج السالكين",
    "الفوائد لابن القيم",
    "الوابل الصيب",
    "الداء والدواء",
    "إغاثة اللهفان في مصايد الشيطان",
    "روضة المحبين ونزهة المشتاقين",
    "حادي الأرواح إلى بلاد الأفراح",
    "طريق الهجرتين وباب السعادتين",
    "عدة الصابرين وذخيرة الشاكرين",
    "بدائع الفوائد",
    "مفتاح دار السعادة ومنشور ولاية العلم والإرادة",
    "الروح",
    "رسالة ابن القيم إلى أحد إخوانه",
    "الرسالة التبوكية زاد المهاجر إلى ربه",
    "صفات المنافقين",
  ]);

  const MAX_PREFERRED  = 50;
  const MAX_OTHER      = 15;

  const balanced: Quote[] = [];
  for (const [workTitle, quotes] of quotesByWork) {
    const cap = PREFERRED_WORKS.has(workTitle) ? MAX_PREFERRED : MAX_OTHER;
    seededShuffle(quotes, 42);
    balanced.push(...quotes.slice(0, cap));
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = balanced.filter((q) => {
    if (seen.has(q.text)) return false;
    seen.add(q.text);
    return true;
  });

  seededShuffle(unique, 137);

  // Summary
  console.log(`\nTotal unique quotes: ${unique.length}  (from ${quotesByWork.size} works)`);
  console.log("\n── Sample ───────────────────────────────────────────────────────");
  unique.slice(0, 10).forEach((q, i) => {
    console.log(`\n[${i + 1}] ${q.source}`);
    console.log(`    ${q.text}`);
  });
  console.log("\n─────────────────────────────────────────────────────────────────");

  // ── TypeScript output ──────────────────────────────────────────────────────
  const output = `// AUTO-GENERATED by scripts/src/extract-quotes.ts
// To refresh: cd scripts && pnpm tsx src/extract-quotes.ts
export interface DailyQuote {
  text: string;
  source: string;
}

const QUOTES: DailyQuote[] = ${JSON.stringify(unique, null, 2)};

export function getDailyQuote(): DailyQuote {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]!;
}
`;

  writeFileSync(OUT_FILE, output, "utf8");
  console.log(`\nWritten ${unique.length} quotes → ${OUT_FILE}`);
}

main();
