import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, "../output/ibn-qayyim");
const FALLBACK_TRANSLATION_FILE = path.join(SOURCE_DIR, "translations", "de", "daa-wa-dawaa-ataat-de.json");

interface SourcePage {
  sourcePageNumber: number;
  text: string;
  volume: string;
}

type JsonRecord = Record<string, unknown>;

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) continue;
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      options[arg.slice(2)] = next;
      index += 1;
    }
  }

  return {
    editionTitle: options["edition-title"] ?? "عطاءات",
    sourceTitle: options["source-title"] ?? "الداء",
    translationFile: options.file ? path.resolve(options.file) : undefined,
  };
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function collectJsonFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectJsonFiles(filePath));
    else if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.endsWith(".progress.json")) files.push(filePath);
  }
  return files;
}

function sourcePages(filePath: string): { pages: SourcePage[]; title: string } | null {
  const raw = readJson<JsonRecord>(filePath);
  const title = typeof raw.title === "string" ? raw.title : typeof raw["العنوان"] === "string" ? raw["العنوان"] : "";
  if (!title) return null;

  if (Array.isArray(raw.pages)) {
    return {
      pages: raw.pages
        .map(asRecord)
        .filter((page): page is JsonRecord => page !== null)
        .map((page, index) => ({
          sourcePageNumber: Number(page.page_num ?? page.page ?? index),
          text: String(page.text ?? ""),
          volume: String(page.vol ?? page.volume ?? "الكتاب"),
        }))
        .filter((page) => page.text.trim()),
      title,
    };
  }

  if (!Array.isArray(raw["الأجزاء"])) return null;
  return {
    pages: raw["الأجزاء"]
      .map(asRecord)
      .filter((volume): volume is JsonRecord => volume !== null)
      .flatMap((volume) => {
        const volumeTitle = String(volume["الجزء"] ?? "الكتاب");
        const pages = Array.isArray(volume["الصفحات"]) ? volume["الصفحات"] : [];
        return pages
          .map(asRecord)
          .filter((page): page is JsonRecord => page !== null)
          .map((page, index) => ({
            sourcePageNumber: Number(page.page ?? index),
            text: String(page.text ?? ""),
            volume: volumeTitle,
          }));
      })
      .filter((page) => page.text.trim()),
    title,
  };
}

function findSource(options: ReturnType<typeof parseArgs>) {
  const matches = collectJsonFiles(SOURCE_DIR)
    .map((filePath) => {
      try {
        const source = sourcePages(filePath);
        return source ? { ...source, filePath } : null;
      } catch {
        return null;
      }
    })
    .filter((source): source is { filePath: string; pages: SourcePage[]; title: string } => source !== null)
    .filter((source) => source.title.includes(options.sourceTitle) && source.title.includes(options.editionTitle))
    .sort((a, b) => b.pages.length - a.pages.length);

  if (!matches.length) throw new Error(`No source book matched "${options.sourceTitle}" and "${options.editionTitle}".`);
  return matches[0]!;
}

function includesAll(value: string, terms: string[]): boolean {
  return terms.every((term) => value.includes(term));
}

function findTranslationFile(options: ReturnType<typeof parseArgs>): string {
  if (options.translationFile) return options.translationFile;

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
      // Ignore unrelated files.
    }
  }

  return FALLBACK_TRANSLATION_FILE;
}

function main() {
  const options = parseArgs();
  const translationFile = findTranslationFile(options);
  if (!existsSync(translationFile)) throw new Error(`Missing translation file: ${translationFile}`);

  const source = findSource(options);
  const translation = readJson<JsonRecord>(translationFile);
  const sections = Array.isArray(translation.Abschnitte) ? translation.Abschnitte : [];
  const translatedPages: string[] = [];

  for (const rawSection of sections) {
    const section = asRecord(rawSection);
    if (!section) continue;
    const pages = Array.isArray(section.Seiten) ? section.Seiten : [];
    for (const rawPage of pages) {
      const page = asRecord(rawPage);
      if (!page) continue;
      translatedPages.push(String(page.deutscher_Text ?? ""));
    }
  }

  const missing: string[] = [];
  const placeholders: string[] = [];

  for (const [index, page] of source.pages.entries()) {
    const translated = translatedPages[index];
    const label = `${index + 1} (${volumeLabel(page)})`;
    if (!translated) missing.push(label);
    else if (/\[NOCH NICHT (?:U|Ü|Ãœ)BERSETZT\]|\[UEBERSETZUNGSFEHLER\]|\[ÜBERSETZUNGSFEHLER\]|\[ÃœBERSETZUNGSFEHLER\]/i.test(translated)) {
      placeholders.push(label);
    }
  }

  if (translatedPages.length > source.pages.length) {
    missing.push(`extra translated pages: ${translatedPages.length - source.pages.length}`);
  }

  if (missing.length || placeholders.length) {
    console.error(`Source: ${source.title}`);
    console.error(`Expected pages: ${source.pages.length}`);
    console.error(`Translated pages: ${translatedPages.length}`);
    if (missing.length) console.error(`Missing pages (${missing.length}): ${missing.slice(0, 20).join(", ")}`);
    if (placeholders.length) console.error(`Placeholder pages (${placeholders.length}): ${placeholders.slice(0, 20).join(", ")}`);
    process.exit(1);
  }

  console.log(`OK: ${translatedPages.length} German pages match ${source.title}`);
}

main();

function volumeLabel(page: SourcePage): string {
  return `${page.volume}:${page.sourcePageNumber}`;
}
