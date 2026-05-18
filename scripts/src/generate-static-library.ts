import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, "../output/ibn-qayyim");
const TARGET_DIR = path.resolve(__dirname, "../../artifacts/ibn-al-qayyim/public/library-data");
const PUBLIC_DIR = path.resolve(__dirname, "../../artifacts/ibn-al-qayyim/public");
const COVER_METADATA_FILE = path.resolve(__dirname, "../metadata/book-covers.json");
const MAX_STATIC_FILE_BYTES = 4_000_000;

interface ArabicSourceBook {
  "العنوان"?: string;
  "القسم"?: string;
  "البيانات"?: {
    "الناشر"?: string;
    "الطبعة"?: string;
    "المحقق"?: string;
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

interface TurathSourceBook {
  author?: string;
  category?: string;
  data?: NonNullable<ArabicSourceBook["البيانات"]>;
  id?: string;
  index?: SourceIndexEntry[];
  pages?: Array<{
    headings?: string[];
    page?: number;
    page_num?: number;
    text?: string;
    vol?: string;
    volume?: string;
  }>;
  source_id?: number;
  title?: string;
  volumes?: unknown[] | number;
  volumes_count?: number;
}

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

interface SourceBook {
  category?: string;
  data: NonNullable<ArabicSourceBook["البيانات"]>;
  direction: "ltr" | "rtl";
  file: string;
  id: string;
  kind: "original" | "translation";
  languageCode: string;
  languageName: string;
  indexEntries?: SourceIndexEntry[];
  pages: SourcePage[];
  reviewerName?: string;
  sourceFormat: "organized-arabic" | "translation" | "turath-flat";
  sourceId: number;
  sourceTitle?: string;
  status: "draft" | "reviewed" | "published";
  title: string;
  translatorName?: string;
  volumes: number;
}

interface RawSourcePage {
  headings?: string[];
  sourcePageNumber?: number;
  text: string;
  volume: string;
}

interface SourcePage {
  headings: string[];
  pageNumber: number;
  sourcePageNumber: number;
  text: string;
  volume: string;
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

interface WorkSummary {
  category: string;
  coverColor: string;
  coverImageAlt?: string;
  coverImageUrl?: string;
  defaultEditionId: number;
  description: string;
  editionCount: number;
  id: number;
  languageCode: string;
  pageCount: number;
  sectionCount: number;
  slug: string;
  title: string;
  titleAr: string;
  volumeCount: number;
}

interface EditionSummary {
  category: string;
  coverColor: string;
  coverImageAlt?: string;
  coverImageUrl?: string;
  defaultSectionId: number;
  direction: "ltr" | "rtl";
  editionLabel?: string;
  id: number;
  kind: "original" | "translation";
  languageCode: string;
  languageName: string;
  pageCount: number;
  publisher?: string;
  reviewerName?: string;
  sectionCount: number;
  sourceId: number;
  sourceFile?: string;
  sourceTitle?: string;
  status: "draft" | "reviewed" | "published";
  title: string;
  titleAr: string;
  translatorName?: string;
  volumeCount: number;
  workId: number;
  workTitleAr: string;
}

interface SectionSummary {
  direction: "ltr" | "rtl";
  editionId: number;
  endPage: number;
  id: number;
  languageCode: string;
  orderIndex: number;
  parentId: number | null;
  startPage: number;
  title: string;
  titleAr: string;
  type: "bab" | "fasl" | "heading" | "topic";
  workId: number;
}

interface SourceIndexEntry {
  level?: number | string;
  page?: number | string;
  page_num?: number | string;
  title?: string;
}

interface PageDetail {
  direction: "ltr" | "rtl";
  editionId: number;
  id: number;
  languageCode: string;
  orderIndex: number;
  pageNumber: number;
  sectionId: number | null;
  sourcePageNumber: number;
  text: string;
  volume: string;
  workId: number;
}

interface EditionDetail extends EditionSummary {
  pageParts: Array<{ count: number; file: string; pageIds: number[] }>;
  pages: PageDetail[];
  sections: SectionSummary[];
}

interface SearchDocument {
  bookId: number;
  bookTitle: string;
  category: string;
  content: string;
  editionId: number;
  languageCode: string;
  pageId: number;
  pageNumber: number;
  sectionId: number | null;
  sectionTitle: string;
  snippetTitle: string;
  workId: number;
  workTitle: string;
}

const COVER_COLORS = ["#f7f7f7", "#f3f3f3", "#efefef", "#fafafa", "#f5f5f4", "#f4f4f5"];

const SUPPORTED_LANGUAGES = [
  { code: "ar", direction: "rtl", isEnabled: true, name: "Arabic", nativeName: "العربية" },
  { code: "de", direction: "ltr", isEnabled: true, name: "German", nativeName: "Deutsch" },
  { code: "en", direction: "ltr", isEnabled: true, name: "English", nativeName: "English" },
] as const;

const LOCALIZED_CATEGORIES: Record<string, Record<string, string>> = {
  "أصول الفقه": { de: "Rechtsmethodik", en: "Legal theory" },
  "التفسير": { de: "Tafsir", en: "Tafsir" },
  "التفسير والقرآن": { de: "Tafsir und Koran", en: "Tafsir and Qur'an" },
  "التزكية والسلوك": { de: "Tazkiya und Spiritualität", en: "Tazkiya and spiritual conduct" },
  "الجوامع": { de: "Sammlungen", en: "Collections" },
  "الحديث وعلومه": { de: "Hadithwissenschaft", en: "Hadith studies" },
  "السيرة النبوية": { de: "Prophetische Biografie", en: "Prophetic biography" },
  "السياسة الشرعية والقضاء": { de: "Scharia-Politik und Gerichtswesen", en: "Governance and judiciary" },
  "الطب": { de: "Medizin", en: "Medicine" },
  "العقيدة": { de: "Glaubenslehre", en: "Creed" },
  "الرقائق والآداب والأذكار": {
    de: "Spiritualität, Adab und Gedenken",
    en: "Spirituality, manners, and remembrance",
  },
  "الفرق والردود": { de: "Sekten und Widerlegungen", en: "Sects and refutations" },
  "العلل والسؤلات الحديثية": { de: "Hadithkritik und Fragen", en: "Hadith criticism and questions" },
  "الفقة والأحكام": { de: "Rechtsfragen", en: "Legal rulings" },
  "الفقه والأحكام": { de: "Rechtsfragen", en: "Legal rulings" },
  "فهارس الكتب والأدلة": { de: "Bibliografien und Register", en: "Bibliographies and indexes" },
  "شروح الحديث": { de: "Hadith-Kommentare", en: "Hadith commentaries" },
  "علوم القرآن وأصول التفسير": {
    de: "Koranwissenschaft und Tafsir-Grundlagen",
    en: "Qur'an studies and tafsir foundations",
  },
  "مسائل فقهية": { de: "Rechtsfragen", en: "Legal questions" },
  "متنوع": { de: "Verschiedenes", en: "Miscellaneous" },
};

function languageInfo(code: string) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code) ?? SUPPORTED_LANGUAGES[0]!;
}

function containsArabic(value: string | undefined): boolean {
  return Boolean(value && /[\u0600-\u06FF]/u.test(value));
}

function metadataForLanguage(value: string | undefined, languageCode: string): string | undefined {
  if (!value) return undefined;
  if (languageCode === "ar") return value;
  return containsArabic(value) ? undefined : value;
}

function localizeCategory(category: string, languageCode: string): string {
  if (languageCode === "ar") return category;
  return LOCALIZED_CATEGORIES[category]?.[languageCode] ?? category;
}

function localizedEditionCountLabel(count: number, languageCode: string): string {
  if (languageCode === "de") return count === 1 ? "1 Ausgabe verfügbar" : `${count.toLocaleString("de-DE")} Ausgaben verfügbar`;
  if (languageCode === "en") return count === 1 ? "1 edition available" : `${count.toLocaleString("en")} editions available`;
  return editionCountLabel(count);
}

function localizedIntroTitle(languageCode: string): string {
  if (languageCode === "de") return "Einleitung";
  if (languageCode === "en") return "Introduction";
  return "مقدمة الكتاب";
}

function localizedFullTextTitle(languageCode: string): string {
  if (languageCode === "de") return "Volltext";
  if (languageCode === "en") return "Full text";
  return "النص الكامل";
}

function localizedEditionTitleFallback(languageCode: string): string {
  if (languageCode === "de") return "Übersetzte Ausgabe";
  if (languageCode === "en") return "Translated edition";
  return "طبعة متاحة";
}

function localizedPageAbbreviation(languageCode: string): string {
  if (languageCode === "de") return "S.";
  if (languageCode === "en") return "p.";
  return "ص";
}

function normalizeVolumeNumber(value: string): string | undefined {
  const match = value.match(/[0-9\u0660-\u0669\u06F0-\u06F9]+/u);
  if (!match) return undefined;
  return match[0]
    .replace(/[\u0660-\u0669]/gu, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/gu, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

function localizedVolumeLabel(volume: string, languageCode: string): string {
  if (languageCode === "ar" || !containsArabic(volume)) return volume;

  const volumeNumber = normalizeVolumeNumber(volume);
  if (languageCode === "de") return volumeNumber ? `Band ${volumeNumber}` : "Buch";
  if (languageCode === "en") return volumeNumber ? `Volume ${volumeNumber}` : "Book";
  return volume;
}

function inferCategory(title: string): string {
  if (/تفسير|قرآن|أيمان القرآن|أمثال القرآن/.test(title)) return "التفسير والقرآن";
  if (/فقه|أحكام|جزية|خراج|طلاق|الصلاة|المولود|الطرق الحكمية/.test(title)) return "الفقه والأحكام";
  if (/عقيدة|توحيد|إيمان|الجهمية|النونية|شفاء العليل/.test(title)) return "العقيدة";
  if (/أخلاق|تزكية|قلب|صبر|شكر|محبة|روضة|الفوائد|الداء|الوابل|مدارج/.test(title)) return "التزكية والسلوك";
  if (/سيرة|زاد المعاد|تاريخ|هدي/.test(title)) return "السيرة والهدي";
  if (/حديث|سنة|المنار|سنن/.test(title)) return "الحديث وعلومه";
  return "متنوع";
}

function stripEdition(title: string): string {
  return title
    .replace(/\s*=\s*.+$/, "")
    .replace(/\s+-\s+[\u0637\u062A]\s+.+$/u, "")
    .replace(/\s+-\s+.+$/, "")
    .trim();
}

function extractEdition(title: string, data: SourceBook["data"]): { editionLabel?: string; publisher?: string } {
  const titleMatch = title.match(/\s+-\s+([\u0637\u062A])\s+(.+)$/u);
  const editionFromTitle = titleMatch?.[2]?.trim();
  const prefix = titleMatch?.[1] === "\u062A" ? "ت" : "ط";
  const editionData = typeof data["الطبعة"] === "string" ? data["الطبعة"].trim() : "";
  const publisher = (typeof data["الناشر"] === "string" && data["الناشر"].trim()) || editionFromTitle;

  return {
    editionLabel: editionFromTitle ? `${prefix} ${editionFromTitle}` : editionData || undefined,
    publisher: publisher || undefined,
  };
}

function cleanMetadataValue(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || undefined;
}

function uniqueMetadata(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  values.forEach((value) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    unique.push(value);
  });
  return unique;
}

function truncateMetadata(value: string, maxLength = 86): string {
  if (value.length <= maxLength) return value;
  const breakpoint = value.lastIndexOf(" ", maxLength);
  return `${value.slice(0, breakpoint > 32 ? breakpoint : maxLength).trim()}...`;
}

function formatMetadataList(values: string[], maxItems = 2): string {
  const visible = values.slice(0, maxItems).map((value) => truncateMetadata(value));
  return values.length > maxItems ? `${visible.join("، ")}، وغيرها` : visible.join("، ");
}

function editionCountLabel(count: number): string {
  if (count === 1) return "طبعة واحدة متاحة";
  if (count === 2) return "طبعتان متاحتان";
  return `${count} طبعات متاحة`;
}

function getWorkCategory(baseTitle: string, group: SourceBook[]): string {
  return uniqueMetadata(group.map((source) => cleanMetadataValue(source.category))).find((category) => /[\u0600-\u06FF]/u.test(category)) ?? inferCategory(baseTitle);
}

function buildWorkDescription(category: string, group: SourceBook[]): string {
  const publishedGroup = group.filter((source) => source.status === "published");
  const publishedArabicGroup = publishedGroup.filter((source) => source.languageCode === "ar");
  const descriptionGroup = publishedArabicGroup.length > 0 ? publishedArabicGroup : publishedGroup.length > 0 ? publishedGroup : group;
  const publishers = uniqueMetadata(descriptionGroup.map((source) => cleanMetadataValue(source.data["الناشر"])));
  const investigators = uniqueMetadata(descriptionGroup.map((source) => cleanMetadataValue(source.data["المحقق"])));
  const editionLabels = uniqueMetadata(
    descriptionGroup.map((source) => {
      const edition = extractEdition(source.title, source.data);
      return edition.editionLabel ?? cleanMetadataValue(source.data["الطبعة"]);
    }),
  );

  const facts = [`القسم: ${category}`];
  if (investigators.length > 0) facts.push(`التحقيق: ${formatMetadataList(investigators)}`);
  if (publishers.length > 0) facts.push(`الناشر: ${formatMetadataList(publishers)}`);
  else if (editionLabels.length > 0) facts.push(`الطبعة: ${formatMetadataList(editionLabels)}`);
  facts.push(editionCountLabel(descriptionGroup.length));

  return facts.join(". ");
}

function slugify(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
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

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function collectJsonFiles(dir: string): string[] {
  const files: string[] = [];
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

function isArabicBookTitle(title: string): boolean {
  return (title.match(/[\u0600-\u06FF]/gu) ?? []).length >= 2;
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

function editionTitleKey(languageCode: string, title: string) {
  return `${languageCode}:${titleKey(title)}`;
}

const ILAM_AL_MUWAQQIIN_TITLE = "\u0625\u0639\u0644\u0627\u0645 \u0627\u0644\u0645\u0648\u0642\u0639\u064A\u0646 \u0639\u0646 \u0631\u0628 \u0627\u0644\u0639\u0627\u0644\u0645\u064A\u0646";

function canonicalWorkTitle(title: string) {
  if (titleKey(title) === titleKey(ILAM_AL_MUWAQQIIN_TITLE)) return ILAM_AL_MUWAQQIIN_TITLE;
  return title;
}

function duplicateEditionKey(source: SourceBook): string {
  return editionTitleKey(source.languageCode, source.sourceTitle ?? source.title);
}

function githubSourcePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function sourcePreferenceScore(source: SourceBook): number {
  let score = 0;
  if (source.sourceFormat === "translation") score += 3_000;
  if (source.sourceFormat === "organized-arabic") score += 2_000;
  if (source.sourceFormat === "turath-flat") score += 1_000;
  if (source.file.includes("/") || source.file.includes("\\")) score += 100;
  if (source.reviewerName || source.translatorName) score += 10;
  score += Math.min(source.pages.length, 10_000) / 10_000;
  return score;
}

function selectPreferredEditions(sources: SourceBook[]): SourceBook[] {
  const preferredByTitle = new Map<string, SourceBook>();

  sources.forEach((source) => {
    const key = duplicateEditionKey(source);
    const preferred = preferredByTitle.get(key);
    if (!preferred || sourcePreferenceScore(source) > sourcePreferenceScore(preferred)) {
      preferredByTitle.set(key, source);
    }
  });

  return Array.from(preferredByTitle.values());
}

function reorderSourcePages(title: string, pages: RawSourcePage[]): RawSourcePage[] {
  const comparableTitle = titleKey(title);
  if (comparableTitle.includes("هداية الحيارى") && comparableTitle.includes("عطاءات العلم")) {
    const misplacedIntroIndex = pages.findIndex((page, index) => index > 0 && titleKey(page.text).startsWith("مقدمة التحقيق"));
    if (misplacedIntroIndex > 0) {
      return [...pages.slice(misplacedIntroIndex), ...pages.slice(0, misplacedIntroIndex)];
    }
  }
  return pages;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeIndexEntries(value: unknown): SourceIndexEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry): SourceIndexEntry | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const title = pickString(record, ["title", "العنوان", "name", "label"]);
      const page = pickNumber(record, ["page", "page_num", "صفحة"]);
      const level = pickNumber(record, ["level", "depth", "المستوى"]);
      if (!title || page === undefined) return null;
      return { level, page, title } satisfies SourceIndexEntry;
    })
    .filter((entry): entry is SourceIndexEntry => entry !== null);
}

function languageCodeFromSource(value: string | undefined, filePath: string): string {
  const comparable = `${value ?? ""} ${path.basename(filePath)}`.toLowerCase();
  if (/deutsch|german|_de\b|\(deutsch\)/i.test(comparable)) return "de";
  if (/english|englisch|_en\b|\(english\)/i.test(comparable)) return "en";
  return "ar";
}

function isTranslationPlaceholder(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return (
    normalized.startsWith("[") &&
    normalized.endsWith("]") &&
    normalized.includes("BERSETZ") &&
    (normalized.includes("FEHLER") || normalized.includes("NOCH NICHT"))
  );
}

function normalizeTranslatedSourceBook(raw: unknown, filePath: string): SourceBook | null {
  const record = asRecord(raw);
  if (!record || !Array.isArray(record.Abschnitte)) return null;

  const languageCode = languageCodeFromSource(pickString(record, ["Sprache", "language", "Language"]), filePath);
  if (languageCode === "ar") return null;

  const language = languageInfo(languageCode);
  const sourceTitle = pickString(record, ["العنوان", "sourceTitle", "originalTitle", "Originaltitel"]);
  const title = pickString(record, ["Titel", "Title", "title"]) ?? sourceTitle ?? path.basename(filePath, ".json");
  const category = pickString(record, ["القسم", "Abteilung", "category"]) ?? (sourceTitle ? inferCategory(sourceTitle) : inferCategory(title));
  const data = asRecord(record["البيانات"]) ?? asRecord(record.Metadaten) ?? {};
  const sections = record.Abschnitte
    .map(asRecord)
    .filter((section): section is Record<string, unknown> => section !== null);

  let hasTranslationPlaceholder = false;
  const rawPages = sections.flatMap((section) => {
    const pages = Array.isArray(section.Seiten) ? section.Seiten : [];
    const volume = pickString(section, ["Abschnitt", "Teil", "title"]) ?? title;
    return pages
      .map(asRecord)
      .filter((page): page is Record<string, unknown> => page !== null)
      .map((page) => {
        const text = pickString(page, ["deutscher_Text", "english_Text", "translated_Text", "Text", "text"]) ?? "";
        if (isTranslationPlaceholder(text)) hasTranslationPlaceholder = true;
        return {
          headings: [],
          sourcePageNumber: pickNumber(page, ["Seite", "page", "page_num"]),
          text: text === "[ÜBERSETZUNGSFEHLER]" ? "" : text,
          volume,
        };
      })
      .filter((page) => page.text.trim().length > 0);
  });

  const pages = rawPages.map((page, orderIndex) => ({
    ...page,
    headings: page.headings ?? [],
    pageNumber: orderIndex,
    sourcePageNumber: page.sourcePageNumber ?? orderIndex,
  }));

  if (!pages.length) return null;

  return {
    category,
    data,
    direction: language.direction,
    file: path.relative(SOURCE_DIR, filePath),
    id: slugify(`${sourceTitle ?? title}-${languageCode}`),
    kind: "translation",
    languageCode,
    languageName: language.name,
    indexEntries: [],
    pages,
    reviewerName: pickString(record, ["reviewerName", "Reviewer", "مراجع"]),
    sourceFormat: "translation",
    sourceId: 0,
    sourceTitle,
    status: hasTranslationPlaceholder ? "draft" : "published",
    title,
    translatorName: pickString(record, ["translatorName", "Translator", "Übersetzer", "مترجم"]),
    volumes: sections.length || 1,
  };
}

function normalizeSourceBook(raw: unknown, filePath: string): SourceBook | null {
  const translated = normalizeTranslatedSourceBook(raw, filePath);
  if (translated) return translated;

  const turath = raw as TurathSourceBook;
  if (turath.title && Array.isArray(turath.pages) && isArabicBookTitle(turath.title)) {
    const rawPages = turath.pages.map((page) => ({
      headings: Array.isArray(page.headings) ? page.headings : [],
      sourcePageNumber:
        typeof page.page_num === "number" ? page.page_num : typeof page.page === "number" ? page.page : undefined,
      text: page.text ?? "",
      volume: page.vol ?? page.volume ?? "",
    }));
    const pages = reorderSourcePages(turath.title, rawPages).map((page, orderIndex) => ({
      ...page,
      headings: page.headings ?? [],
      pageNumber: orderIndex,
      sourcePageNumber: page.sourcePageNumber ?? orderIndex,
    }));

    if (!pages.length) return null;

    return {
      category: turath.category,
      data: turath.data ?? {},
      direction: "rtl",
      file: path.relative(SOURCE_DIR, filePath),
      id: turath.id || slugify(turath.title || path.basename(filePath, ".json")),
      kind: "original",
      languageCode: "ar",
      languageName: "Arabic",
      indexEntries: normalizeIndexEntries(turath.index),
      pages,
      sourceFormat: "turath-flat",
      sourceId: typeof turath.source_id === "number" ? turath.source_id : 0,
      status: "published",
      title: turath.title,
      volumes:
        typeof turath.volumes_count === "number"
          ? turath.volumes_count
          : Array.isArray(turath.volumes)
            ? turath.volumes.length || 1
            : typeof turath.volumes === "number"
              ? turath.volumes
              : 1,
    };
  }

  const arabic = raw as ArabicSourceBook;
  const title = arabic["العنوان"];
  const parts = arabic["الأجزاء"];
  if (!title || !Array.isArray(parts) || !isArabicBookTitle(title)) return null;

  const rawPages = parts
    .flatMap((part) =>
      (part["الصفحات"] ?? []).map((page) => ({
        headings: [],
        sourcePageNumber: typeof page.page === "number" ? page.page : undefined,
        text: page.text ?? "",
        volume: part["الجزء"] ?? "",
      })),
    );
  const pages = reorderSourcePages(title, rawPages)
    .map((page, orderIndex) => ({
      ...page,
      headings: page.headings ?? [],
      pageNumber: orderIndex,
      sourcePageNumber: page.sourcePageNumber ?? orderIndex,
    }));

  if (!pages.length) return null;

  return {
    category: arabic["القسم"],
    data: arabic["البيانات"] ?? {},
    direction: "rtl",
    file: path.relative(SOURCE_DIR, filePath),
    id: slugify(title || path.basename(filePath, ".json")),
    kind: "original",
    languageCode: "ar",
    languageName: "Arabic",
    indexEntries: normalizeIndexEntries((arabic as { index?: unknown; "الفهرس"?: unknown }).index ?? (arabic as { "الفهرس"?: unknown })["الفهرس"]),
    pages,
    sourceFormat: "organized-arabic",
    sourceId: typeof (arabic as { source_id?: unknown }).source_id === "number" ? (arabic as { source_id: number }).source_id : 0,
    status: "published",
    title,
    volumes: parts.length || 1,
  };
}

function readSourceBook(filePath: string): SourceBook | null {
  if (!existsSync(filePath)) return null;
  try {
    return normalizeSourceBook(readJson<unknown>(filePath), filePath);
  } catch {
    return null;
  }
}

function loadSourceIndex(): SourceIndex {
  const indexPath = path.join(SOURCE_DIR, "index.json");
  if (existsSync(indexPath)) {
    const index = readJson<SourceIndex>(indexPath);
    const indexedFiles = new Set(index.books.map((book) => path.normalize(book.file)));
    const indexedMetadataByTitle = new Map(
      index.books.map((book) => [editionTitleKey("ar", book.title), book] as const),
    );
    const indexedBooks = index.books.filter((book) => {
      const source = readSourceBook(path.join(SOURCE_DIR, book.file));
      return source !== null;
    });
    const extraBooks = collectJsonFiles(SOURCE_DIR)
      .filter((filePath) => !indexedFiles.has(path.normalize(path.relative(SOURCE_DIR, filePath))))
      .map((filePath): SourceIndexBook | null => {
        const source = readSourceBook(filePath);
        if (!source) return null;
        const indexedMetadata = indexedMetadataByTitle.get(editionTitleKey("ar", source.sourceTitle ?? source.title));
        return {
          file: source.file,
          id: source.id,
          pages: source.pages.length,
          source_id: source.sourceId || indexedMetadata?.source_id,
          title: source.title,
          volumes: source.volumes || indexedMetadata?.volumes,
        };
      })
      .filter((book): book is SourceIndexBook => book !== null);
    const books = [...indexedBooks, ...extraBooks].sort(
      (a, b) => stripEdition(a.title).localeCompare(stripEdition(b.title), "ar") || a.title.localeCompare(b.title, "ar"),
    );
    return {
      ...index,
      books,
      books_count: books.length,
    };
  }

  const books = collectJsonFiles(SOURCE_DIR)
    .map((filePath): SourceIndexBook | null => {
      const source = readSourceBook(filePath);
      if (!source) return null;
      return {
        file: source.file,
        id: source.id,
        pages: source.pages.length,
        source_id: source.sourceId,
        title: source.title,
        volumes: source.volumes,
      };
    })
    .filter((book): book is SourceIndexBook => book !== null)
    .sort((a, b) => stripEdition(a.title).localeCompare(stripEdition(b.title), "ar") || a.title.localeCompare(b.title, "ar"));

  return {
    author: "ابن قيم الجوزية",
    books,
    books_count: books.length,
    extracted_at: new Date().toISOString(),
    source: "local-extracted",
  };
}

function hasLocalCoverFile(cover: BookCoverMetadata | undefined): cover is BookCoverMetadata {
  if (!cover?.coverImageUrl) return false;
  return existsSync(path.join(PUBLIC_DIR, cover.coverImageUrl.replace(/^\//, "")));
}

function cleanSectionTitle(title: string) {
  return title
    .replace(/\s+/g, " ")
    .replace(/^((?:ف[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]*ص[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]*ل[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]*[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]*)\s*)\)\s*[:：]?\s*/u, "$1 ")
    .replace(/^[\s()[\]{}«»"'“”]+|[\s()[\]{}«»"'“”،،.؛:]+$/g, "")
    .trim();
}

function stripArabicMarks(value: string) {
  return value.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, "");
}

function sectionTitleKey(title: string) {
  return stripArabicMarks(title)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 54);
}

function isReferenceLikeTitle(title: string) {
  const comparableTitle = stripArabicMarks(title);
  return (
    /^صفحة\s*\d+$/u.test(comparableTitle) ||
    /^[\d\s٠-٩۰-۹:،.,؛\-–/]+$/u.test(comparableTitle) ||
    /^[\u0600-\u06FF\s]+[:：]\s*[\d٠-٩۰-۹]/u.test(comparableTitle) ||
    /^[\u0600-\u06FF\s]{2,30}\s+[\d٠-٩۰-۹]+$/u.test(comparableTitle) ||
    /^\d+\s*[-–]\s*/u.test(comparableTitle) ||
    /^\[?\d+\/[أبجدهوزحطيكلمنسعفصقرشتثخذضظغ]\]?$/u.test(comparableTitle) ||
    /^(?:ص|ج|رقم|حاشية|هامش)\s*[\d٠-٩۰-۹]/u.test(comparableTitle) ||
    /[{}]/u.test(comparableTitle)
  );
}

function isGenericTopicTitle(title: string) {
  const comparableTitle = stripArabicMarks(title);
  const words = comparableTitle.split(/\s+/).filter(Boolean);
  return (
    containsArabic(title) &&
    title.length >= 3 &&
    title.length <= 120 &&
    words.length <= 14 &&
    !isReferenceLikeTitle(title) &&
    !/^(?:قال|وقال|فقال|قلت|وقلت|قالوا|فإن|ومن|وعن|عن)(?:\s|$)/u.test(comparableTitle) &&
    !/[.؟!]$/u.test(comparableTitle)
  );
}

function isLeadTopicCandidate(title: string, normalizedText: string) {
  const afterTitle = normalizedText.slice(title.length).trimStart();
  return /^(?:بسم الله|الحمد لله|أما بعد)/u.test(afterTitle) && isGenericTopicTitle(title);
}

function classifySectionTitle(
  rawTitle: string,
  options: { allowGenericTopic?: boolean } = {},
): { title: string; type: SectionSummary["type"] } | null {
  const title = cleanSectionTitle(rawTitle);
  const comparableTitle = stripArabicMarks(title);
  if (/^ف[\u0610-\u061A\u064B-\u0650\u0652-\u065F\u06D6-\u06ED]*ص\u0651/u.test(title)) return null;
  if (!title || title.length > 140) return null;
  if (isReferenceLikeTitle(title)) return null;

  if (/^(?:كتاب|الباب|باب)(?:\b|\s)/u.test(comparableTitle)) return { title, type: "bab" };
  if (/^فصل(?:\b|\s|[:：]|$)/u.test(comparableTitle)) return { title, type: "fasl" };
  if (/^(?:مقدمة|المقدمة|تمهيد|تقديم|خطبة)(?:\b|\s|$)/u.test(comparableTitle)) return { title, type: "heading" };
  if (options.allowGenericTopic && isGenericTopicTitle(title)) return { title, type: "topic" };
  return null;
}

function detectSectionTitles(
  text: string,
  options: { pageHeadings?: string[]; scanInlineFasl?: boolean } = {},
): Array<{ title: string; type: SectionSummary["type"] }> {
  const normalized = text.replace(/\s+/g, " ").trim();
  const candidates: Array<{ allowGenericTopic?: boolean; title: string }> = [];
  options.pageHeadings?.forEach((title) => candidates.push({ allowGenericTopic: true, title }));
  const prefix = normalized.match(/^(.{0,150}?)(?=\s+(?:بسم الله|الحمد لله|أما بعد|قال|فصل|الباب|باب|كتاب|$))/u)?.[1];
  if (prefix) candidates.push({ allowGenericTopic: isLeadTopicCandidate(prefix, normalized), title: prefix });

  for (const match of normalized.matchAll(/\[([^\[\]]{2,140})\]/gu)) {
    candidates.push({ allowGenericTopic: true, title: match[1] ?? "" });
  }

  const direct = normalized.match(/^(?:(كتاب\s+[\u0600-\u06FF].{0,110})|(الباب\s+[\u0600-\u06FF\d].{0,110})|(باب\s+[\u0600-\u06FF\d].{0,110})|(فصل(?:\s|:).{0,110})|(مقدمة(?:\s+[\u0600-\u06FF].{0,80})?))/u);
  if (direct) candidates.unshift({ title: direct[1] ?? direct[2] ?? direct[3] ?? direct[4] ?? direct[5] ?? "" });

  if (options.scanInlineFasl) {
    for (const match of normalized.matchAll(/(?:^|[\s(])((?:ف[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]*ص[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]*ل[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]*[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]*)(?:\s|[):：])[^.!؟؛]{0,120})/gu)) {
      candidates.push({ title: match[1] ?? "" });
    }
  }

  const seen = new Set<string>();
  return candidates
    .map((candidate) => classifySectionTitle(candidate.title, { allowGenericTopic: candidate.allowGenericTopic }))
    .filter((item): item is { title: string; type: SectionSummary["type"] } => item !== null)
    .filter((item) => {
      const key = `${item.type}:${sectionTitleKey(item.title)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function indexEntryNumber(entry: SourceIndexEntry, keys: Array<"level" | "page" | "page_num">) {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function pageNumberForSourcePage(source: SourceBook, sourcePageNumber: number | undefined) {
  if (sourcePageNumber === undefined) return undefined;

  const exact = source.pages.find((page) => page.sourcePageNumber === sourcePageNumber);
  if (exact) return exact.pageNumber;

  const next = source.pages.find((page) => page.sourcePageNumber > sourcePageNumber);
  if (next) return next.pageNumber;

  if (sourcePageNumber >= 0 && sourcePageNumber < source.pages.length) return sourcePageNumber;
  if (sourcePageNumber > 0 && sourcePageNumber <= source.pages.length) return sourcePageNumber - 1;
  return source.pages.at(-1)?.pageNumber;
}

function sectionDepth(section: SectionSummary, sectionById: Map<number, SectionSummary>): number {
  let depth = 0;
  let current = section.parentId ? sectionById.get(section.parentId) : undefined;
  while (current) {
    depth += 1;
    current = current.parentId ? sectionById.get(current.parentId) : undefined;
  }
  return depth;
}

function isDescendantOf(section: SectionSummary, ancestorId: number, sectionById: Map<number, SectionSummary>) {
  let currentParentId = section.parentId;
  while (currentParentId) {
    if (currentParentId === ancestorId) return true;
    currentParentId = sectionById.get(currentParentId)?.parentId ?? null;
  }
  return false;
}

function finalizeSectionRanges(source: SourceBook, sections: SectionSummary[]) {
  const lastPage = source.pages.at(-1)?.pageNumber ?? sections.at(-1)?.startPage ?? 1;
  const sectionById = new Map(sections.map((section) => [section.id, section] as const));
  const depthById = new Map<number, number>();
  const depthFor = (section: SectionSummary) => {
    const cached = depthById.get(section.id);
    if (cached !== undefined) return cached;
    const depth = sectionDepth(section, sectionById);
    depthById.set(section.id, depth);
    return depth;
  };

  sections.forEach((section, index) => {
    section.orderIndex = index;
    const depth = depthFor(section);
    const nextBoundary = sections
      .slice(index + 1)
      .find((candidate) => !isDescendantOf(candidate, section.id, sectionById) && depthFor(candidate) <= depth);
    section.endPage = nextBoundary ? Math.max(section.startPage, nextBoundary.startPage - 1) : lastPage;
  });
}

function buildSectionsFromSourceIndex(
  source: SourceBook,
  editionId: number,
  workId: number,
  nextSectionId: () => number,
): SectionSummary[] {
  const indexEntries = source.indexEntries ?? [];
  if (indexEntries.length === 0) return [];

  const sections: SectionSummary[] = [];
  const stack: Array<{ id: number; level: number }> = [];

  indexEntries.forEach((entry) => {
    const classified = classifySectionTitle(entry.title ?? "", { allowGenericTopic: true });
    const sourcePageNumber = indexEntryNumber(entry, ["page", "page_num"]);
    const startPage = pageNumberForSourcePage(source, sourcePageNumber);
    if (!classified || startPage === undefined) return;

    const level = Math.max(1, indexEntryNumber(entry, ["level"]) ?? (classified.type === "fasl" ? 2 : 1));
    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) stack.pop();

    const id = nextSectionId();
    sections.push({
      direction: source.direction,
      editionId,
      endPage: startPage,
      id,
      languageCode: source.languageCode,
      orderIndex: sections.length,
      parentId: stack.at(-1)?.id ?? null,
      startPage,
      title: classified.title,
      titleAr: classified.title,
      type: classified.type,
      workId,
    });
    stack.push({ id, level });
  });

  return sections;
}

function buildSectionsFromPageText(source: SourceBook, editionId: number, workId: number, nextSectionId: () => number): SectionSummary[] {
  const sections: SectionSummary[] = [];
  let currentBabId: number | null = null;
  let currentFaslId: number | null = null;
  let previousTitle = "";
  const scanInlineFasl = titleKey(source.title).includes("هداية الحيارى");

  source.pages.forEach((page) => {
    detectSectionTitles(page.text, { pageHeadings: page.headings, scanInlineFasl }).forEach((detected) => {
      if (detected.title === previousTitle) return;
      const detectedKey = sectionTitleKey(detected.title);
      const duplicateOnPage = sections.some(
        (section) =>
          section.startPage === page.pageNumber &&
          section.type === detected.type &&
          (sectionTitleKey(section.title) === detectedKey ||
            sectionTitleKey(section.title).startsWith(detectedKey) ||
            detectedKey.startsWith(sectionTitleKey(section.title))),
      );
      if (duplicateOnPage) return;
      previousTitle = detected.title;

      const id = nextSectionId();
      const parentId =
        detected.type === "fasl" ? currentBabId : detected.type === "topic" ? (currentFaslId ?? currentBabId) : null;
      if (detected.type === "bab") {
        currentBabId = id;
        currentFaslId = null;
      } else if (detected.type === "fasl") {
        currentFaslId = id;
      }

      sections.push({
        direction: source.direction,
        editionId,
        endPage: page.pageNumber,
        id,
        languageCode: source.languageCode,
        orderIndex: sections.length,
        parentId,
        startPage: page.pageNumber,
        title: detected.title,
        titleAr: detected.title,
        type: detected.type,
        workId,
      });
    });
  });

  return sections;
}

function buildSections(source: SourceBook, editionId: number, workId: number, nextSectionId: () => number): SectionSummary[] {
  const sections = buildSectionsFromSourceIndex(source, editionId, workId, nextSectionId);
  if (sections.length === 0) sections.push(...buildSectionsFromPageText(source, editionId, workId, nextSectionId));

  const firstPage = source.pages[0]?.pageNumber ?? 0;
  if (sections.length > 0 && sections[0]!.startPage > firstPage) {
    const first = sections[0]!;
    const introTitle =
      source.languageCode === "ar" && titleKey(source.pages[0]?.text ?? "").startsWith("مقدمة")
        ? cleanSectionTitle(source.pages[0]!.text).slice(0, 120)
        : localizedIntroTitle(source.languageCode);
    sections.unshift({
      direction: source.direction,
      editionId,
      endPage: Math.max(firstPage, first.startPage - 1),
      id: nextSectionId(),
      languageCode: source.languageCode,
      orderIndex: 0,
      parentId: null,
      startPage: firstPage,
      title: introTitle,
      titleAr: introTitle,
      type: "heading",
      workId,
    });
  }

  if (sections.length === 0) {
    const fullTextTitle = localizedFullTextTitle(source.languageCode);
    sections.push({
      direction: source.direction,
      editionId,
      endPage: source.pages.at(-1)?.pageNumber ?? 1,
      id: nextSectionId(),
      languageCode: source.languageCode,
      orderIndex: 0,
      parentId: null,
      startPage: source.pages[0]?.pageNumber ?? 1,
      title: fullTextTitle,
      titleAr: fullTextTitle,
      type: "heading",
      workId,
    });
  }

  finalizeSectionRanges(source, sections);
  return sections;
}

function writeShards<T>(dir: string, prefix: string, items: T[], maxBytes = MAX_STATIC_FILE_BYTES): Array<{ count: number; file: string }> {
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

function booksCompatibility(editions: EditionSummary[]) {
  return editions.map((edition) => ({
    ...edition,
    bookId: edition.id,
    chapterCount: edition.sectionCount,
    firstChapterId: edition.defaultSectionId,
    pageCount: edition.pageCount,
    volumes: edition.volumeCount,
  }));
}

function countReadableSections(sections: SectionSummary[]) {
  const nonHeadingSections = sections.filter((section) => section.type !== "heading");
  return nonHeadingSections.length > 0 ? nonHeadingSections.length : sections.length;
}

function isEditionVisibleInLanguage(edition: EditionSummary, languageCode: string) {
  if (edition.status !== "published") return false;
  return edition.languageCode === languageCode;
}

function preferredEditionForLanguage(editions: EditionSummary[], languageCode: string) {
  return editions.find((edition) => edition.languageCode === languageCode) ?? editions[0];
}

function localizedWorks(works: WorkSummary[], editions: EditionSummary[], languageCode: string): WorkSummary[] {
  return works
    .map((work) => {
      const workEditions = editions.filter(
        (edition) => edition.workId === work.id && isEditionVisibleInLanguage(edition, languageCode),
      );
      if (workEditions.length === 0) return null;
      const defaultEdition = preferredEditionForLanguage(workEditions, languageCode)!;
      const displayTitle =
        languageCode === "ar"
          ? work.titleAr
          : containsArabic(defaultEdition.title)
            ? localizedEditionTitleFallback(languageCode)
            : defaultEdition.title;
      return {
        ...work,
        category: localizeCategory(work.category, languageCode),
        defaultEditionId: defaultEdition.id,
        description: languageCode === "ar" ? work.description : localizedEditionCountLabel(workEditions.length, languageCode),
        editionCount: workEditions.length,
        languageCode,
        pageCount: workEditions.reduce((sum, edition) => sum + edition.pageCount, 0),
        sectionCount: workEditions.reduce((sum, edition) => sum + edition.sectionCount, 0),
        title: displayTitle,
        titleAr: displayTitle,
        volumeCount: workEditions.reduce((sum, edition) => sum + edition.volumeCount, 0),
      } satisfies WorkSummary;
    })
    .filter((work): work is WorkSummary => work !== null);
}

function localizedEditionForBundle(
  edition: EditionSummary,
  languageCode: string,
  workTitlesById: Map<number, string>,
): EditionSummary {
  const displayTitle =
    languageCode === "ar"
      ? edition.titleAr
      : containsArabic(edition.title)
        ? (workTitlesById.get(edition.workId) ?? localizedEditionTitleFallback(languageCode))
        : edition.title;

  return {
    ...edition,
    category: localizeCategory(edition.category, languageCode),
    editionLabel: metadataForLanguage(edition.editionLabel, languageCode),
    publisher: metadataForLanguage(edition.publisher, languageCode),
    reviewerName: metadataForLanguage(edition.reviewerName, languageCode),
    sourceTitle: metadataForLanguage(edition.sourceTitle, languageCode),
    titleAr: displayTitle,
    workTitleAr: languageCode === "ar" ? edition.workTitleAr : (workTitlesById.get(edition.workId) ?? displayTitle),
  };
}

function localizedSectionForBundle(section: SectionSummary, languageCode: string): SectionSummary {
  const displayTitle =
    languageCode === "ar" ? section.titleAr : containsArabic(section.title) ? localizedFullTextTitle(languageCode) : section.title;

  return {
    ...section,
    title: displayTitle,
    titleAr: displayTitle,
  };
}

function localizedEditionDetailForBundle(
  detail: EditionDetail,
  languageCode: string,
  workTitlesById: Map<number, string>,
): EditionDetail {
  const edition = localizedEditionForBundle(detail, languageCode, workTitlesById);
  return {
    ...detail,
    ...edition,
    pages: detail.pages.map((page) => ({ ...page, volume: localizedVolumeLabel(page.volume, languageCode) })),
    sections: detail.sections.map((section) => localizedSectionForBundle(section, languageCode)),
  };
}

function localizedSearchDocumentForBundle(
  doc: SearchDocument,
  languageCode: string,
  editionsById: Map<number, EditionSummary>,
  workTitlesById: Map<number, string>,
): SearchDocument {
  const edition = editionsById.get(doc.editionId);
  const pageLabel = localizedPageAbbreviation(languageCode);
  return {
    ...doc,
    bookTitle: edition?.titleAr ?? doc.bookTitle,
    category: localizeCategory(doc.category, languageCode),
    sectionTitle: languageCode === "ar" || !containsArabic(doc.sectionTitle) ? doc.sectionTitle : localizedFullTextTitle(languageCode),
    snippetTitle: `${edition?.titleAr ?? doc.bookTitle} / ${pageLabel} ${doc.pageNumber}`,
    workTitle: workTitlesById.get(doc.workId) ?? doc.workTitle,
  };
}

function writeLanguageBundle(params: {
  editionDetails: Map<number, EditionDetail>;
  editions: EditionSummary[];
  index: SourceIndex;
  languageCode: string;
  searchIndex: SearchDocument[];
  targetDir: string;
  works: WorkSummary[];
}) {
  const { editionDetails, editions, index, languageCode, searchIndex, targetDir, works } = params;
  const languageWorks = localizedWorks(works, editions, languageCode);
  const workTitlesById = new Map(languageWorks.map((work) => [work.id, work.titleAr]));
  const languageEditions = editions
    .filter((edition) => isEditionVisibleInLanguage(edition, languageCode))
    .map((edition) => localizedEditionForBundle(edition, languageCode, workTitlesById));
  const languageEditionsById = new Map(languageEditions.map((edition) => [edition.id, edition]));
  const languageCategories = Array.from(
    languageWorks.reduce((map, work) => map.set(work.category, (map.get(work.category) ?? 0) + 1), new Map<string, number>()),
  )
    .map(([name, count]) => ({ count, name }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, languageCode === "ar" ? "ar" : undefined));

  mkdirSync(path.join(targetDir, "works"), { recursive: true });
  mkdirSync(path.join(targetDir, "editions"), { recursive: true });
  mkdirSync(path.join(targetDir, "edition-pages"), { recursive: true });
  mkdirSync(path.join(targetDir, "search-index"), { recursive: true });

  writeJson(path.join(targetDir, "languages.json"), SUPPORTED_LANGUAGES);
  writeJson(path.join(targetDir, "works.json"), languageWorks);
  writeJson(path.join(targetDir, "editions.json"), languageEditions);
  writeJson(path.join(targetDir, "categories.json"), languageCategories);
  writeJson(path.join(targetDir, "books.json"), booksCompatibility(languageEditions));

  const workIds = new Set(languageWorks.map((work) => work.id));
  languageWorks.forEach((work) => {
    const workEditions = languageEditions.filter((edition) => edition.workId === work.id);
    const sectionIds = workEditions.flatMap((edition) => editionDetails.get(edition.id)?.sections.map((section) => section.id) ?? []);
    writeJson(path.join(targetDir, "works", `${work.id}.json`), {
      ...work,
      editionIds: workEditions.map((edition) => edition.id),
      editions: workEditions,
      sectionIds,
    });
  });

  languageEditions.forEach((edition) => {
    const rawDetail = editionDetails.get(edition.id);
    if (!rawDetail) return;
    const detail = localizedEditionDetailForBundle(rawDetail, languageCode, workTitlesById);
    const pageShards = writeShards(path.join(targetDir, "edition-pages"), `edition-${edition.id}`, detail.pages);
    let pageCursor = 0;
    const pageParts = pageShards.map((shard) => {
      const shardPages = detail.pages.slice(pageCursor, pageCursor + shard.count);
      pageCursor += shard.count;
      return { ...shard, pageIds: shardPages.map((page) => page.id) };
    });
    writeJson(path.join(targetDir, "editions", `${edition.id}.json`), { ...detail, pageParts });
  });

  const languageSearchIndex = searchIndex
    .filter((doc) => workIds.has(doc.workId) && doc.languageCode === languageCode)
    .map((doc) => localizedSearchDocumentForBundle(doc, languageCode, languageEditionsById, workTitlesById));
  const searchShards = writeShards(path.join(targetDir, "search-index"), "part", languageSearchIndex);
  writeJson(path.join(targetDir, "search-index", "manifest.json"), {
    count: languageSearchIndex.length,
    languageCode,
    shards: searchShards,
  });

  writeJson(path.join(targetDir, "manifest.json"), {
    author: index.author,
    booksCount: languageWorks.length,
    categoriesCount: languageCategories.length,
    chaptersCount: languageEditions.reduce((sum, edition) => sum + edition.sectionCount, 0),
    editionsCount: languageEditions.length,
    generatedAt: new Date().toISOString(),
    languageCode,
    pagesCount: languageEditions.reduce((sum, edition) => sum + edition.pageCount, 0),
    source: index.source,
    sourceExtractedAt: index.extracted_at,
    version: 3,
  });
}

function main() {
  const index = loadSourceIndex();
  const coverMetadata = readOptionalJson<BookCoverMetadata[]>(COVER_METADATA_FILE, []);
  const coversBySourceId = new Map(coverMetadata.filter((item) => typeof item.sourceId === "number").map((item) => [item.sourceId!, item]));
  const coversBySlug = new Map(coverMetadata.filter((item) => item.slug).map((item) => [item.slug!, item]));

  rmSync(TARGET_DIR, { force: true, recursive: true });
  mkdirSync(TARGET_DIR, { recursive: true });

  const sourceBooks = selectPreferredEditions(index.books
    .map((entry) => {
      const source = readSourceBook(path.join(SOURCE_DIR, entry.file));
      if (!source) return null;
      return { ...source, sourceId: entry.source_id ?? source.sourceId, volumes: entry.volumes ?? source.volumes };
    })
    .filter((source): source is SourceBook => source !== null));

  const workGroups = new Map<string, { baseTitle: string; sources: SourceBook[] }>();
  for (const source of sourceBooks) {
    const baseTitle = canonicalWorkTitle(stripEdition(source.sourceTitle ?? source.title));
    const key = titleKey(baseTitle);
    if (!workGroups.has(key)) workGroups.set(key, { baseTitle, sources: [] });
    workGroups.get(key)!.sources.push(source);
  }

  const works: WorkSummary[] = [];
  const editions: EditionSummary[] = [];
  const editionDetails = new Map<number, EditionDetail>();
  const searchIndex: SearchDocument[] = [];

  let nextEditionId = 1;
  let nextPageId = 1;
  let nextSectionIdValue = 1;
  const nextSectionId = () => nextSectionIdValue++;

  Array.from(workGroups.values())
    .sort((a, b) => a.baseTitle.localeCompare(b.baseTitle, "ar"))
    .forEach(({ baseTitle, sources: group }, workIndex) => {
      const workId = workIndex + 1;
      const category = getWorkCategory(baseTitle, group);
      const slug = slugify(baseTitle);
      const sortedEditions = group.sort(
        (a, b) =>
          (a.languageCode === "ar" ? 0 : 1) - (b.languageCode === "ar" ? 0 : 1) ||
          a.title.localeCompare(b.title, a.languageCode === "ar" ? "ar" : undefined),
      );
      const first = sortedEditions[0]!;
      const coverCandidate = coversBySourceId.get(first.sourceId) ?? coversBySlug.get(first.id);
      const cover = hasLocalCoverFile(coverCandidate) ? coverCandidate : undefined;
      const workEditionIds: number[] = [];
      let totalPages = 0;
      let totalVolumes = 0;

      sortedEditions.forEach((source) => {
        const editionId = nextEditionId++;
        const coverCandidateForEdition = coversBySourceId.get(source.sourceId) ?? coversBySlug.get(source.id);
        const editionCover = hasLocalCoverFile(coverCandidateForEdition) ? coverCandidateForEdition : cover;
        const edition = extractEdition(source.title, source.data);
        const sections = buildSections(source, editionId, workId, nextSectionId);
        const pages: PageDetail[] = source.pages.map((page, orderIndex) => {
          const section = sections
            .slice()
            .reverse()
            .find((item) => page.pageNumber >= item.startPage && page.pageNumber <= item.endPage);
          return {
            direction: source.direction,
            editionId,
            id: nextPageId++,
            languageCode: source.languageCode,
            orderIndex,
            pageNumber: page.pageNumber,
            sectionId: section?.id ?? null,
            sourcePageNumber: page.sourcePageNumber,
            text: page.text,
            volume: page.volume,
            workId,
          };
        });

        const editionSummary: EditionSummary = {
          category,
          coverColor: COVER_COLORS[(editionId - 1) % COVER_COLORS.length]!,
          coverImageAlt: editionCover?.coverImageAlt,
          coverImageUrl: editionCover?.coverImageUrl,
          defaultSectionId: sections[0]!.id,
          direction: source.direction,
          editionLabel: edition.editionLabel,
          id: editionId,
          kind: source.kind,
          languageCode: source.languageCode,
          languageName: source.languageName,
          pageCount: pages.length,
          publisher: editionCover?.publisher ?? edition.publisher,
          reviewerName: source.reviewerName,
          sectionCount: countReadableSections(sections),
          sourceFile: source.kind === "translation" ? githubSourcePath(source.file) : undefined,
          sourceId: source.sourceId,
          sourceTitle: source.sourceTitle,
          status: source.status,
          title: source.title,
          titleAr: source.sourceTitle ?? source.title,
          translatorName: source.translatorName,
          volumeCount: source.volumes,
          workId,
          workTitleAr: baseTitle,
        };

        editions.push(editionSummary);
        workEditionIds.push(editionId);
        totalPages += pages.length;
        totalVolumes += source.volumes;

        if (source.status === "published") {
          pages.forEach((page) => {
            const section = sections.find((item) => item.id === page.sectionId) ?? sections[0]!;
            searchIndex.push({
              bookId: editionId,
              bookTitle: source.title,
              category,
              content: page.text.slice(0, 1200),
              editionId,
              languageCode: source.languageCode,
              pageId: page.id,
              pageNumber: page.pageNumber,
              sectionId: section.id,
              sectionTitle: section.titleAr,
              snippetTitle: `${source.title} / ص ${page.pageNumber}`,
              workId,
              workTitle: baseTitle,
            });
          });
        }

        const editionDetail: EditionDetail = {
          ...editionSummary,
          pageParts: [],
          pages,
          sections,
        };
        editionDetails.set(editionId, editionDetail);
      });

      const defaultEdition = editions.find((edition) => edition.id === workEditionIds[0])!;
      const work: WorkSummary = {
        category,
        coverColor: defaultEdition.coverColor,
        coverImageAlt: cover?.coverImageAlt,
        coverImageUrl: cover?.coverImageUrl,
        defaultEditionId: defaultEdition.id,
        description: buildWorkDescription(category, sortedEditions),
        editionCount: workEditionIds.length,
        id: workId,
        languageCode: defaultEdition.languageCode,
        pageCount: totalPages,
        sectionCount: editions.filter((edition) => workEditionIds.includes(edition.id)).reduce((sum, edition) => sum + edition.sectionCount, 0),
        slug,
        title: baseTitle,
        titleAr: baseTitle,
        volumeCount: totalVolumes,
      };

      works.push(work);
    });

  SUPPORTED_LANGUAGES.forEach((language) => {
    writeLanguageBundle({
      editionDetails,
      editions,
      index,
      languageCode: language.code,
      searchIndex,
      targetDir: path.join(TARGET_DIR, language.code),
      works,
    });
  });

  console.log(`Generated ${works.length} works, ${editions.length} editions, and ${nextSectionIdValue - 1} sections in ${TARGET_DIR}`);
}

main();
