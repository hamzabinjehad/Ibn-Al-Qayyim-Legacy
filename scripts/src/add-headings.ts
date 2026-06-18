/**
 * Post-processes already-extracted book JSON files to inject [[H:...]] heading markers.
 *
 * Each page entry from turath.io includes a `headings[]` breadcrumb array
 * (e.g. ["كتاب العلم", "باب الصبر"]). When that breadcrumb changes between pages,
 * the new heading starts on the current page. This script prepends [[H:heading]]
 * markers to each such page so the ChapterReader can render them visually.
 *
 * Safe to re-run: skips injection if [[H:...]] already exists in the page text
 * (i.e. after a real re-extraction with the updated stripHtml).
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, "../output/ibn-qayyim");

interface PageEntry {
  headings?: string[];
  page?: number;
  page_num?: number;
  text: string;
  vol?: string;
  volume?: string;
}

interface BookFile {
  id?: string;
  title?: string;
  pages?: PageEntry[];
  [key: string]: unknown;
}

function collectJsonFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir).sort((a, b) => a.localeCompare(b, "ar"))) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectJsonFiles(fullPath));
    } else if (extname(entry) === ".json" && entry !== "index.json" && !entry.endsWith(".progress.json")) {
      files.push(fullPath);
    }
  }
  return files;
}

const bookFiles = collectJsonFiles(SOURCE_DIR);
console.log(`Found ${bookFiles.length} book files.\n`);

let totalModified = 0;

for (const filePath of bookFiles) {
  let book: BookFile;
  try {
    book = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    console.warn(`⚠️  Cannot parse ${filePath}`);
    continue;
  }

  if (!Array.isArray(book.pages) || book.pages.length === 0) continue;

  // Skip non-Arabic turath books (translations don't have headings metadata)
  const hasHeadings = book.pages.some((p) => Array.isArray(p.headings) && p.headings.length > 0);
  if (!hasHeadings) continue;

  let previousHeadings: string[] = [];
  let modified = false;

  for (const page of book.pages) {
    const current = Array.isArray(page.headings) ? page.headings : [];

    // Find first index where breadcrumb diverges from previous page
    let divergeAt = -1;
    for (let i = 0; i < current.length; i++) {
      if (current[i] !== previousHeadings[i]) {
        divergeAt = i;
        break;
      }
    }
    // Handle array length change without content change at earlier indices
    if (divergeAt === -1 && current.length !== previousHeadings.length) {
      divergeAt = Math.min(current.length, previousHeadings.length);
    }

    if (divergeAt !== -1) {
      const newHeadings = current.slice(divergeAt).filter(Boolean);

      // Only inject headings not already present as [[H:...]] in text
      const toInject = newHeadings.filter((h) => !page.text.includes(`[[H:${h}]]`));

      if (toInject.length > 0) {
        const markers = toInject.map((h) => `[[H:${h}]]`).join("\n\n");
        page.text = `${markers}\n\n${page.text.trimStart()}`;
        modified = true;
      }
    }

    if (current.length > 0) previousHeadings = [...current];
  }

  const label = book.title ?? path.relative(SOURCE_DIR, filePath);
  if (modified) {
    writeFileSync(filePath, JSON.stringify(book, null, 2), "utf-8");
    process.stdout.write(`✅ ${label}\n`);
    totalModified++;
  } else {
    process.stdout.write(`·  ${label}\n`);
  }
}

console.log(`\nDone: ${totalModified}/${bookFiles.length} books updated with heading markers.`);
