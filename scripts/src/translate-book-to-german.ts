import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, "../output/ibn-qayyim");
const FALLBACK_OUTPUT_FILE = path.join(SOURCE_DIR, "translations", "de", "daa-wa-dawaa-ataat-de.json");
const DEFAULT_MODEL = "gpt-5.5";
const PLACEHOLDER = "[NOCH NICHT UEBERSETZT]";

type JsonRecord = Record<string, unknown>;

interface SourcePage {
  sourcePageNumber: number;
  text: string;
  volume: string;
}

interface SourceBook {
  category?: string;
  data: JsonRecord;
  filePath: string;
  pages: SourcePage[];
  title: string;
}

interface TranslatedPage {
  Seite: number;
  deutscher_Text: string;
}

interface TranslationSection {
  Abschnitt: string;
  Seiten: TranslatedPage[];
}

interface TranslationBook {
  Abteilung?: string;
  Abschnitte: TranslationSection[];
  Metadaten: JsonRecord;
  Originaltitel: string;
  Sprache: "de";
  Titel: string;
  translatorName: string;
  translationNotes: string;
}

interface TranslateResponse {
  notes: string[];
  translatedText: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }

  return {
    editionTitle: String(options["edition-title"] ?? "عطاءات"),
    dryRun: Boolean(options["dry-run"]),
    force: Boolean(options.force),
    limit: Number(options.limit ?? Number.POSITIVE_INFINITY),
    model: String(options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL),
    outputFile: options.out ? path.resolve(String(options.out)) : undefined,
    sourceFile: options["source-file"] ? path.resolve(String(options["source-file"])) : undefined,
    sourceTitle: String(options["source-title"] ?? "الداء"),
    start: Number(options.start ?? 0),
    useWebSearch: Boolean(options["use-web-search"]),
  };
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function collectJsonFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsonFiles(filePath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.endsWith(".progress.json")) files.push(filePath);
  }
  return files;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function includesAll(value: string, terms: string[]): boolean {
  return terms.every((term) => value.includes(term));
}

function normalizeSourceBook(filePath: string): SourceBook | null {
  const raw = readJson<JsonRecord>(filePath);
  const title = typeof raw.title === "string" ? raw.title : typeof raw["العنوان"] === "string" ? raw["العنوان"] : "";
  if (!title) return null;

  const turathPages = Array.isArray(raw.pages) ? raw.pages : undefined;
  if (turathPages) {
    const pages = turathPages
      .map(asRecord)
      .filter((page): page is JsonRecord => page !== null)
      .map((page, index) => ({
        sourcePageNumber: Number(page.page_num ?? page.page ?? index),
        text: String(page.text ?? ""),
        volume: String(page.vol ?? page.volume ?? "الكتاب"),
      }))
      .filter((page) => page.text.trim());

    return {
      category: typeof raw.category === "string" ? raw.category : undefined,
      data: asRecord(raw.data) ?? {},
      filePath,
      pages,
      title,
    };
  }

  const volumes = Array.isArray(raw["الأجزاء"]) ? raw["الأجزاء"] : undefined;
  if (!volumes) return null;

  const pages = volumes
    .map(asRecord)
    .filter((volume): volume is JsonRecord => volume !== null)
    .flatMap((volume) => {
      const volumeTitle = String(volume["الجزء"] ?? "الكتاب");
      const volumePages = Array.isArray(volume["الصفحات"]) ? volume["الصفحات"] : [];
      return volumePages
        .map(asRecord)
        .filter((page): page is JsonRecord => page !== null)
        .map((page, index) => ({
          sourcePageNumber: Number(page.page ?? index),
          text: String(page.text ?? ""),
          volume: volumeTitle,
        }));
    })
    .filter((page) => page.text.trim());

  return {
    category: typeof raw["القسم"] === "string" ? raw["القسم"] : undefined,
    data: asRecord(raw["البيانات"]) ?? {},
    filePath,
    pages,
    title,
  };
}

function findSourceBook(options: ReturnType<typeof parseArgs>): SourceBook {
  const candidates = options.sourceFile ? [options.sourceFile] : collectJsonFiles(SOURCE_DIR);
  const matches = candidates
    .map((filePath) => {
      try {
        return normalizeSourceBook(filePath);
      } catch {
        return null;
      }
    })
    .filter((book): book is SourceBook => book !== null)
    .filter((book) => book.title.includes(options.sourceTitle) && book.title.includes(options.editionTitle));

  if (matches.length === 0) {
    throw new Error(`No source book matched title "${options.sourceTitle}" and edition "${options.editionTitle}".`);
  }

  matches.sort((a, b) => b.pages.length - a.pages.length || a.title.localeCompare(b.title, "ar"));
  return matches[0]!;
}

function findExistingTranslationFile(options: ReturnType<typeof parseArgs>): string | undefined {
  const terms = [options.sourceTitle, options.editionTitle].filter(Boolean);
  for (const filePath of collectJsonFiles(SOURCE_DIR)) {
    try {
      const raw = readJson<JsonRecord>(filePath);
      const language = typeof raw.Sprache === "string" ? raw.Sprache.toLowerCase() : "";
      const comparable = [
        filePath,
        typeof raw["العنوان"] === "string" ? raw["العنوان"] : "",
        typeof raw.Titel === "string" ? raw.Titel : "",
        typeof raw.Originaltitel === "string" ? raw.Originaltitel : "",
      ].join("\n");
      if ((language === "de" || language === "deutsch" || language === "german") && includesAll(comparable, terms)) return filePath;
    } catch {
      // Ignore malformed or unrelated JSON files.
    }
  }
  return undefined;
}

function resolveOutputFile(options: ReturnType<typeof parseArgs>): string {
  return options.outputFile ?? findExistingTranslationFile(options) ?? FALLBACK_OUTPUT_FILE;
}

function groupExistingPages(book: TranslationBook): Map<string, string> {
  const existing = new Map<string, string>();
  for (const section of book.Abschnitte) {
    for (const page of section.Seiten) existing.set(`${section.Abschnitt}:${page.Seite}`, page.deutscher_Text);
  }
  return existing;
}

function flattenTranslatedPages(book: TranslationBook): Array<{ page: TranslatedPage; section: TranslationSection }> {
  return book.Abschnitte.flatMap((section) => section.Seiten.map((page) => ({ page, section })));
}

function createTranslationBook(source: SourceBook, outputFile: string): TranslationBook {
  if (existsSync(outputFile)) return readJson<TranslationBook>(outputFile);

  return {
    Abteilung: source.category,
    Abschnitte: [],
    Metadaten: source.data,
    Originaltitel: source.title,
    Sprache: "de",
    Titel: "Die Krankheit und das Heilmittel (Al-Da wa-l-Dawa)",
    translatorName: `AI draft (${new Date().toISOString().slice(0, 10)})`,
    translationNotes:
      "Draft German translation generated page-by-page. Quran and hadith renderings must be reviewed against trusted German sources before publication.",
  };
}

function isCompleteTranslation(text: string | undefined): boolean {
  return Boolean(
    text?.trim() &&
      !/\[NOCH NICHT (?:U|Ü|Ãœ)BERSETZT\]|\[UEBERSETZUNGSFEHLER\]|\[ÜBERSETZUNGSFEHLER\]|\[ÃœBERSETZUNGSFEHLER\]/i.test(text),
  );
}

function upsertTranslatedPage(book: TranslationBook, sourcePage: SourcePage, translatedText: string, orderIndex?: number) {
  const existingByOrder = typeof orderIndex === "number" ? flattenTranslatedPages(book)[orderIndex] : undefined;
  if (existingByOrder) {
    existingByOrder.page.deutscher_Text = translatedText;
    return;
  }

  let section = book.Abschnitte.find((item) => item.Abschnitt === sourcePage.volume);
  if (!section) {
    section = { Abschnitt: sourcePage.volume, Seiten: [] };
    book.Abschnitte.push(section);
  }

  const existing = section.Seiten.find((page) => page.Seite === sourcePage.sourcePageNumber);
  if (existing) {
    existing.deutscher_Text = translatedText;
  } else {
    section.Seiten.push({ Seite: sourcePage.sourcePageNumber, deutscher_Text: translatedText });
    section.Seiten.sort((a, b) => a.Seite - b.Seite);
  }
}

function extractOutputText(response: JsonRecord): string {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const record = asRecord(item);
    const content = Array.isArray(record?.content) ? record.content : [];
    for (const part of content) {
      const contentPart = asRecord(part);
      if (typeof contentPart?.text === "string") return contentPart.text;
    }
  }
  throw new Error("OpenAI response did not include output text.");
}

async function translatePage(params: {
  apiKey: string;
  model: string;
  page: SourcePage;
  sourceTitle: string;
  useWebSearch: boolean;
}): Promise<TranslateResponse> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content:
            "You translate classical Islamic Arabic into polished German for a reading app. Preserve meaning, paragraph breaks, headings, footnote numbers, Quran references, hadith references, names, and citations. Do not summarize or add commentary. Use consistent German Islamic terminology. Return JSON only.",
          role: "system",
        },
        {
          content: JSON.stringify({
            instruction:
              "Translate this page from Ibn al-Qayyim's Arabic text into German. If a Quran verse or hadith is obvious, preserve its reference and produce a careful German meaning, but do not invent source attributions.",
            page: params.page.sourcePageNumber,
            sourceTitle: params.sourceTitle,
            text: params.page.text,
            volume: params.page.volume,
          }),
          role: "user",
        },
      ],
      model: params.model,
      text: {
        format: {
          name: "german_page_translation",
          schema: {
            additionalProperties: false,
            properties: {
              notes: {
                items: { type: "string" },
                type: "array",
              },
              translatedText: { type: "string" },
            },
            required: ["translatedText", "notes"],
            type: "object",
          },
          strict: true,
          type: "json_schema",
        },
      },
      tools: params.useWebSearch ? [{ type: "web_search_preview" }] : undefined,
    }),
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed with ${response.status}: ${body}`);
  }

  return JSON.parse(extractOutputText((await response.json()) as JsonRecord)) as TranslateResponse;
}

async function main() {
  const options = parseArgs();
  const source = findSourceBook(options);
  const outputFile = resolveOutputFile(options);
  const output = createTranslationBook(source, outputFile);
  const existingPages = groupExistingPages(output);
  const existingPagesByOrder = flattenTranslatedPages(output);
  const pages = source.pages.slice(options.start, Number.isFinite(options.limit) ? options.start + options.limit : undefined);

  mkdirSync(path.dirname(outputFile), { recursive: true });
  console.log(`Source: ${source.title}`);
  console.log(`Pages selected: ${pages.length}. Output: ${outputFile}`);

  if (options.dryRun) {
    const complete = existingPagesByOrder.filter((entry) => isCompleteTranslation(entry.page.deutscher_Text)).length;
    console.log(`Existing translated pages: ${complete}/${existingPagesByOrder.length}`);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required to run AI translation.");

  for (const [index, page] of pages.entries()) {
    const sourceOrderIndex = options.start + index;
    const key = `${page.volume}:${page.sourcePageNumber}`;
    const existing = existingPagesByOrder[sourceOrderIndex]?.page.deutscher_Text ?? existingPages.get(key);
    if (!options.force && isCompleteTranslation(existing)) {
      console.log(`skip ${options.start + index + 1}/${source.pages.length} page ${page.sourcePageNumber}`);
      continue;
    }

    const translated = await translatePage({
      apiKey,
      model: options.model,
      page,
      sourceTitle: source.title,
      useWebSearch: options.useWebSearch,
    });

    upsertTranslatedPage(output, page, translated.translatedText.trim() || PLACEHOLDER, sourceOrderIndex);
    writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`translated ${options.start + index + 1}/${source.pages.length} page ${page.sourcePageNumber}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
