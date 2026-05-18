import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../../artifacts/ibn-al-qayyim/public");
const DATA_DIR = path.join(PUBLIC_DIR, "library-data");
const DEFAULT_SITE_URL = "https://ibn-al-qayyim-legacy.vercel.app";

type LanguageCode = "ar" | "de" | "en";

interface WorkSummary {
  id: number;
}

interface EditionSummary {
  id: number;
}

interface EditionDetail {
  sections: Array<{ id: number }>;
}

const LANGUAGES: LanguageCode[] = ["ar", "de", "en"];

function siteUrl() {
  const raw =
    process.env.SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    DEFAULT_SITE_URL;
  const withProtocol = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function addUrl(
  urls: string[],
  baseUrl: string,
  pathName: string,
  options: { changefreq?: string; priority?: string } = {},
) {
  const normalizedPath = pathName === "/" ? "/" : pathName.replace(/\/$/, "");
  const loc = `${baseUrl}${normalizedPath}`;
  const changefreq = options.changefreq ?? "weekly";
  const priority = options.priority ?? "0.7";
  urls.push(
    [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      "  </url>",
    ].join("\n"),
  );
}

function buildSitemap() {
  const baseUrl = siteUrl();
  const urls: string[] = [];

  LANGUAGES.forEach((language) => {
    const prefix = `/${language}`;
    const languageDir = path.join(DATA_DIR, language);
    addUrl(urls, baseUrl, `${prefix}/`, { changefreq: "weekly", priority: "1.0" });
    addUrl(urls, baseUrl, `${prefix}/library`, { changefreq: "weekly", priority: "0.9" });
    addUrl(urls, baseUrl, `${prefix}/search`, { changefreq: "monthly", priority: "0.6" });
    if (language === "ar") addUrl(urls, baseUrl, `${prefix}/reading-plan`, { changefreq: "monthly", priority: "0.6" });

    const works = readJson<WorkSummary[]>(path.join(languageDir, "works.json")) ?? [];
    works.forEach((work) => {
      addUrl(urls, baseUrl, `${prefix}/work/${work.id}`, { changefreq: "monthly", priority: "0.8" });
    });

    const editions = readJson<EditionSummary[]>(path.join(languageDir, "editions.json")) ?? [];
    editions.forEach((edition) => {
      addUrl(urls, baseUrl, `${prefix}/edition/${edition.id}`, { changefreq: "monthly", priority: "0.8" });
      const detail = readJson<EditionDetail>(path.join(languageDir, "editions", `${edition.id}.json`));
      detail?.sections.forEach((section) => {
        addUrl(urls, baseUrl, `${prefix}/edition/${edition.id}/section/${section.id}`, {
          changefreq: "yearly",
          priority: "0.5",
        });
      });
    });
  });

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
  writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), sitemap, "utf8");

  const robots = [`User-agent: *`, `Allow: /`, `Sitemap: ${baseUrl}/sitemap.xml`, ""].join("\n");
  writeFileSync(path.join(PUBLIC_DIR, "robots.txt"), robots, "utf8");

  console.log(`Generated ${urls.length} sitemap URLs for ${baseUrl}`);
}

buildSitemap();
