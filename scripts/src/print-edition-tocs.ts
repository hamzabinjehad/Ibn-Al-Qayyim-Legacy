import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY_DATA_DIR = path.resolve(__dirname, "../../artifacts/ibn-al-qayyim/public/library-data");
const OUTPUT_DIR = path.resolve(__dirname, "../output/toc-reports");

interface SectionSummary {
  endPage: number;
  id: number;
  parentId: number | null;
  startPage: number;
  title: string;
  type: string;
}

interface PageDetail {
  pageNumber: number;
  sourcePageNumber: number;
  volume: string;
}

interface EditionDetail {
  editionLabel?: string;
  id: number;
  pages: PageDetail[];
  publisher?: string;
  sectionCount: number;
  sections: SectionSummary[];
  sourceFile?: string;
  sourceId: number;
  title: string;
  workTitleAr: string;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    filter: valueAfter(args, "--filter"),
    language: valueAfter(args, "--language") ?? "ar",
    outDir: valueAfter(args, "--out") ?? OUTPUT_DIR,
    stdout: args.includes("--stdout"),
  };
}

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function depthFor(section: SectionSummary, sectionsById: Map<number, SectionSummary>) {
  let depth = 0;
  let parent = section.parentId ? sectionsById.get(section.parentId) : undefined;
  while (parent) {
    depth += 1;
    parent = parent.parentId ? sectionsById.get(parent.parentId) : undefined;
  }
  return depth;
}

function pageLabel(page: PageDetail | undefined) {
  if (!page) return "source-page ?";
  const volume = page.volume ? `${page.volume} / ` : "";
  return `${volume}${page.sourcePageNumber}`;
}

function hasStartPageDrops(sections: SectionSummary[]) {
  return sections.some((section, index) => index > 0 && section.startPage < sections[index - 1]!.startPage);
}

function renderEditionToc(edition: EditionDetail) {
  const sectionsById = new Map(edition.sections.map((section) => [section.id, section] as const));
  const pagesByOrder = new Map(edition.pages.map((page) => [page.pageNumber, page] as const));
  const lines: string[] = [];

  lines.push(`# Edition ${edition.id}: ${edition.title}`);
  lines.push("");
  lines.push(`- Work: ${edition.workTitleAr}`);
  lines.push(`- Edition label: ${edition.editionLabel ?? "-"}`);
  lines.push(`- Publisher: ${edition.publisher ?? "-"}`);
  lines.push(`- Source ID: ${edition.sourceId || "-"}`);
  if (edition.sourceFile) lines.push(`- Source file: ${edition.sourceFile}`);
  lines.push(`- Pages: ${edition.pages.length}`);
  lines.push(`- Sections: ${edition.sections.length}`);
  lines.push(`- Start-page order: ${hasStartPageDrops(edition.sections) ? "has drops" : "monotonic"}`);
  lines.push("");
  lines.push("## TOC");
  lines.push("");

  for (const section of edition.sections) {
    const depth = depthFor(section, sectionsById);
    const indent = "  ".repeat(depth);
    const start = pagesByOrder.get(section.startPage);
    const end = pagesByOrder.get(section.endPage);
    const range =
      section.startPage === section.endPage
        ? pageLabel(start)
        : `${pageLabel(start)} - ${pageLabel(end)}`;
    lines.push(`${indent}- ${range} | ${section.type} | ${section.title}`);
  }

  lines.push("");
  return lines.join("\n");
}

function main() {
  const args = parseArgs();
  const editionsDir = path.join(LIBRARY_DATA_DIR, args.language, "editions");
  if (!existsSync(editionsDir)) throw new Error(`Missing editions directory: ${editionsDir}`);

  const outDir = path.resolve(args.outDir, args.language);
  rmSync(outDir, { force: true, recursive: true });
  mkdirSync(outDir, { recursive: true });

  const editionFiles = readdirSync(editionsDir)
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => Number(path.basename(a, ".json")) - Number(path.basename(b, ".json")));

  const editions = editionFiles
    .map((file) => readJson<EditionDetail>(path.join(editionsDir, file)))
    .filter((edition) => !args.filter || edition.title.includes(args.filter) || edition.workTitleAr.includes(args.filter));

  const summaryLines = ["# Edition TOC Summary", ""];
  for (const edition of editions) {
    const content = renderEditionToc(edition);
    const fileName = `edition-${String(edition.id).padStart(3, "0")}.md`;
    writeText(path.join(outDir, fileName), content);
    summaryLines.push(
      `- Edition ${edition.id}: ${edition.title} | sections ${edition.sections.length} | pages ${edition.pages.length} | ${hasStartPageDrops(edition.sections) ? "has start-page drops" : "monotonic"}`,
    );
    if (args.stdout) process.stdout.write(`${content}\n`);
  }

  summaryLines.push("");
  writeText(path.join(outDir, "SUMMARY.md"), summaryLines.join("\n"));
  console.log(`Wrote ${editions.length} TOC reports to ${outDir}`);
}

main();
