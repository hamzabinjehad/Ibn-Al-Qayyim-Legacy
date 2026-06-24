import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getBookInfo, search } from "turath-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, "../output/ibn-qayyim");
const OUTPUT_FILE = path.resolve(__dirname, "../data/book-indexes.json");
const AR_TITLE = "\u0627\u0644\u0639\u0646\u0648\u0627\u0646";
const AR_PARTS = "\u0627\u0644\u0623\u062c\u0632\u0627\u0621";
const DEFAULT_AUTHOR_ID = 14;
const SLEEP_BETWEEN_REQUESTS = 250;

interface SourceIndexBook {
  file: string;
  source_id?: number;
  title: string;
}

interface SourceIndex {
  author_id?: number;
  books?: SourceIndexBook[];
}

interface CandidateBook {
  file: string;
  sourceId?: number;
  title: string;
}

interface PageRef {
  logicalPage: number;
  printPage?: number;
  raw?: string;
  volume?: string;
}

interface BookIndexHeading {
  level?: number;
  page: number;
  pageRef?: string;
  printPage?: number;
  printVolume?: string;
  title: string;
}

interface ExtractedBookIndex {
  extractedAt: string;
  headings: BookIndexHeading[];
  pageRefs: PageRef[];
  source: "turath.io";
  sourceFile?: string;
  sourceId: number;
  title: string;
  volumes: string[];
}

interface BookIndexesFile {
  books: ExtractedBookIndex[];
  extractedAt: string;
  failed: Array<{ error: string; file?: string; sourceId?: number; title: string }>;
  source: "turath.io";
  unresolved: Array<{ file: string; title: string }>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readOptionalJson<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return readJson<T>(filePath);
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectJsonFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir).sort((a, b) => a.localeCompare(b, "ar"))) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectJsonFiles(fullPath));
    } else if (entry.endsWith(".json") && !entry.endsWith(".progress.json") && entry !== "index.json") {
      files.push(fullPath);
    }
  }
  return files;
}

function stripArabicMarks(value: string) {
  return value.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, "");
}

function normalizeArabicTitle(value: string) {
  return stripArabicMarks(value.normalize("NFKD"))
    .replace(/[\u0625\u0623\u0622\u0671\u0627]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function titleKey(value: string) {
  return normalizeArabicTitle(value);
}

function stripEdition(title: string): string {
  return title
    .replace(/\s*=\s*.+$/, "")
    .replace(/\s+-\s+[\u0637\u062A]\s+.+$/u, "")
    .replace(/\s+-\s+.+$/, "")
    .trim();
}

function toWesternDigits(value: string) {
  return value
    .replace(/[\u0660-\u0669]/gu, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/gu, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

function parsePageRef(raw: unknown, logicalPage: number): PageRef {
  if (typeof raw !== "string") return { logicalPage };
  const [volumeRaw, pageRaw] = raw.split(",");
  const printPageText = pageRaw ? toWesternDigits(pageRaw).match(/\d+/u)?.[0] : undefined;
  const printPage = printPageText ? Number(printPageText) : undefined;
  return {
    logicalPage,
    printPage: Number.isFinite(printPage) ? printPage : undefined,
    raw,
    volume: volumeRaw?.trim() || undefined,
  };
}

function candidateTitle(raw: Record<string, unknown>): string | undefined {
  const title = raw.title ?? raw[AR_TITLE];
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}

function candidateSourceId(raw: Record<string, unknown>): number | undefined {
  const sourceId = raw.source_id;
  return typeof sourceId === "number" && Number.isFinite(sourceId) && sourceId > 0 ? sourceId : undefined;
}

function loadCandidates(index: SourceIndex): CandidateBook[] {
  const indexedByTitle = new Map<string, SourceIndexBook>();
  for (const book of index.books ?? []) {
    indexedByTitle.set(titleKey(book.title), book);
  }

  const candidatesByTitle = new Map<string, CandidateBook>();
  for (const filePath of collectJsonFiles(SOURCE_DIR)) {
    const raw = readOptionalJson<Record<string, unknown> | null>(filePath, null);
    if (!raw) continue;
    if (!Array.isArray(raw.pages) && !Array.isArray(raw[AR_PARTS])) continue;

    const title = candidateTitle(raw);
    if (!title) continue;
    const indexed = indexedByTitle.get(titleKey(title));
    const candidate: CandidateBook = {
      file: path.relative(SOURCE_DIR, filePath),
      sourceId: candidateSourceId(raw) ?? indexed?.source_id,
      title,
    };
    candidatesByTitle.set(titleKey(title), candidate);
  }

  return Array.from(candidatesByTitle.values()).sort((a, b) => a.title.localeCompare(b.title, "ar"));
}

async function resolveSourceIdFromSearch(title: string, authorId: number): Promise<number | undefined> {
  const desired = titleKey(title);
  const queries = Array.from(new Set([stripEdition(title), title].filter((value) => value.length >= 3)));

  for (const query of queries) {
    for (let page = 1; page <= 3; page++) {
      const result = await search(query, { author: authorId, page });
      const match = result.data.find((item) => titleKey(item.meta.book_name) === desired);
      if (match?.book_id) return match.book_id;
      if (result.data.length < 10) break;
      await sleep(SLEEP_BETWEEN_REQUESTS);
    }
  }

  return undefined;
}

async function extractIndex(candidate: CandidateBook): Promise<ExtractedBookIndex> {
  if (!candidate.sourceId) throw new Error("Missing source_id");
  const info = await getBookInfo(candidate.sourceId);
  const pageRefs = (info.indexes.page_map ?? []).map((raw, index) => parsePageRef(raw, index + 1));
  const headings = (info.indexes.headings ?? []).map((heading) => {
    const page = typeof heading.page === "number" ? heading.page : Number(heading.page);
    const ref = pageRefs[page - 1];
    return {
      level: typeof heading.level === "number" ? heading.level : undefined,
      page,
      pageRef: ref?.raw,
      printPage: ref?.printPage,
      printVolume: ref?.volume,
      title: heading.title,
    } satisfies BookIndexHeading;
  });

  return {
    extractedAt: new Date().toISOString(),
    headings,
    pageRefs,
    source: "turath.io",
    sourceFile: candidate.file,
    sourceId: candidate.sourceId,
    title: info.meta.name || candidate.title,
    volumes: info.indexes.volumes ?? [],
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    filter: valueAfter(args, "--filter"),
    limit: numberAfter(args, "--limit"),
    refresh: args.includes("--refresh"),
    resolveMissing: !args.includes("--no-resolve"),
  };
}

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function numberAfter(args: string[], name: string): number | undefined {
  const value = valueAfter(args, name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function main() {
  const args = parseArgs();
  const sourceIndex = readOptionalJson<SourceIndex>(path.join(SOURCE_DIR, "index.json"), {});
  const existing = readOptionalJson<BookIndexesFile>(OUTPUT_FILE, {
    books: [],
    extractedAt: "",
    failed: [],
    source: "turath.io",
    unresolved: [],
  });
  const existingBySourceId = new Map(existing.books.map((book) => [book.sourceId, book] as const));
  const authorId = sourceIndex.author_id ?? DEFAULT_AUTHOR_ID;

  let candidates = loadCandidates(sourceIndex);
  if (args.filter) {
    const filterKey = titleKey(args.filter);
    candidates = candidates.filter((candidate) => titleKey(candidate.title).includes(filterKey));
  }
  if (args.limit) candidates = candidates.slice(0, args.limit);

  const extracted: ExtractedBookIndex[] = args.refresh ? [] : [...existing.books];
  const extractedIds = new Set(extracted.map((book) => book.sourceId));
  const failed: BookIndexesFile["failed"] = [];
  const unresolved: BookIndexesFile["unresolved"] = [];

  console.log(`Found ${candidates.length} local source books.`);

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]!;

    if (!candidate.sourceId && args.resolveMissing) {
      candidate.sourceId = await resolveSourceIdFromSearch(candidate.title, authorId);
      if (candidate.sourceId) {
        console.log(`[${index + 1}/${candidates.length}] resolved ${candidate.sourceId}: ${candidate.title}`);
      }
      await sleep(SLEEP_BETWEEN_REQUESTS);
    }

    if (!candidate.sourceId) {
      unresolved.push({ file: candidate.file, title: candidate.title });
      console.log(`[${index + 1}/${candidates.length}] unresolved: ${candidate.title}`);
      continue;
    }

    if (!args.refresh && existingBySourceId.has(candidate.sourceId)) {
      console.log(`[${index + 1}/${candidates.length}] cached ${candidate.sourceId}: ${candidate.title}`);
      continue;
    }

    if (extractedIds.has(candidate.sourceId)) continue;

    try {
      const bookIndex = await extractIndex(candidate);
      extracted.push(bookIndex);
      extractedIds.add(candidate.sourceId);
      console.log(
        `[${index + 1}/${candidates.length}] extracted ${candidate.sourceId}: ${candidate.title} (${bookIndex.headings.length} headings)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ error: message, file: candidate.file, sourceId: candidate.sourceId, title: candidate.title });
      console.log(`[${index + 1}/${candidates.length}] failed ${candidate.sourceId}: ${message}`);
    }

    await sleep(SLEEP_BETWEEN_REQUESTS);
  }

  extracted.sort((a, b) => a.title.localeCompare(b.title, "ar"));
  writeJson(OUTPUT_FILE, {
    books: extracted,
    extractedAt: new Date().toISOString(),
    failed,
    source: "turath.io",
    unresolved,
  } satisfies BookIndexesFile);

  console.log(`Wrote ${extracted.length} extracted indexes to ${OUTPUT_FILE}`);
  if (unresolved.length) console.log(`Unresolved local books: ${unresolved.length}`);
  if (failed.length) console.log(`Failed extractions: ${failed.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
