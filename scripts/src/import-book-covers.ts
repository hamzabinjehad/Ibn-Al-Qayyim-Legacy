import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "../..");
const METADATA_FILE = resolve(__dirname, "../metadata/book-covers.json");
const PUBLIC_DIR = resolve(ROOT_DIR, "artifacts/ibn-al-qayyim/public");

interface BookCoverMetadata {
  coverImageAlt?: string;
  coverImageUrl?: string;
  downloadUrl?: string;
  publisher?: string;
  slug?: string;
  sourceUrl?: string;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; Ibn-Al-Qayyim-Legacy/1.0)",
};

function requestText(url: string, redirects = 0): Promise<string> {
  return new Promise((resolveText, reject) => {
    const client = url.startsWith("https:") ? https : http;
    client
      .get(url, { headers: REQUEST_HEADERS }, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          if (redirects >= 5) {
            reject(new Error(`Too many redirects for ${url}`));
            return;
          }
          resolveText(requestText(absolutizeUrl(response.headers.location, url), redirects + 1));
          return;
        }

        if (!response.statusCode || response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode ?? "unknown"} for ${url}`));
          response.resume();
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => resolveText(body));
      })
      .on("error", reject);
  });
}

function downloadFile(url: string, targetPath: string, redirects = 0): Promise<void> {
  return new Promise((resolveDownload, reject) => {
    const client = url.startsWith("https:") ? https : http;

    client
      .get(url, { headers: REQUEST_HEADERS }, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          if (redirects >= 5) {
            reject(new Error(`Too many redirects for ${url}`));
            return;
          }
          resolveDownload(downloadFile(absolutizeUrl(response.headers.location, url), targetPath, redirects + 1));
          return;
        }

        if (!response.statusCode || response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode ?? "unknown"} for ${url}`));
          response.resume();
          return;
        }

        mkdirSync(dirname(targetPath), { recursive: true });
        const file = createWriteStream(targetPath);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolveDownload();
        });
      })
      .on("error", reject);
  });
}

function absolutizeUrl(value: string, baseUrl: string): string {
  return new URL(value.replace(/&amp;/g, "&"), baseUrl).toString();
}

function extractImageUrl(html: string, pageUrl: string): string | null {
  const metaMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const metaContent = metaMatch?.[1];
  if (metaContent) return absolutizeUrl(metaContent, pageUrl);

  const imageMatches = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi));
  const preferred = imageMatches.find((match) => /book|cover|upload|ShowImage|Books/i.test(match[1] ?? ""));
  const fallback = imageMatches[0];
  const src = preferred?.[1] ?? fallback?.[1];
  return src ? absolutizeUrl(src, pageUrl) : null;
}

async function resolveDownloadUrl(entry: BookCoverMetadata): Promise<string | null> {
  if (entry.downloadUrl) return entry.downloadUrl;
  if (!entry.sourceUrl) return null;
  const html = await requestText(entry.sourceUrl);
  return extractImageUrl(html, entry.sourceUrl);
}

async function main() {
  const covers = readJson<BookCoverMetadata[]>(METADATA_FILE);
  for (const cover of covers) {
    if (!cover.coverImageUrl) {
      console.log(`skip ${cover.slug ?? cover.coverImageAlt ?? "unknown"}: missing coverImageUrl`);
      continue;
    }

    const targetPath = resolve(PUBLIC_DIR, cover.coverImageUrl.replace(/^\//, ""));
    if (existsSync(targetPath) && statSync(targetPath).size > 0) {
      console.log(`exists ${cover.coverImageUrl}`);
      continue;
    }

    try {
      const downloadUrl = await resolveDownloadUrl(cover);
      if (!downloadUrl) {
        console.log(`skip ${cover.slug ?? cover.coverImageUrl}: missing downloadUrl/source image`);
        continue;
      }

      await downloadFile(downloadUrl, targetPath);
      console.log(`downloaded ${cover.coverImageUrl}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`failed ${cover.coverImageUrl}: ${message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
