import type { LanguageCode } from "@/lib/i18n";

export const CONTRIBUTION_LINKS = {
  githubBranch: "main",
  githubRepoUrl: "https://github.com/hamzabinjehad/Ibn-Al-Qayyim-Legacy",
  supportUrl: "https://t.me/IbnAlQayyiumSupport_bot",
} as const;

export interface TranslationCorrectionLinkInput {
  currentUrl?: string;
  editionId: number;
  editionTitle: string;
  language: LanguageCode;
  pageNumber?: number;
  sectionId?: number;
  sectionTitle?: string;
  selectedText?: string;
  sourceFile?: string;
  sourcePageNumber?: number;
  workTitle?: string;
}

function githubUrl(path: string) {
  return `${CONTRIBUTION_LINKS.githubRepoUrl}/${path.replace(/^\/+/, "")}`;
}

function encodePath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function field(label: string, value: string | number | undefined | null) {
  return `**${label}:** ${value === undefined || value === null || value === "" ? "-" : value}`;
}

export function buildSourceEditUrl(sourceFile: string) {
  return githubUrl(`edit/${CONTRIBUTION_LINKS.githubBranch}/scripts/output/ibn-qayyim/${encodePath(sourceFile)}`);
}

export function buildSupportUrl() {
  return CONTRIBUTION_LINKS.supportUrl;
}

export function buildTranslationIssueUrl(input: TranslationCorrectionLinkInput) {
  const title = `Translation correction: ${input.editionTitle}`;
  const body = [
    "## Translation correction",
    "",
    field("Language", input.language),
    field("Work", input.workTitle),
    field("Edition", input.editionTitle),
    field("Edition ID", input.editionId),
    field("Section", input.sectionTitle),
    field("Section ID", input.sectionId),
    field("Displayed page", input.pageNumber),
    field("Source page", input.sourcePageNumber),
    field("Source file", input.sourceFile),
    field("Reader URL", input.currentUrl),
    "",
    "## Selected text",
    "",
    input.selectedText?.trim() ? `> ${input.selectedText.trim().replace(/\n/g, "\n> ")}` : "_No text selected._",
    "",
    "## Suggested correction",
    "",
    "_Write the corrected German text here._",
    "",
    "## Notes",
    "",
    "_Add context, source comparison, or review notes here._",
  ].join("\n");

  const params = new URLSearchParams({
    body,
    labels: "translation-correction",
    title,
  });

  return githubUrl(`issues/new?${params.toString()}`);
}

export function isConfiguredUrl(url: string) {
  return /^https?:\/\//i.test(url);
}
