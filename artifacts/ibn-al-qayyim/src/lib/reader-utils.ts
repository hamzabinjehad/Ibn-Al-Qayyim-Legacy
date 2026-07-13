import { type LocalHighlight } from "@/lib/local-library";
import { type PageDetail } from "@/lib/static-library";
import { translateUi } from "@/lib/ui-translations";

export type ReaderStatus = "copied" | "highlightDeleted" | "highlighted" | "noted" | "saved" | null;
export type HighlightColor = string;
export type HighlightSurface = "main" | "footnote";

export type SelectionPosition = {
  endOffset: number;
  pageId: number;
  startOffset: number;
  surface: HighlightSurface;
};

export type PageFootnote = {
  id: string;
  marker: string;
  markerKey: string;
  text: string;
};

export type ParsedFootnote = {
  marker: string;
  text: string;
};

export const FOOTNOTE_DIGIT_CLASS = "\\d\\u0660-\\u0669\\u06f0-\\u06f9";
export const FOOTNOTE_SEPARATOR_REGEX =
  /(?:^|\n)\s*(?:_{5,}|ـ{5,}|-{5,})\s*(?:\n|$)|\s+(?:_{5,}|ـ{5,}|-{5,})\s+/u;
export const FOOTNOTE_BLOCK_MARKER_REGEX = new RegExp(
  `(?:^|\\n)\\s*(?:\\(\\^?([${FOOTNOTE_DIGIT_CLASS}]+)\\)|\\[([${FOOTNOTE_DIGIT_CLASS}]+)\\]|(\\^?[${FOOTNOTE_DIGIT_CLASS}]+))\\s*[\\-\\u2013\\u2014:\\uFF1A\\.\\u060c]?\\s*`,
  "gu",
);
export const FOOTNOTE_REFERENCE_REGEX = new RegExp(
  `\\(\\^?[${FOOTNOTE_DIGIT_CLASS}]+\\)|([\\p{L}\\]\\)\\u00bb])([${FOOTNOTE_DIGIT_CLASS}]{1,3})(?![${FOOTNOTE_DIGIT_CLASS}])`,
  "gu",
);
export const FOOTNOTE_FOCUS_MS = 6000;
export const HIGHLIGHT_SURFACE_SELECTOR = "[data-reader-highlight-surface]";
export const MIN_READER_FONT_SIZE = 12;
export const MAX_READER_FONT_SIZE = 72;

export function clampReaderFontSize(value: number) {
  if (!Number.isFinite(value)) return MIN_READER_FONT_SIZE;
  return Math.min(MAX_READER_FONT_SIZE, Math.max(MIN_READER_FONT_SIZE, Math.round(value)));
}

export function currentScrollY() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

export function scrollTopThreshold() {
  return Math.min(700, Math.max(360, window.innerHeight * 0.7));
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for browsers that expose Clipboard API but block it outside secure gestures.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function buildShareText(
  text: string,
  bookTitle: string,
  chapterTitle: string,
  language: "ar" | "de" | "en",
) {
  return `${text.trim()}\n\n- ${translateUi(language, "ابن القيم الجوزية رحمه الله")}\n${bookTitle} / ${chapterTitle}`;
}

export function normalizeFootnoteMarker(marker: string) {
  return marker
    .replace(/[\[\]()^]/g, "")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .trim();
}

export function displayFootnoteMarker(marker: string) {
  return marker.replace(/[\[\]()^]/g, "").trim();
}

export function footnoteId(pageId: number, markerKey: string) {
  return `reader-footnote-${pageId}-${markerKey.replace(/[^\w-]/g, "")}`;
}

export function displayPageNumber(page: Pick<PageDetail, "pageNumber" | "sourcePageNumber"> | undefined) {
  return page?.sourcePageNumber ?? page?.pageNumber ?? 0;
}

export function parseFootnoteBlock(text: string): ParsedFootnote[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  const matches = Array.from(normalized.matchAll(FOOTNOTE_BLOCK_MARKER_REGEX));
  if (matches.length === 0) {
    return [{ marker: "", text: normalized }];
  }

  return matches
    .map((match, index) => {
      const marker = match[1] ?? match[2] ?? match[3] ?? "";
      const start = (match.index ?? 0) + (match[0]?.length ?? 0);
      const end = matches[index + 1]?.index ?? normalized.length;
      const footnoteText = normalized.slice(start, end).replace(/^\s*[:：.،-]?\s*/, "").trim();
      return { marker, text: footnoteText };
    })
    .filter((footnote) => footnote.marker || footnote.text);
}

export function splitPageFootnotes(text: string) {
  const match = FOOTNOTE_SEPARATOR_REGEX.exec(text);
  if (!match) {
    return {
      footnotes: [] as ParsedFootnote[],
      mainText: text,
      rawFootnotes: "",
    };
  }

  const mainText = text.slice(0, match.index).trimEnd();
  const rawFootnotes = text.slice(match.index + match[0].length).trim();

  return {
    footnotes: parseFootnoteBlock(rawFootnotes),
    mainText,
    rawFootnotes,
  };
}

export function isPositionedHighlight(highlight: LocalHighlight): highlight is LocalHighlight & SelectionPosition {
  return (
    typeof highlight.pageId === "number" &&
    typeof highlight.startOffset === "number" &&
    typeof highlight.endOffset === "number" &&
    (highlight.surface === "main" || highlight.surface === "footnote") &&
    highlight.endOffset > highlight.startOffset
  );
}

export function getHighlightSurface(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest<HTMLElement>(HIGHLIGHT_SURFACE_SELECTOR) ?? null;
}

export function surfacePosition(surface: HTMLElement): Pick<SelectionPosition, "pageId" | "surface"> | null {
  const pageId = Number(surface.dataset.readerPageId);
  const surfaceName = surface.dataset.readerHighlightSurface;
  if (!Number.isFinite(pageId) || (surfaceName !== "main" && surfaceName !== "footnote")) return null;
  return { pageId, surface: surfaceName };
}

export function getSelectionPosition(selection: Selection, contentElement: HTMLElement): SelectionPosition | null {
  if (selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const startSurface = getHighlightSurface(range.startContainer);
  const endSurface = getHighlightSurface(range.endContainer);
  if (!startSurface || startSurface !== endSurface || !contentElement.contains(startSurface)) return null;

  const surfaceMeta = surfacePosition(startSurface);
  if (!surfaceMeta) return null;

  const selectedText = range.toString();
  const leadingWhitespace = selectedText.match(/^\s*/)?.[0].length ?? 0;
  const trailingWhitespace = selectedText.match(/\s*$/)?.[0].length ?? 0;
  const trimmedLength = selectedText.length - leadingWhitespace - trailingWhitespace;
  if (trimmedLength <= 0) return null;

  const offsetRange = range.cloneRange();
  offsetRange.selectNodeContents(startSurface);
  offsetRange.setEnd(range.startContainer, range.startOffset);

  const offsetBase = Number(startSurface.dataset.readerOffsetBase ?? 0);
  const startOffset = offsetBase + offsetRange.toString().length + leadingWhitespace;
  const endOffset = startOffset + trimmedLength;
  return {
    ...surfaceMeta,
    endOffset,
    startOffset,
  };
}
