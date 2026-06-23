/**
 * Imports Telegram-exported Ibn al-Qayyim quotes and links each quote to a
 * local library page.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run import-telegram-quotes
 *   pnpm --filter @workspace/scripts run import-telegram-quotes -- --input "C:/path/to/result.json"
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");
const LIB_DIR = path.join(
  ROOT_DIR,
  "artifacts/ibn-al-qayyim/public/library-data/ar",
);
const OUT_FILE = path.join(
  ROOT_DIR,
  "artifacts/ibn-al-qayyim/src/lib/daily-quote.ts",
);
const DEFAULT_TELEGRAM_DIR = "C:/Users/hamza/Downloads/Telegram Desktop";
const MIN_NORMALIZED_QUOTE_LENGTH = 18;
const PAGE_REF_SCORE = 150;
const EXACT_SCORE = 120;
const CHUNK_SCORE = 25;
const PREFERRED_EDITION_SCORE = 15;
const MIN_TEXT_MATCH_SCORE = 50;

interface TelegramTextEntity {
  text?: string;
}

interface TelegramMessage {
  date?: string;
  id: number;
  text?: string | Array<string | TelegramTextEntity>;
}

interface TelegramExport {
  messages?: TelegramMessage[];
  name?: string;
}

interface WorkSummary {
  id: number;
  titleAr: string;
}

interface EditionSummary {
  editionLabel?: string;
  id: number;
  languageCode?: string;
  titleAr: string;
  workId: number;
  workTitleAr: string;
}

interface EditionDetail extends EditionSummary {
  pageParts?: Array<{ file: string }>;
  pages?: PageDetail[];
}

interface PageDetail {
  id: number;
  pageNumber: number;
  sectionId: number | null;
  sourcePageNumber?: number;
  text: string;
}

interface NormalizedWork extends WorkSummary {
  normalizedTitle: string;
  tokens: Set<string>;
}

interface CandidateQuote {
  date?: string;
  messageId: number;
  normalizedQuote: string;
  pageRef?: PageRef;
  quote: string;
  sourceTitle?: string;
  tags: string[];
  workIds: number[];
}

interface PageRef {
  end: number;
  start: number;
}

interface IndexedPage {
  editionId: number;
  editionTitle: string;
  normalizedText: string;
  pageId: number;
  pageNumber: number;
  preferredEdition: boolean;
  sectionId: number | null;
  sourcePageNumber?: number;
  workId: number;
  workTitle: string;
}

interface MatchedQuote {
  text: string;
  href: string;
  source: string;
  pageNumber: number;
  sourcePageNumber?: number;
  workId: number;
  editionId: number;
  editionTitle: string;
  pageId: number;
  sectionId: number | null;
}

function repairMojibake(value: string): string {
  if (!/[ØÙÛ]/.test(value)) return value;
  return Buffer.from(value, "latin1").toString("utf8");
}

function readArg(name: string): string | undefined {
  const prefix = `${name}=`;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg) continue;
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === name) return process.argv[i + 1];
  }
  return undefined;
}

function decodeHtmlEntity(entity: string): string {
  if (entity.startsWith("#x") || entity.startsWith("#X")) {
    return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
  }
  if (entity.startsWith("#")) {
    return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
  }

  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    laquo: "«",
    lt: "<",
    nbsp: " ",
    quot: "\"",
    raquo: "»",
  };

  return named[entity] ?? `&${entity};`;
}

function htmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&([^;\s]+);/g, (_match, entity: string) => decodeHtmlEntity(entity))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textOf(message: TelegramMessage): string {
  const value = message.text;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part === "string" ? part : (part.text ?? "")))
      .join("");
  }
  return "";
}

function toLatinDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06F0-\u06F9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    );
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = toLatinDigits(value).replace(/\D/g, "");
  return normalized ? Number(normalized) : undefined;
}

function normalizeArabic(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, "")
    .replace(/[\u0625\u0623\u0622\u0627]/g, "\u0627")
    .replace(/\u0649/g, "\u064a")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064a")
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06F0-\u06F9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    )
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizedWords(value: string): string[] {
  return normalizeArabic(value).split(" ").filter(Boolean);
}

function parsePageRef(raw: string): PageRef | undefined {
  const match = raw.match(
    /\([^)]*\u0635\s*([0-9\u0660-\u0669\u06F0-\u06F9]+)(?:\s*[-\u2013]\s*([0-9\u0660-\u0669\u06F0-\u06F9]+))?[^)]*\)/u,
  );
  const start = toNumber(match?.[1]);
  if (!start) return undefined;
  return { start, end: toNumber(match?.[2]) ?? start };
}

function cleanQuote(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith("#") &&
        !/#[\p{L}\p{N}_]+/u.test(trimmed)
      );
    })
    .join("\n")
    .replace(
      /\([^)]*\u0635[\s\d\u0660-\u0669\u06F0-\u06F9\-\u2013\u060C,]+[^)]*\)/gu,
      "",
    )
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function quoteChunks(normalizedQuote: string): string[] {
  const words = normalizedQuote.split(" ").filter((word) => word.length > 1);
  const chunks: string[] = [];
  const longStart = words.slice(0, Math.min(words.length, 18)).join(" ");
  if (longStart) chunks.push(longStart);

  for (const start of [
    0,
    Math.max(0, Math.floor(words.length / 2) - 4),
    Math.max(0, words.length - 8),
  ]) {
    const chunk = words.slice(start, start + 8).join(" ");
    if (chunk && !chunks.includes(chunk)) chunks.push(chunk);
  }

  return chunks;
}

function findLatestTelegramExport(): string {
  if (!existsSync(DEFAULT_TELEGRAM_DIR)) {
    throw new Error(`Telegram export folder not found: ${DEFAULT_TELEGRAM_DIR}`);
  }

  const candidates = readdirSync(DEFAULT_TELEGRAM_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("ChatExport_"))
    .map((entry) => path.join(DEFAULT_TELEGRAM_DIR, entry.name))
    .map((dir) => {
      const json = path.join(dir, "result.json");
      return existsSync(json) ? json : dir;
    })
    .filter((fileOrDir) => {
      if (statSync(fileOrDir).isDirectory()) {
        return readdirSync(fileOrDir).some((name) => /^messages\d*\.html$/i.test(name));
      }
      return existsSync(fileOrDir);
    })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  const latest = candidates[0];
  if (!latest) {
    throw new Error(`No Telegram result.json files found in ${DEFAULT_TELEGRAM_DIR}`);
  }

  return latest;
}

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function findWorkIdsForTags(tags: string[], works: NormalizedWork[]): number[] {
  const ids = new Set<number>();

  for (const tag of tags) {
    const tagText = tag.replace(/^#/, "").replace(/_/g, " ");
    const normalizedTag = normalizeArabic(tagText);
    const tagTokens = normalizedWords(tagText);
    const exact = works.filter((work) => work.normalizedTitle === normalizedTag);
    const candidates =
      exact.length > 0
        ? exact
        : works
            .map((work) => {
              let common = 0;
              for (const token of tagTokens) {
                const withoutLam = token.startsWith("\u0644")
                  ? token.slice(1)
                  : token;
                if (work.tokens.has(token) || work.tokens.has(withoutLam)) {
                  common++;
                }
              }
              return {
                score: common / Math.max(1, tagTokens.length),
                work,
              };
            })
            .filter((item) => item.score >= 0.6)
            .map((item) => item.work);

    for (const work of candidates) ids.add(work.id);
  }

  return [...ids];
}

function findWorkIdsForTitle(title: string | undefined, works: NormalizedWork[]): number[] {
  if (!title) return [];

  const normalizedTitle = normalizeArabic(
    title
      .replace(/^كتاب\s+/u, "")
      .replace(/\s*-\s*.*$/u, "")
      .replace(/\s*\([^)]*\)\s*$/u, ""),
  );
  const titleTokens = normalizedTitle.split(" ").filter((token) => token.length > 1);
  if (titleTokens.length === 0) return [];

  const exact = works.filter(
    (work) =>
      work.normalizedTitle === normalizedTitle ||
      work.normalizedTitle.includes(normalizedTitle) ||
      normalizedTitle.includes(work.normalizedTitle),
  );
  if (exact.length > 0) return exact.map((work) => work.id);

  return works
    .map((work) => {
      let common = 0;
      for (const token of titleTokens) {
        const withoutLam = token.startsWith("\u0644") ? token.slice(1) : token;
        if (work.tokens.has(token) || work.tokens.has(withoutLam)) common++;
      }
      return {
        score: common / Math.max(1, titleTokens.length),
        work,
      };
    })
    .filter((item) => item.score >= 0.6)
    .map((item) => item.work.id);
}

function sourceTitleFromText(text: string): string | undefined {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of [...lines].reverse()) {
    const match = line.match(/(?:^|\s)ابن\s+القيم\s*\|\s*(.+)$/u);
    if (match?.[1]) {
      return match[1].replace(/#[\p{L}\p{N}_]+/gu, "").trim();
    }
  }

  return undefined;
}

function removeSourceAttribution(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/(?:^|\s)ابن\s+القيم\s*\|/u.test(line.trim()))
    .join("\n")
    .trim();
}

function loadTelegramJsonCandidates(inputFile: string, works: NormalizedWork[]): CandidateQuote[] {
  const data = loadJson<TelegramExport>(inputFile);
  const messages = data.messages ?? [];
  const candidates: CandidateQuote[] = [];

  for (const message of messages) {
    const raw = textOf(message).trim();
    if (!raw) continue;

    const tags = [...raw.matchAll(/#[\p{L}\p{N}_]+/gu)].map(
      (match) => match[0],
    );
    if (tags.length === 0) continue;

    const quote = cleanQuote(raw);
    const normalizedQuote = normalizeArabic(quote);
    if (normalizedQuote.length < MIN_NORMALIZED_QUOTE_LENGTH) continue;

    candidates.push({
      date: message.date,
      messageId: message.id,
      normalizedQuote,
      pageRef: parsePageRef(raw),
      quote,
      tags,
      sourceTitle: sourceTitleFromText(raw),
      workIds: findWorkIdsForTags(tags, works),
    });
  }

  return candidates;
}

function htmlInputFiles(inputPath: string): string[] {
  if (statSync(inputPath).isDirectory()) {
    return readdirSync(inputPath)
      .filter((name) => /^messages\d*\.html$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => path.join(inputPath, name));
  }

  return [inputPath];
}

function loadTelegramHtmlCandidates(inputPath: string, works: NormalizedWork[]): CandidateQuote[] {
  const candidates: CandidateQuote[] = [];

  for (const file of htmlInputFiles(inputPath)) {
    const html = readFileSync(file, "utf8");
    const chunks = html.split(/<div class="message /g).slice(1);

    for (const chunk of chunks) {
      if (!/^default clearfix"/.test(chunk)) continue;

      const id = Number(chunk.match(/id="message(\d+)"/)?.[1]);
      if (!id) continue;

      const date = chunk.match(/class="pull_right date details" title="([^"]+)"/)?.[1];
      const textHtml = chunk.match(/<div class="text(?: [^"]*)?">\s*([\s\S]*?)\s*<\/div>/)?.[1];
      if (!textHtml) continue;

      const raw = htmlToText(textHtml);
      if (!raw) continue;

      const sourceTitle = sourceTitleFromText(raw);
      const tags = [...raw.matchAll(/#[\p{L}\p{N}_]+/gu)].map((match) => match[0]);
      if (!sourceTitle && tags.length === 0) continue;

      const quote = cleanQuote(removeSourceAttribution(raw));
      const normalizedQuote = normalizeArabic(quote);
      if (normalizedQuote.length < MIN_NORMALIZED_QUOTE_LENGTH) continue;

      const workIds = new Set([
        ...findWorkIdsForTags(tags, works),
        ...findWorkIdsForTitle(sourceTitle, works),
      ]);
      if (workIds.size === 0) continue;

      candidates.push({
        date,
        messageId: id,
        normalizedQuote,
        pageRef: parsePageRef(raw),
        quote,
        sourceTitle,
        tags,
        workIds: [...workIds],
      });
    }
  }

  return candidates;
}

function loadCandidates(inputPath: string, works: NormalizedWork[]): CandidateQuote[] {
  if (statSync(inputPath).isDirectory() || /\.html?$/i.test(inputPath)) {
    return loadTelegramHtmlCandidates(inputPath, works);
  }

  return loadTelegramJsonCandidates(inputPath, works);
}

function loadIndexedPages(editions: EditionSummary[]): Map<number, IndexedPage[]> {
  const pagesByWork = new Map<number, IndexedPage[]>();

  for (const edition of editions) {
    if (edition.languageCode !== "ar") continue;

    const editionPath = path.join(LIB_DIR, "editions", `${edition.id}.json`);
    if (!existsSync(editionPath)) continue;

    const detail = loadJson<EditionDetail>(editionPath);
    const pages: PageDetail[] = [];
    if (Array.isArray(detail.pages) && detail.pages.length > 0) {
      pages.push(...detail.pages);
    } else if (Array.isArray(detail.pageParts)) {
      for (const part of detail.pageParts) {
        const partPath = path.join(LIB_DIR, "edition-pages", part.file);
        if (existsSync(partPath)) pages.push(...loadJson<PageDetail[]>(partPath));
      }
    }

    const preferredEdition =
      edition.titleAr.includes("\u0639\u0637\u0627\u0621\u0627\u062a") ||
      (edition.editionLabel ?? "").includes("\u0639\u0637\u0627\u0621\u0627\u062a");

    for (const page of pages) {
      const indexed: IndexedPage = {
        editionId: edition.id,
        editionTitle: edition.titleAr,
        normalizedText: normalizeArabic(page.text),
        pageId: page.id,
        pageNumber: page.pageNumber,
        preferredEdition,
        sectionId: page.sectionId,
        sourcePageNumber: page.sourcePageNumber,
        workId: edition.workId,
        workTitle: edition.workTitleAr,
      };
      const current = pagesByWork.get(edition.workId) ?? [];
      current.push(indexed);
      pagesByWork.set(edition.workId, current);
    }
  }

  return pagesByWork;
}

function pageRefMatches(page: IndexedPage, pageRef: PageRef | undefined): boolean {
  return Boolean(
    pageRef &&
      page.sourcePageNumber &&
      page.sourcePageNumber >= pageRef.start &&
      page.sourcePageNumber <= pageRef.end,
  );
}

function matchCandidate(
  candidate: CandidateQuote,
  pagesByWork: Map<number, IndexedPage[]>,
): (IndexedPage & { matchMethod: string; score: number }) | undefined {
  const pagePool = candidate.workIds.flatMap((workId) => pagesByWork.get(workId) ?? []);
  const chunks = quoteChunks(candidate.normalizedQuote);
  let best: (IndexedPage & { matchMethod: string; score: number }) | undefined;

  for (const page of pagePool) {
    let score = 0;
    const methods: string[] = [];

    const exactChunk = chunks[0];
    if (exactChunk && page.normalizedText.includes(exactChunk)) {
      score += EXACT_SCORE;
      methods.push("exact");
    } else {
      const chunkHits = chunks
        .slice(1)
        .filter((chunk) => chunk && page.normalizedText.includes(chunk)).length;
      if (chunkHits > 0) {
        score += chunkHits * CHUNK_SCORE;
        methods.push("chunks");
      }
    }

    if (pageRefMatches(page, candidate.pageRef)) {
      score += PAGE_REF_SCORE;
      methods.push("page-ref");
    }

    if (page.preferredEdition) score += PREFERRED_EDITION_SCORE;

    if (score === 0) continue;
    if (!candidate.pageRef && score < MIN_TEXT_MATCH_SCORE) continue;

    const matchMethod = methods.join("+") || "page-ref";
    if (!best || score > best.score) {
      best = { ...page, matchMethod, score };
    }
  }

  return best;
}

function quoteHref(input: {
  editionId: number;
  pageNumber: number;
  sectionId: number | null;
}): string {
  return input.sectionId != null
    ? `/edition/${input.editionId}/section/${input.sectionId}#page-${input.pageNumber}`
    : `/edition/${input.editionId}`;
}

function buildOutput(quotes: MatchedQuote[]): string {
  return `// AUTO-GENERATED by the quote import script
// To refresh: pnpm --filter @workspace/scripts run import-quotes
export interface DailyQuote {
  text: string;
  source: string;
  href: string;
  workId?: number;
  editionId?: number;
  editionTitle?: string;
  pageId?: number;
  pageNumber?: number;
  sourcePageNumber?: number;
  sectionId?: number | null;
}

const QUOTES: DailyQuote[] = ${JSON.stringify(quotes, null, 2)};

export function getDailyQuote(): DailyQuote {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]!;
}
`;
}

function loadExistingQuotes(outFile: string): MatchedQuote[] {
  if (!existsSync(outFile)) return [];

  const content = readFileSync(outFile, "utf8");
  const match = content.match(/const QUOTES: DailyQuote\[\] = ([\s\S]*?);\s*\n\nexport function/u);
  if (!match?.[1]) return [];

  const parsed = JSON.parse(match[1]) as MatchedQuote[];
  return parsed.map((quote) => ({
    ...quote,
    text: repairMojibake(quote.text),
    source: repairMojibake(quote.source),
    editionTitle: repairMojibake(quote.editionTitle),
  }));
}

function main() {
  const inputFile = path.resolve(readArg("--input") ?? findLatestTelegramExport());
  const outFile = path.resolve(readArg("--out") ?? OUT_FILE);
  const replace = process.argv.includes("--replace");

  const works = loadJson<WorkSummary[]>(path.join(LIB_DIR, "works.json")).map(
    (work): NormalizedWork => ({
      ...work,
      normalizedTitle: normalizeArabic(work.titleAr),
      tokens: new Set(normalizedWords(work.titleAr)),
    }),
  );
  const editions = loadJson<EditionSummary[]>(path.join(LIB_DIR, "editions.json"));
  const pagesByWork = loadIndexedPages(editions);
  const candidates = loadCandidates(inputFile, works);

  const seen = new Set<string>();
  const misses: CandidateQuote[] = [];
  const existingQuotes = replace ? [] : loadExistingQuotes(outFile);
  const matched: MatchedQuote[] = [...existingQuotes];
  let newlyMatched = 0;

  for (const quote of matched) {
    seen.add(`${quote.workId}:${normalizeArabic(quote.text)}`);
  }

  for (const candidate of candidates) {
    const page = matchCandidate(candidate, pagesByWork);
    if (!page) {
      misses.push(candidate);
      continue;
    }

    const dedupeKey = `${page.workId}:${candidate.normalizedQuote}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    matched.push({
      text: candidate.quote,
      href: quoteHref({
        editionId: page.editionId,
        pageNumber: page.pageNumber,
        sectionId: page.sectionId,
      }),
      source: page.workTitle,
      pageNumber: page.pageNumber,
      sourcePageNumber: page.sourcePageNumber,
      workId: page.workId,
      editionId: page.editionId,
      editionTitle: page.editionTitle,
      pageId: page.pageId,
      sectionId: page.sectionId,
    });
    newlyMatched++;
  }

  writeFileSync(outFile, buildOutput(matched), "utf8");

  console.log(`Telegram export: ${inputFile}`);
  console.log(`Existing quotes: ${existingQuotes.length}`);
  console.log(`Candidate quotes: ${candidates.length}`);
  console.log(`New matched quotes: ${newlyMatched}`);
  console.log(`Total quotes: ${matched.length}`);
  console.log(`Skipped unmatched: ${misses.length}`);
  if (misses.length > 0) {
    console.log("\nUnmatched samples:");
    for (const miss of misses.slice(0, 10)) {
      console.log(`- ${miss.messageId}: ${miss.quote.slice(0, 120)}`);
    }
  }
  console.log(`\nWritten: ${outFile}`);
}

main();
