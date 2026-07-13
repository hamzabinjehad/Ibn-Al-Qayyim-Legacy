import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bold,
  Check,
  Copy,
  Download,
  Globe2,
  ImageDown,
  Italic,
  Link as LinkIcon,
  MessageCircle,
  Palette,
  Pencil,
  Send,
  Share2,
  Sparkles,
  Type,
  Twitter,
  X,
} from "lucide-react";
import type { LanguageCode, TextDirection } from "@/lib/i18n";
import { formatNumber, pageText, useUiTranslations } from "@/lib/ui-translations";

interface Props {
  text: string;
  bookTitle: string;
  chapterTitle: string;
  pageNumber?: number;
  onClose: () => void;
}

type QuotePresetKey = "parchment" | "sage";
type ShareFormat = "square" | "story";
type CopiedKind = "text" | "image" | "link";

type ShareSourceDetails = {
  includeBookTitle: boolean;
  includeLocation: boolean;
};

type ShareTextOptions = {
  showSource: boolean;
  sourceDetails: ShareSourceDetails;
  showSite: boolean;
  sourceUrl?: string;
};

type ShareColors = {
  accent: string;
  background: string;
};

type QuoteTextMark = {
  id: string;
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  sizeScale?: number;
};

type QuoteSelection = {
  start: number;
  end: number;
};

type EffectiveTextStyle = {
  bold: boolean;
  italic: boolean;
  color?: string;
  sizeScale: number;
};

type StyledTextRun = {
  text: string;
  start: number;
  end: number;
  style: EffectiveTextStyle;
};

type StyledTextLine = {
  runs: StyledTextRun[];
  width: number;
};

type QuotePreset = {
  key: QuotePresetKey;
  title: string;
  description: string;
  accent: string;
  background: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  dark?: boolean;
};

const baseQuotePresets: QuotePreset[] = [
  {
    key: "parchment",
    title: "\u0648\u0631\u0642 \u0623\u062b\u0631\u064a",
    description: "\u0628\u0637\u0627\u0642\u0629 \u0647\u0627\u062f\u0626\u0629 \u0628\u062e\u0644\u0641\u064a\u0629 \u0648\u0631\u0642\u064a\u0629 \u0648\u0632\u062e\u0631\u0641\u0629 \u062c\u0627\u0646\u0628\u064a\u0629 \u0644\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0639\u0631\u0628\u064a\u0629",
    accent: "#4a3515",
    background: "#efe8d8",
    surface: "#f7f0df",
    ink: "#3b2a10",
    muted: "#5f513c",
    line: "#4a3515",
  },
  {
    key: "sage",
    title: "\u0642\u0627\u0644\u0628 \u0627\u0644\u0627\u0642\u062a\u0628\u0627\u0633",
    description: "\u062a\u0648\u0632\u064a\u0639 \u0648\u0631\u0642\u064a \u0628\u0627\u0633\u0645 \u0627\u0628\u0646 \u0627\u0644\u0642\u064a\u0645 \u0648\u0627\u0644\u0645\u0635\u062f\u0631 \u0623\u0639\u0644\u0649 \u0627\u0644\u064a\u0633\u0627\u0631 \u0648\u0646\u0635 \u0627\u0644\u0627\u0642\u062a\u0628\u0627\u0633 \u0641\u064a \u0627\u0644\u0648\u0631\u0642\u0629",
    accent: "#8d7140",
    background: "#f2ecdf",
    surface: "#d7c5a8",
    ink: "#3e2d17",
    muted: "#6e5a36",
    line: "#b49a64",
  },
];

const accentPalettes = ["#4a3515", "#8d7140", "#5f513c", "#6a5f48", "#435047", "#2f332d", "#8f6a34"];
const backgroundPalettes = ["#efe8d8", "#f2ecdf", "#eadfc8", "#f4eddc", "#e8dfcc", "#c0c4b2", "#ded1b7"];

const formatDimensions: Record<ShareFormat, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "مربع" },
  story: { width: 1080, height: 1920, label: "قصة" },
};

// Canvas dimensions are laid out at the logical 1080px size and rendered at 2x for sharper exports.
const EXPORT_SCALE = 2;

// Canvas text must be measured with the real webfonts; measuring against the fallback font
// mis-wraps and mis-fits the Arabic text on first open (cold font cache).
let shareFontsPromise: Promise<void> | null = null;

function ensureShareFontsLoaded() {
  if (typeof document === "undefined" || !document.fonts?.load) return Promise.resolve();
  if (!shareFontsPromise) {
    const sample = "ابن القيم الجوزية رحمه الله";
    shareFontsPromise = Promise.all(
      [
        "400 48px Amiri",
        "700 48px Amiri",
        "900 48px Amiri",
        "italic 700 48px Amiri",
        "400 48px 'Noto Naskh Arabic'",
        "700 48px 'Noto Naskh Arabic'",
      ].map((font) => document.fonts.load(font, sample).catch(() => [])),
    ).then(() => undefined);
  }
  return shareFontsPromise;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Use the legacy path when the browser blocks Clipboard API.
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

function sanitizeColor(color: string | undefined, fallback: string) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function hexToRgb(hex: string) {
  const value = sanitizeColor(hex, "#000000").replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixColors(first: string, second: string, amount: number) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * amount);
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(mix(a.r, b.r))}${toHex(mix(a.g, b.g))}${toHex(mix(a.b, b.b))}`;
}

function normalizeQuote(text: string | null | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function normalizeStyledText(text: string | null | undefined) {
  return (text ?? "").replace(/\s/g, " ");
}

function normalizeSelection(selection: QuoteSelection): QuoteSelection | null {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  return end > start ? { start, end } : null;
}

function compactTextMarks(marks: QuoteTextMark[], textLength: number) {
  return marks
    .map((mark) => ({
      ...mark,
      start: Math.max(0, Math.min(mark.start, textLength)),
      end: Math.max(0, Math.min(mark.end, textLength)),
    }))
    .filter((mark) => mark.end > mark.start);
}

// Runs are drawn separately on canvas, so a style boundary inside a word breaks Arabic
// letter joining (each fragment shapes in isolation). Snapping marks to whole words keeps
// every run boundary on whitespace, where no joining occurs.
function snapMarksToWordBoundaries(text: string, marks: QuoteTextMark[]): QuoteTextMark[] {
  return marks
    .map((mark) => {
      let start = mark.start;
      let end = mark.end;
      while (start < end && /\s/.test(text[start]!)) start += 1;
      while (end > start && /\s/.test(text[end - 1]!)) end -= 1;
      while (start > 0 && !/\s/.test(text[start - 1]!)) start -= 1;
      while (end < text.length && !/\s/.test(text[end]!)) end += 1;
      return { ...mark, start, end };
    })
    .filter((mark) => mark.end > mark.start);
}

function getEffectiveTextStyle(marks: QuoteTextMark[], index: number): EffectiveTextStyle {
  return marks.reduce<EffectiveTextStyle>(
    (style, mark) => {
      if (index < mark.start || index >= mark.end) return style;
      return {
        bold: mark.bold ?? style.bold,
        italic: mark.italic ?? style.italic,
        color: mark.color ?? style.color,
        sizeScale: mark.sizeScale ?? style.sizeScale,
      };
    },
    { bold: false, italic: false, sizeScale: 1 },
  );
}

function stylesEqual(first: EffectiveTextStyle, second: EffectiveTextStyle) {
  return (
    first.bold === second.bold &&
    first.italic === second.italic &&
    first.color === second.color &&
    first.sizeScale === second.sizeScale
  );
}

function getTextStyleBoundaries(marks: QuoteTextMark[], start: number, end: number) {
  const boundaries = new Set([start, end]);
  marks.forEach((mark) => {
    if (mark.start > start && mark.start < end) boundaries.add(mark.start);
    if (mark.end > start && mark.end < end) boundaries.add(mark.end);
  });
  return [...boundaries].sort((a, b) => a - b);
}

function getStyledRunsForRange(text: string, marks: QuoteTextMark[], start: number, end: number): StyledTextRun[] {
  const boundaries = getTextStyleBoundaries(marks, start, end);
  const runs: StyledTextRun[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const runStart = boundaries[index];
    const runEnd = boundaries[index + 1];
    const runText = text.slice(runStart, runEnd);
    if (!runText) continue;

    const style = getEffectiveTextStyle(marks, runStart);
    const previous = runs.at(-1);
    if (previous && stylesEqual(previous.style, style)) {
      previous.text += runText;
      previous.end = runEnd;
    } else {
      runs.push({ text: runText, start: runStart, end: runEnd, style });
    }
  }

  return runs;
}

function getStyledWords(text: string, marks: QuoteTextMark[]) {
  const words: StyledTextRun[][] = [];

  for (const match of text.matchAll(/\S+\s*/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    words.push(getStyledRunsForRange(text, marks, start, end));
  }

  return words;
}

function textStyleFont(style: EffectiveTextStyle, fontSize: number, fontFamily: string, fallbackWeight: number) {
  const fontStyle = style.italic ? "italic " : "";
  const fontWeight = style.bold ? 900 : fallbackWeight;
  return `${fontStyle}${fontWeight} ${Math.round(fontSize * style.sizeScale)}px ${fontFamily}`;
}

function measureStyledRuns(
  ctx: CanvasRenderingContext2D,
  runs: StyledTextRun[],
  fontSize: number,
  fontFamily: string,
  fallbackWeight: number,
) {
  return runs.reduce((width, run) => {
    ctx.font = textStyleFont(run.style, fontSize, fontFamily, fallbackWeight);
    return width + ctx.measureText(run.text).width;
  }, 0);
}

function wrapStyledText(
  ctx: CanvasRenderingContext2D,
  text: string,
  marks: QuoteTextMark[],
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  fallbackWeight: number,
): StyledTextLine[] {
  const normalizedText = normalizeStyledText(text);
  const snappedMarks = snapMarksToWordBoundaries(normalizedText, compactTextMarks(marks, normalizedText.length));
  const words = getStyledWords(normalizedText, snappedMarks);
  const lines: StyledTextLine[] = [];
  let currentRuns: StyledTextRun[] = [];
  let currentWidth = 0;

  const pushPiece = (pieceRuns: StyledTextRun[], pieceWidth: number) => {
    if (currentRuns.length > 0 && currentWidth + pieceWidth > maxWidth) {
      lines.push({ runs: currentRuns, width: currentWidth });
      currentRuns = pieceRuns;
      currentWidth = pieceWidth;
    } else {
      currentRuns = [...currentRuns, ...pieceRuns];
      currentWidth += pieceWidth;
    }
  };

  for (const wordRuns of words) {
    const wordWidth = measureStyledRuns(ctx, wordRuns, fontSize, fontFamily, fallbackWeight);
    if (wordWidth > maxWidth) {
      // Last-resort character wrap for a single token wider than the line (e.g. a long URL).
      for (const run of wordRuns) {
        let charStart = run.start;
        for (const char of Array.from(run.text)) {
          const charRun: StyledTextRun = { text: char, start: charStart, end: charStart + char.length, style: run.style };
          pushPiece([charRun], measureStyledRuns(ctx, [charRun], fontSize, fontFamily, fallbackWeight));
          charStart += char.length;
        }
      }
      continue;
    }
    pushPiece(wordRuns, wordWidth);
  }

  if (currentRuns.length > 0) lines.push({ runs: currentRuns, width: currentWidth });
  return lines;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = normalizeQuote(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function fitStyledTextToArea(
  ctx: CanvasRenderingContext2D,
  text: string,
  marks: QuoteTextMark[],
  maxWidth: number,
  maxHeight: number,
  startFontSize: number,
  minFontSize: number,
  fontFamily: string,
  weight = 700,
) {
  let fontSize = startFontSize;

  while (fontSize >= minFontSize) {
    const lineHeight = fontSize * 1.72;
    const lines = wrapStyledText(ctx, text, marks, maxWidth, fontSize, fontFamily, weight);
    if (lines.length * lineHeight <= maxHeight) {
      return { lines, fontSize, lineHeight, clipped: false };
    }
    fontSize -= 2;
  }

  const lineHeight = minFontSize * 1.72;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight) - 1);
  const lines = wrapStyledText(ctx, text, marks, maxWidth, minFontSize, fontFamily, weight).slice(0, maxLines);
  return { lines, fontSize: minFontSize, lineHeight, clipped: true };
}

function sliceTextMarks(marks: QuoteTextMark[], start: number, end: number): QuoteTextMark[] {
  return marks
    .map((mark) => ({
      ...mark,
      start: Math.max(mark.start, start) - start,
      end: Math.min(mark.end, end) - start,
    }))
    .filter((mark) => mark.end > mark.start);
}

function splitStyledTextToImageChunks(
  ctx: CanvasRenderingContext2D,
  text: string,
  marks: QuoteTextMark[],
  maxWidth: number,
  maxHeight: number,
  startFontSize: number,
  minFontSize: number,
  fontFamily: string,
  weight = 700,
) {
  const normalizedText = normalizeStyledText(text);
  const normalizedMarks = snapMarksToWordBoundaries(normalizedText, compactTextMarks(marks, normalizedText.length));
  const fitted = fitStyledTextToArea(
    ctx,
    normalizedText,
    normalizedMarks,
    maxWidth,
    maxHeight,
    startFontSize,
    minFontSize,
    fontFamily,
    weight,
  );
  if (!fitted.clipped) return [{ text: normalizedText, marks: normalizedMarks }];

  const lineHeight = minFontSize * 1.72;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight) - 1);
  const lines = wrapStyledText(ctx, normalizedText, normalizedMarks, maxWidth, minFontSize, fontFamily, weight);
  const chunks: Array<{ text: string; marks: QuoteTextMark[] }> = [];

  for (let index = 0; index < lines.length; index += maxLines) {
    const chunkLines = lines.slice(index, index + maxLines);
    const firstRun = chunkLines[0]?.runs[0];
    const lastLineRuns = chunkLines.at(-1)?.runs;
    const lastRun = lastLineRuns?.at(-1);
    if (!firstRun || !lastRun) continue;
    const chunkText = normalizedText.slice(firstRun.start, lastRun.end);
    chunks.push({ text: chunkText, marks: sliceTextMarks(normalizedMarks, firstRun.start, lastRun.end) });
  }

  return chunks;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  align: CanvasTextAlign,
) {
  ctx.textAlign = align;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function drawStyledTextLines(
  ctx: CanvasRenderingContext2D,
  lines: StyledTextLine[],
  x: number,
  y: number,
  lineHeight: number,
  direction: TextDirection,
  fontSize: number,
  fontFamily: string,
  fallbackWeight: number,
  fallbackColor: string,
) {
  const isRtl = direction === "rtl";

  lines.forEach((line, index) => {
    let cursor = isRtl ? x + line.width / 2 : x - line.width / 2;
    ctx.textAlign = isRtl ? "right" : "left";

    line.runs.forEach((run) => {
      ctx.font = textStyleFont(run.style, fontSize, fontFamily, fallbackWeight);
      ctx.fillStyle = run.style.color ?? fallbackColor;
      const runWidth = ctx.measureText(run.text).width;
      ctx.fillText(run.text, cursor, y + index * lineHeight);
      cursor += isRtl ? -runWidth : runWidth;
    });
  });
}

function textLengthBand(text: string) {
  const length = normalizeQuote(text).length;
  if (length > 760) return "very-long";
  if (length > 420) return "long";
  if (length > 190) return "medium";
  return "short";
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawBrand(
  ctx: CanvasRenderingContext2D,
  preset: QuotePreset,
  x: number,
  y: number,
  fontFamily: string,
  direction: TextDirection,
  brandTitle: string,
  brandSubtitle: string,
) {
  ctx.textAlign = direction === "rtl" ? "right" : "left";
  ctx.fillStyle = preset.accent;
  ctx.font = `700 33px ${fontFamily}`;
  ctx.fillText(brandTitle, x, y);
  ctx.fillStyle = preset.muted;
  ctx.font = `400 21px ${fontFamily}`;
  ctx.fillText(brandSubtitle, x, y + 34);
}

function drawSource(
  ctx: CanvasRenderingContext2D,
  preset: QuotePreset,
  sourceText: string,
  fontFamily: string,
  x: number,
  y: number,
  maxWidth: number,
  direction: TextDirection,
) {
  const align = direction === "rtl" ? "right" : "left";
  ctx.textAlign = align;
  ctx.fillStyle = preset.muted;
  ctx.font = `700 27px ${fontFamily}`;
  const lines = wrapText(ctx, sourceText, maxWidth).slice(0, 2);
  drawTextLines(ctx, lines, x, y, 38, align);
}

function resolvePreset(preset: QuotePreset, colors: ShareColors) {
  const accent = sanitizeColor(colors.accent, preset.accent);
  const background = sanitizeColor(colors.background, preset.background);

  return {
    ...preset,
    accent,
    background,
    surface: preset.dark ? mixColors(background, "#ffffff", 0.08) : mixColors(background, "#ffffff", 0.62),
    line: mixColors(accent, preset.dark ? "#ffffff" : "#2c2118", preset.dark ? 0.08 : 0.2),
    muted: preset.dark ? mixColors(accent, "#ffffff", 0.64) : mixColors(accent, "#2c2118", 0.42),
  };
}

function drawPaperBackground(ctx: CanvasRenderingContext2D, preset: QuotePreset, width: number, height: number) {
  ctx.fillStyle = preset.background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.42, height * 0.3, 80, width * 0.42, height * 0.3, height * 0.72);
  glow.addColorStop(0, "rgba(255,255,255,0.5)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const edge = ctx.createLinearGradient(0, 0, width, 0);
  edge.addColorStop(0, "rgba(80, 55, 20, 0.08)");
  edge.addColorStop(0.18, "rgba(80, 55, 20, 0)");
  edge.addColorStop(0.82, "rgba(80, 55, 20, 0)");
  edge.addColorStop(1, "rgba(80, 55, 20, 0.09)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.strokeStyle = preset.accent;
  ctx.lineWidth = 1;
  for (let i = 0; i < 340; i += 1) {
    const x = (i * 83) % width;
    const y = (i * 149) % height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ((i % 7) - 3) * 9, y + 18 + (i % 5) * 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMarginalWordmark(
  ctx: CanvasRenderingContext2D,
  preset: QuotePreset,
  width: number,
  height: number,
  direction: TextDirection,
  fontFamily: string,
  format: ShareFormat,
) {
  const isRtl = direction === "rtl";
  const sideX = isRtl ? width - width * 0.055 : width * 0.055;
  const sign = isRtl ? -1 : 1;
  const fontSize = format === "story" ? 178 : 132;

  ctx.save();
  ctx.translate(sideX, height * 0.66);
  ctx.rotate(sign * Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = withAlpha(preset.accent, 0.88);
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.fillText("ابن القيم", 0, 0);

  ctx.globalAlpha = 0.28;
  ctx.font = `700 ${fontSize * 0.72}px ${fontFamily}`;
  ctx.fillText("رحمه الله", format === "story" ? -210 : -160, fontSize * 0.62);
  ctx.restore();
}

function drawTemplatePill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
) {
  ctx.save();
  ctx.shadowColor = "rgba(54, 42, 24, 0.28)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 9;
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, mixColors(fill, "#ffffff", 0.36));
  gradient.addColorStop(0.55, fill);
  gradient.addColorStop(1, mixColors(fill, "#8a7448", 0.2));
  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  ctx.restore();
}

function drawTemplateTexture(ctx: CanvasRenderingContext2D, preset: QuotePreset, x: number, y: number, width: number, height: number) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = withAlpha(preset.muted, 0.7);
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 180; i += 1) {
    const px = x + ((i * 53) % Math.max(1, width));
    const py = y + ((i * 97) % Math.max(1, height));
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + ((i % 9) - 4) * 3, py + 12, px + ((i % 7) - 3) * 8, py + 24);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTemplatePaper(
  ctx: CanvasRenderingContext2D,
  preset: QuotePreset,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.shadowColor = "rgba(68, 52, 28, 0.2)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 14;
  ctx.shadowOffsetY = 12;

  ctx.beginPath();
  const steps = 18;
  for (let i = 0; i <= steps; i += 1) {
    const px = x + (width * i) / steps;
    const jitter = ((i * 17) % 11) - 5;
    if (i === 0) ctx.moveTo(px, y + jitter);
    else ctx.lineTo(px, y + jitter);
  }
  for (let i = 1; i <= steps; i += 1) {
    const py = y + (height * i) / steps;
    const jitter = ((i * 23) % 13) - 6;
    ctx.lineTo(x + width + jitter, py);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const px = x + (width * i) / steps;
    const jitter = ((i * 19) % 15) - 7;
    ctx.lineTo(px, y + height + jitter);
  }
  for (let i = steps; i >= 1; i -= 1) {
    const py = y + (height * i) / steps;
    const jitter = ((i * 29) % 15) - 7;
    ctx.lineTo(x + jitter, py);
  }
  ctx.closePath();

  const paper = ctx.createLinearGradient(x, y, x + width, y + height);
  paper.addColorStop(0, mixColors(preset.surface, "#ffffff", 0.28));
  paper.addColorStop(0.5, preset.surface);
  paper.addColorStop(1, mixColors(preset.surface, "#8b7653", 0.12));
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.restore();

  drawTemplateTexture(ctx, preset, x, y, width, height);
}

function drawTemplatePhoto(ctx: CanvasRenderingContext2D, preset: QuotePreset, x: number, y: number, width: number, height: number) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate((-8 * Math.PI) / 180);
  ctx.shadowColor = "rgba(37, 31, 22, 0.3)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#f6f5f1";
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.shadowColor = "transparent";

  const imageX = -width * 0.39;
  const imageY = -height * 0.38;
  const imageW = width * 0.78;
  const imageH = height * 0.64;
  ctx.fillStyle = "#252726";
  ctx.fillRect(imageX, imageY, imageW, imageH);

  const windowX = imageX + imageW * 0.29;
  const windowY = imageY + imageH * 0.08;
  const windowW = imageW * 0.42;
  const windowH = imageH * 0.86;
  ctx.strokeStyle = "#d8d9d4";
  ctx.lineWidth = Math.max(2, width * 0.012);
  roundRect(ctx, windowX, windowY, windowW, windowH, windowW * 0.45);
  ctx.stroke();

  ctx.globalAlpha = 0.82;
  ctx.strokeStyle = "#f1f1eb";
  ctx.lineWidth = Math.max(1, width * 0.006);
  for (let i = 1; i < 4; i += 1) {
    const lx = windowX + (windowW * i) / 4;
    ctx.beginPath();
    ctx.moveTo(lx, windowY + windowH * 0.08);
    ctx.lineTo(lx, windowY + windowH * 0.94);
    ctx.stroke();
  }
  for (let i = 1; i < 5; i += 1) {
    const ly = windowY + (windowH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(windowX + windowW * 0.06, ly);
    ctx.lineTo(windowX + windowW * 0.94, ly);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = preset.accent;
  for (let i = 0; i < 16; i += 1) {
    ctx.fillRect(imageX + ((i * 37) % imageW), imageY + ((i * 53) % imageH), 2, 2);
  }
  ctx.restore();
}

function drawTemplateHeaderText(
  ctx: CanvasRenderingContext2D,
  preset: QuotePreset,
  authorName: string,
  sourceText: string,
  fontFamily: string,
  direction: TextDirection,
  position: {
    x: (value: number) => number;
    y: (value: number) => number;
    size: (value: number) => number;
  },
) {
  const align: CanvasTextAlign = direction === "rtl" ? "right" : "left";
  const firstX = direction === "rtl" ? position.x(505) : position.x(155);
  const secondX = direction === "rtl" ? position.x(292) : position.x(155);

  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = preset.ink;
  ctx.font = `700 ${position.size(27)}px ${fontFamily}`;
  ctx.fillText(authorName, firstX, position.y(188), position.size(360));

  ctx.fillStyle = preset.muted;
  ctx.font = `700 ${position.size(20)}px ${fontFamily}`;
  const sourceLines = wrapText(ctx, sourceText, position.size(145)).slice(0, 1);
  ctx.fillText(sourceLines[0] ?? "", secondX, position.y(258), position.size(150));
  ctx.restore();
}

function drawWindowQuoteTemplate(
  ctx: CanvasRenderingContext2D,
  preset: QuotePreset,
  width: number,
  height: number,
  format: ShareFormat,
) {
  ctx.fillStyle = preset.background;
  ctx.fillRect(0, 0, width, height);

  const templateSize = format === "story" ? width : Math.min(width, height);
  const templateX = (width - templateSize) / 2;
  const templateY = (height - templateSize) / 2;
  const unit = templateSize / 1254;
  const sx = (value: number) => templateX + value * unit;
  const sy = (value: number) => templateY + value * unit;
  const ss = (value: number) => value * unit;

  const glow = ctx.createRadialGradient(width * 0.52, height * 0.36, ss(70), width * 0.52, height * 0.36, ss(690));
  glow.addColorStop(0, "rgba(255,255,255,0.56)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  drawTemplateTexture(ctx, preset, templateX, templateY, templateSize, templateSize);

  const pillBase = mixColors(preset.background, "#ffffff", 0.4);
  drawTemplatePill(ctx, sx(126), sy(166), ss(410), ss(45), mixColors(preset.accent, pillBase, 0.5));
  drawTemplatePill(ctx, sx(126), sy(236), ss(188), ss(45), mixColors(preset.accent, pillBase, 0.58));
  drawTemplatePaper(ctx, { ...preset, surface: mixColors(preset.background, "#ffffff", 0.34) }, sx(258), sy(262), ss(822), ss(826));
  drawTemplatePhoto(ctx, preset, sx(118), sy(636), ss(398), ss(438));

  return {
    x: sx,
    y: sy,
    size: ss,
    sourceArea: { x: sx(126), y: sy(166), width: ss(410), height: ss(115) },
    quoteArea: { x: sx(404), y: sy(392), width: ss(570), height: ss(520) },
  };
}

function drawPaperSideOrnament(
  ctx: CanvasRenderingContext2D,
  preset: QuotePreset,
  width: number,
  height: number,
  direction: TextDirection,
) {
  ctx.save();
  const isRtl = direction === "rtl";
  const x = isRtl ? width + width * 0.02 : -width * 0.02;
  const sign = isRtl ? -1 : 1;
  ctx.translate(x, height * 0.54);
  ctx.scale(sign, 1);
  ctx.strokeStyle = withAlpha(preset.accent, 0.98);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(15, width * 0.018);

  for (let i = -3; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, i * height * 0.14);
    ctx.bezierCurveTo(
      -width * 0.1,
      i * height * 0.12 - height * 0.02,
      -width * 0.03,
      i * height * 0.02 + height * 0.04,
      -width * 0.12,
      i * height * -0.08,
    );
    ctx.bezierCurveTo(
      -width * 0.2,
      i * height * -0.16,
      -width * 0.05,
      i * height * -0.18,
      -width * 0.1,
      i * height * -0.26,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawBottomSignature(
  ctx: CanvasRenderingContext2D,
  preset: QuotePreset,
  width: number,
  height: number,
  direction: TextDirection,
  fontFamily: string,
  brandTitle: string,
  format: ShareFormat,
) {
  const isRtl = direction === "rtl";
  const y = height - (format === "story" ? 180 : 96);
  const lineStart = isRtl ? width * 0.13 : width * 0.47;
  const lineEnd = isRtl ? width * 0.55 : width * 0.87;
  const textX = isRtl ? width * 0.84 : width * 0.16;
  const isSage = preset.key === "sage";

  ctx.save();
  ctx.strokeStyle = withAlpha(isSage ? preset.ink : preset.accent, isSage ? 0.34 : 0.58);
  ctx.lineWidth = isSage ? 3 : 4;
  ctx.beginPath();
  ctx.moveTo(lineStart, y);
  ctx.lineTo(lineEnd, y);
  ctx.stroke();
  drawDiamond(ctx, lineStart, y, 13, withAlpha(isSage ? preset.ink : preset.accent, isSage ? 0.42 : 0.72));

  ctx.textAlign = isRtl ? "right" : "left";
  ctx.fillStyle = withAlpha(isSage ? preset.ink : preset.accent, isSage ? 0.42 : 0.62);
  ctx.font = `700 ${format === "story" ? 42 : 34}px ${fontFamily}`;
  ctx.fillText(brandTitle, textX, y + (format === "story" ? 14 : 10));
  ctx.restore();
}

function getShareCardTextMetrics(input: {
  format: ShareFormat;
  height: number;
  width: number;
  isTemplatePreset: boolean;
  showSource: boolean;
  shouldShowSite: boolean;
  text: string;
}) {
  const band = textLengthBand(input.text);
  const isStory = input.format === "story";

  if (input.isTemplatePreset) {
    const quoteWidth = input.width * 0.45;
    const quoteMaxH = input.width * 0.41;
    const quoteStart = input.height * (isStory ? 0.42 : 0.31);
    const startFontSize = isStory ? (band === "short" ? 62 : band === "medium" ? 54 : 47) : band === "short" ? 48 : 42;
    const minFontSize = isStory ? 31 : 28;
    return { quoteMaxH, quoteStart, quoteWidth, startFontSize, minFontSize };
  }

  const quoteWidth = input.width * (isStory ? 0.62 : 0.54);
  const quoteMaxH = input.height * (isStory ? (input.showSource ? 0.5 : 0.6) : input.showSource ? 0.4 : 0.5);
  const quoteStart = input.height * (isStory ? (band === "short" ? 0.35 : 0.25) : band === "short" ? 0.39 : 0.29);
  const startFontSize = isStory ? (band === "short" ? 66 : band === "medium" ? 58 : 49) : band === "short" ? 47 : 41;
  const minFontSize = isStory ? 34 : 31;
  return { quoteMaxH, quoteStart, quoteWidth, startFontSize, minFontSize };
}

type GenerateImageInput = {
  brandSubtitle: string;
  brandTitle: string;
  text: string;
  textMarks: QuoteTextMark[];
  bookTitle: string;
  chapterTitle: string;
  pageNumber?: number;
  sourceDetails: ShareSourceDetails;
  preset: QuotePreset;
  colors: ShareColors;
  direction: TextDirection;
  format: ShareFormat;
  language: LanguageCode;
  showSource: boolean;
  showSite: boolean;
};

async function generateImageForPreset({
  brandSubtitle,
  brandTitle,
  text,
  textMarks,
  bookTitle,
  chapterTitle,
  pageNumber,
  sourceDetails,
  preset,
  colors,
  direction,
  format,
  language,
  showSource,
  showSite,
}: GenerateImageInput) {
  const { width, height } = formatDimensions[format];
  const canvas = document.createElement("canvas");
  canvas.width = width * EXPORT_SCALE;
  canvas.height = height * EXPORT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  const isRtl = direction === "rtl";
  const fontFamily = isRtl ? "'Amiri', 'Noto Naskh Arabic', serif" : "Georgia, 'Times New Roman', serif";
  const resolvedPreset = resolvePreset(preset, colors);
  const siteTitle = normalizeQuote(brandTitle);
  const shouldShowSite = showSite && siteTitle.length > 0;
  const sourceText = buildSourceText(bookTitle, chapterTitle, language, pageNumber, sourceDetails);

  if (resolvedPreset.key === "sage") {
    const templateLayout = drawWindowQuoteTemplate(ctx, resolvedPreset, width, height, format);
    const headerSourceText = normalizeQuote(sourceText) || normalizeQuote(chapterTitle) || normalizeQuote(bookTitle);
    drawTemplateHeaderText(
      ctx,
      resolvedPreset,
      templateAuthorName(language),
      headerSourceText,
      fontFamily,
      direction,
      templateLayout,
    );

    const quoteWidth = templateLayout.quoteArea.width;
    const quoteMaxH = templateLayout.quoteArea.height;
    const textX = templateLayout.quoteArea.x + templateLayout.quoteArea.width / 2;
    const quoteWeight = 700;
    const band = textLengthBand(text);
    const startFontSize = format === "story" ? (band === "short" ? 62 : band === "medium" ? 54 : 47) : band === "short" ? 48 : 42;
    const minFontSize = format === "story" ? 31 : 28;

    const { lines, fontSize, lineHeight } = fitStyledTextToArea(
      ctx,
      text,
      textMarks,
      quoteWidth,
      quoteMaxH,
      startFontSize,
      minFontSize,
      fontFamily,
      quoteWeight,
    );
    const usedHeight = lines.length * lineHeight;
    const quoteY = templateLayout.quoteArea.y + Math.max(0, (quoteMaxH - usedHeight) / 2);

    ctx.direction = direction;
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(255,255,255,0.34)";
    ctx.shadowBlur = 1;
    drawStyledTextLines(ctx, lines, textX, quoteY, lineHeight, direction, fontSize, fontFamily, quoteWeight, resolvedPreset.ink);
    ctx.shadowBlur = 0;
    return canvas.toDataURL("image/png");
  }

  const { quoteMaxH, quoteStart, quoteWidth, startFontSize, minFontSize } = getShareCardTextMetrics({
    format,
    height,
    width,
    isTemplatePreset: false,
    showSource,
    shouldShowSite,
    text,
  });

  ctx.direction = direction;
  ctx.textBaseline = "alphabetic";
  drawPaperBackground(ctx, resolvedPreset, width, height);
  drawPaperSideOrnament(ctx, resolvedPreset, width, height, direction);
  drawMarginalWordmark(ctx, resolvedPreset, width, height, direction, fontFamily, format);

  if (shouldShowSite) {
    const brandX = isRtl ? width - 92 : 92;
    drawBrand(ctx, resolvedPreset, brandX, format === "story" ? 130 : 92, fontFamily, direction, siteTitle, brandSubtitle);
  }

  const textX = isRtl ? width * 0.57 : width * 0.43;
  const quoteWeight = 700;
  const { lines, fontSize, lineHeight } = fitStyledTextToArea(
    ctx,
    text,
    textMarks,
    quoteWidth,
    quoteMaxH,
    startFontSize,
    minFontSize,
    fontFamily,
    quoteWeight,
  );
  const usedHeight = lines.length * lineHeight;
  const quoteY = quoteStart + Math.max(0, (quoteMaxH - usedHeight) / 2);

  drawStyledTextLines(ctx, lines, textX, quoteY, lineHeight, direction, fontSize, fontFamily, quoteWeight, resolvedPreset.ink);

  ctx.strokeStyle = withAlpha(resolvedPreset.accent, 0.62);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(textX - 86, quoteY + usedHeight + 46);
  ctx.lineTo(textX + 86, quoteY + usedHeight + 46);
  ctx.stroke();

  if (showSource) {
    const sourceX = isRtl ? width * 0.16 : width * 0.84;
    drawSource(
      ctx,
      resolvedPreset,
      sourceText,
      fontFamily,
      sourceX,
      height - (format === "story" ? 220 : 138),
      width * 0.55,
      isRtl ? "ltr" : direction,
    );
  }

  drawBottomSignature(ctx, resolvedPreset, width, height, direction, fontFamily, siteTitle || defaultBrandTitle(language), format);
  return canvas.toDataURL("image/png");
}
async function generateImagesForPreset(input: GenerateImageInput) {
  await ensureShareFontsLoaded();

  const { width, height } = formatDimensions[input.format];
  const measurementCanvas = document.createElement("canvas");
  measurementCanvas.width = width;
  measurementCanvas.height = height;
  const ctx = measurementCanvas.getContext("2d");
  if (!ctx) return [];

  const isRtl = input.direction === "rtl";
  const fontFamily = isRtl ? "'Amiri', 'Noto Naskh Arabic', serif" : "Georgia, 'Times New Roman', serif";
  const shouldShowSite = input.showSite && normalizeQuote(input.brandTitle).length > 0;
  const isTemplatePreset = input.preset.key === "sage";
  const { quoteMaxH, quoteWidth, startFontSize, minFontSize } = getShareCardTextMetrics({
    format: input.format,
    height,
    width,
    isTemplatePreset,
    showSource: input.showSource,
    shouldShowSite,
    text: input.text,
  });
  const quoteWeight = 700;
  const chunks = splitStyledTextToImageChunks(
    ctx,
    input.text,
    input.textMarks,
    quoteWidth,
    quoteMaxH,
    startFontSize,
    minFontSize,
    fontFamily,
    quoteWeight,
  );

  const images = await Promise.all(
    chunks.map((chunk) => generateImageForPreset({ ...input, text: chunk.text, textMarks: chunk.marks })),
  );
  return images.filter(Boolean);
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return await response.blob();
}

function buildShareText(
  text: string,
  bookTitle: string,
  chapterTitle: string,
  language: LanguageCode,
  pageNumber?: number,
  options: ShareTextOptions = {
    showSource: true,
    sourceDetails: { includeBookTitle: true, includeLocation: true },
    showSite: false,
  },
) {
  const details: string[] = [];

  if (options.showSource) {
    const sourceText = buildSourceText(bookTitle, chapterTitle, language, pageNumber, options.sourceDetails);
    details.push(`- ${translateAttribution(language)}`);
    if (sourceText) details.push(sourceText);
  }

  if (options.showSite) {
    if (options.sourceUrl) details.push(options.sourceUrl);
  }

  return [normalizeQuote(text), details.join("\n")].filter(Boolean).join("\n\n");
}

function buildSourceText(
  bookTitle: string,
  chapterTitle: string,
  language: LanguageCode,
  pageNumber: number | undefined,
  sourceDetails: ShareSourceDetails,
) {
  const location = pageNumber !== undefined ? pageText(pageNumber, language) : normalizeQuote(chapterTitle);
  const parts: string[] = [];

  if (sourceDetails.includeBookTitle) parts.push(bookTitle);
  if (sourceDetails.includeLocation && location) parts.push(location);

  return parts.join(" / ");
}

function buildXShareUrl(text: string, sourceUrl?: string) {
  const params = new URLSearchParams({ text });
  if (sourceUrl) params.set("url", sourceUrl);
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

function buildWhatsAppShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function buildTelegramShareUrl(text: string, sourceUrl?: string) {
  const params = new URLSearchParams({ text });
  if (sourceUrl) params.set("url", sourceUrl);
  return `https://t.me/share/url?${params.toString()}`;
}

function translateAttribution(language: LanguageCode) {
  if (language === "de") return "Ibn Qayyim al-Dschauziyya, möge Allah ihm barmherzig sein";
  if (language === "en") return "Ibn Qayyim al-Jawziyyah, may Allah have mercy on him";
  return "ابن القيم الجوزية رحمه الله";
}

function templateAuthorName(language: LanguageCode) {
  if (language === "de") return "Ibn al-Qayyim";
  if (language === "en") return "Ibn al-Qayyim";
  return "\u0627\u0628\u0646 \u0627\u0644\u0642\u064a\u0645";
}

function defaultBrandTitle(language: LanguageCode) {
  if (language === "de") return "Ibn al-Qayyim";
  if (language === "en") return "Ibn al-Qayyim";
  return "الكلام على مسألة السماع";
}

export default function QuoteShareModal({ text, bookTitle, chapterTitle, pageNumber, onClose }: Props) {
  const { direction, language, t } = useUiTranslations();
  const siteSubtitleLabel = t("موقع الاقتباس");
  const quotePresets = baseQuotePresets;
  const initialPreset = quotePresets[0];
  const initialAccent = initialPreset.accent;
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<QuotePresetKey>("parchment");
  const [format, setFormat] = useState<ShareFormat>("square");
  const [showSource, setShowSource] = useState(true);
  const [includeBookTitle, setIncludeBookTitle] = useState(true);
  const [includeSourceLocation, setIncludeSourceLocation] = useState(true);
  const [showSite, setShowSite] = useState(false);
  const [includeLink, setIncludeLink] = useState(true);
  const [currentUrl, setCurrentUrl] = useState("");
  const [editableText, setEditableText] = useState(text);
  const [textMarks, setTextMarks] = useState<QuoteTextMark[]>([]);
  const [textSelection, setTextSelection] = useState<QuoteSelection>({ start: 0, end: 0 });
  const [selectedColor, setSelectedColor] = useState(initialAccent);
  const [colors, setColors] = useState<ShareColors>({
    accent: initialAccent,
    background: initialPreset.background,
  });
  const [copied, setCopied] = useState<CopiedKind | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [canCopyImage, setCanCopyImage] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const activePresetConfig = quotePresets.find((preset) => preset.key === activePreset) ?? quotePresets[0];
  const imageCount = imageDataUrls.length;
  const hasSourceLocation = pageNumber !== undefined || normalizeQuote(chapterTitle).length > 0;
  const sourceUrl = showSite && includeLink && currentUrl ? currentUrl : undefined;
  const sourceDetails = useMemo(
    () => ({
      includeBookTitle,
      includeLocation: includeSourceLocation && hasSourceLocation,
    }),
    [hasSourceLocation, includeBookTitle, includeSourceLocation],
  );
  const shareTextOptions = useMemo(
    () => ({ showSource, sourceDetails, showSite, sourceUrl }),
    [showSource, sourceDetails, showSite, sourceUrl],
  );
  const nativeShareTextOptions = useMemo(
    () => ({ showSource, sourceDetails, showSite }),
    [showSource, sourceDetails, showSite],
  );
  const sourcePreviewText = useMemo(
    () => buildSourceText(bookTitle, chapterTitle, language, pageNumber, sourceDetails),
    [bookTitle, chapterTitle, language, pageNumber, sourceDetails],
  );
  const sitePreviewText = useMemo(
    () => sourceUrl ?? "",
    [sourceUrl],
  );
  const nativeShareText = useMemo(
    () => buildShareText(editableText, bookTitle, chapterTitle, language, pageNumber, nativeShareTextOptions),
    [bookTitle, chapterTitle, editableText, language, nativeShareTextOptions, pageNumber],
  );
  const shareText = useMemo(
    () => buildShareText(editableText, bookTitle, chapterTitle, language, pageNumber, shareTextOptions),
    [bookTitle, chapterTitle, editableText, language, pageNumber, shareTextOptions],
  );
  const xShareUrl = useMemo(
    () => buildXShareUrl(sourceUrl ? nativeShareText : shareText, sourceUrl),
    [nativeShareText, shareText, sourceUrl],
  );
  const whatsAppShareUrl = useMemo(() => buildWhatsAppShareUrl(shareText), [shareText]);
  const telegramShareUrl = useMemo(
    () => buildTelegramShareUrl(sourceUrl ? nativeShareText : shareText, sourceUrl),
    [nativeShareText, shareText, sourceUrl],
  );

  useEffect(() => {
    setEditableText(text);
    setTextMarks([]);
    setTextSelection({ start: 0, end: 0 });
  }, [text]);

  useEffect(() => {
    setCurrentUrl(window.location.href);
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setCanCopyImage(
      typeof navigator !== "undefined" &&
        Boolean(navigator.clipboard?.write) &&
        typeof ClipboardItem !== "undefined",
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setImageDataUrls([]);

    generateImagesForPreset({
        brandSubtitle: siteSubtitleLabel,
        brandTitle: "",
        text: editableText,
        textMarks,
        bookTitle,
        chapterTitle,
        pageNumber,
        sourceDetails,
        preset: activePresetConfig,
        colors,
        direction,
        format,
        language,
        showSource: showSource && Boolean(sourcePreviewText),
        showSite,
      })
      .then((images) => {
        if (!cancelled) setImageDataUrls(images);
      })
      .catch(() => {
        if (!cancelled) setImageDataUrls([]);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activePresetConfig,
    bookTitle,
    chapterTitle,
    colors,
    direction,
    editableText,
    format,
    language,
    pageNumber,
    sourceDetails,
    sourcePreviewText,
    showSite,
    showSource,
    siteSubtitleLabel,
    textMarks,
  ]);

  const selectPreset = (preset: QuotePreset) => {
    setActivePreset(preset.key);
    setSelectedColor(preset.accent);
    setColors({
      accent: preset.accent,
      background: preset.background,
    });
  };

  const selectedRange = normalizeSelection(textSelection);
  const selectedText = selectedRange ? editableText.slice(selectedRange.start, selectedRange.end).trim() : "";
  const hasTextSelection = Boolean(selectedRange && selectedText);

  const handleTextChange = (nextText: string) => {
    setEditableText(nextText);
    setTextMarks((current) => compactTextMarks(current, nextText.length));
  };

  const updateTextSelection = (target: HTMLTextAreaElement) => {
    setTextSelection({ start: target.selectionStart, end: target.selectionEnd });
  };

  const applyTextMark = (mark: Omit<QuoteTextMark, "id" | "start" | "end">) => {
    if (!selectedRange || !hasTextSelection) return;
    setTextMarks((current) =>
      compactTextMarks(
        [
          ...current,
          {
            id: `${Date.now()}-${current.length}`,
            start: selectedRange.start,
            end: selectedRange.end,
            ...mark,
          },
        ],
        editableText.length,
      ),
    );
  };

  const clearSelectedTextMarks = () => {
    if (!selectedRange || !hasTextSelection) return;
    setTextMarks((current) =>
      current.filter((mark) => mark.end <= selectedRange.start || mark.start >= selectedRange.end),
    );
  };

  const resetQuoteText = () => {
    setEditableText(text);
    setTextMarks([]);
    setTextSelection({ start: 0, end: 0 });
  };

  const flashCopied = (kind: CopiedKind) => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2200);
  };

  const handleDownload = async () => {
    if (imageDataUrls.length === 0) return;

    for (const [index, imageDataUrl] of imageDataUrls.entries()) {
      const blob = await dataUrlToBlob(imageDataUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        imageDataUrls.length === 1
          ? `ibn-al-qayyim-quote-${activePreset}-${format}.png`
          : `ibn-al-qayyim-quote-${activePreset}-${format}-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleCopyImage = async () => {
    if (imageDataUrls.length === 0 || !canCopyImage) return;
    try {
      const blobs = await Promise.all(imageDataUrls.map((imageDataUrl) => dataUrlToBlob(imageDataUrl)));
      await navigator.clipboard.write(blobs.map((blob) => new ClipboardItem({ [blob.type]: blob })));
      flashCopied("image");
    } catch {
      setShareError(t("تعذر نسخ الصورة. يمكنك تحميلها بدلا من ذلك."));
    }
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    setSharing(true);
    setShareError(null);

    try {
      const shareData: ShareData = {
        title: t("اقتباس من {bookTitle}", { bookTitle }),
        text: nativeShareText,
      };
      if (sourceUrl) shareData.url = sourceUrl;

      if (imageDataUrls.length > 0) {
        const blobs = await Promise.all(imageDataUrls.map((imageDataUrl) => dataUrlToBlob(imageDataUrl)));
        const files = blobs.map(
          (blob, index) =>
            new File([blob], `quote-${activePreset}-${format}-${index + 1}.png`, { type: blob.type }),
        );
        if (navigator.canShare?.({ files })) {
          await navigator.share({ ...shareData, files });
          return;
        }
      }

      await navigator.share(shareData);
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError") {
        setShareError(t("تعذرت المشاركة المباشرة. يمكنك نسخ النص أو تحميل الصورة."));
      }
    } finally {
      setSharing(false);
    }
  };

  const handlePrimaryShare = async () => {
    if (!canNativeShare) {
      setShareError(t("المشاركة المباشرة غير مدعومة في هذا المتصفح. استخدم واتساب أو تليجرام أو نسخ النص."));
      return;
    }

    await handleNativeShare();
  };

  const handleCopyText = async () => {
    setShareError(null);
    await copyText(shareText);
    flashCopied("text");
  };

  const handleCopyLink = async () => {
    if (!currentUrl) return;
    setShareError(null);
    await copyText(currentUrl);
    flashCopied("link");
  };

  const handleExternalShare = (url: string) => {
    setShareError(null);
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      setShareError(t("تعذر فتح نافذة المشاركة. استخدم المشاركة المباشرة أو انسخ النص."));
    }
  };

  const primaryShareClass = canNativeShare
    ? "bg-primary text-primary-foreground hover:opacity-90"
    : "border border-border bg-muted text-muted-foreground hover:bg-muted/80";

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/65 px-3 py-4 backdrop-blur-sm sm:px-5 sm:py-6"
      onClick={onClose}
    >
      <div
        className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-lg border border-border bg-background shadow-2xl lg:grid-cols-[27rem_minmax(0,1fr)]"
        dir={direction}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="order-2 border-t border-border bg-muted/35 p-4 lg:border-s lg:border-t-0 lg:p-6">
          <div className="mx-auto flex max-w-[38rem] items-center justify-center lg:min-h-[calc(100vh-5rem)]">
            <div className="w-full">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{t(formatDimensions[format].label)}</span>
                <span className="tabular-nums">
                  {formatNumber(formatDimensions[format].width, language)} × {formatNumber(formatDimensions[format].height, language)}
                  {imageCount > 1 ? ` / ${formatNumber(imageCount, language)}` : ""}
                </span>
              </div>
              <div
                className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-lg border border-border bg-background p-3 shadow-lg"
                data-tour="quote-card-preview"
              >
                {imageDataUrls.length > 0 ? (
                  <div className="grid justify-items-center gap-4">
                    {imageDataUrls.map((imageDataUrl, index) => (
                      <figure
                        key={`${imageDataUrl.slice(0, 48)}-${index}`}
                        className={`space-y-2 ${format === "story" ? "w-full max-w-[23.5rem] sm:max-w-[28rem]" : "w-full max-w-[34rem]"}`}
                      >
                        {imageCount > 1 ? (
                          <figcaption className="text-center text-xs font-semibold text-muted-foreground">
                            {formatNumber(index + 1, language)} / {formatNumber(imageCount, language)}
                          </figcaption>
                        ) : null}
                        <img
                          src={imageDataUrl}
                          alt={t("بطاقة الاقتباس")}
                          className={`w-full rounded-[3px] bg-background object-cover shadow-xl ring-1 ring-black/10 ${format === "story" ? "aspect-[9/16]" : "aspect-square"}`}
                        />
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div className={`w-full animate-pulse rounded-md bg-muted ${format === "story" ? "aspect-[9/16]" : "aspect-square"}`} />
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="order-1 flex flex-col">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Share2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">{t("مشاركة الاقتباس")}</h2>
                <p className="truncate text-xs text-muted-foreground">{bookTitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t("إغلاق")}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 px-5 py-4" data-tour="quote-card-tools">
            <section className="rounded-md border border-border bg-muted/35 p-3" data-tour="quote-card-actions">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Share2 className="h-4 w-4" />
                {t("وجهات المشاركة")}
              </div>
              <button
                onClick={handlePrimaryShare}
                disabled={sharing}
                aria-disabled={!canNativeShare}
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-3 py-3 text-center text-sm font-semibold leading-5 transition disabled:cursor-not-allowed disabled:opacity-60 ${primaryShareClass}`}
                type="button"
                title={
                  canNativeShare
                    ? t("مشاركة مباشرة")
                    : t("المشاركة المباشرة غير مدعومة في هذا المتصفح. استخدم واتساب أو تليجرام أو نسخ النص.")
                }
              >
                <Share2 className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{sharing ? t("جاري المشاركة...") : t("مشاركة مباشرة")}</span>
              </button>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleExternalShare(whatsAppShareUrl)}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md bg-[#1f9d61] px-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  aria-label={t("واتساب")}
                  title={t("واتساب")}
                  type="button"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span className="hidden min-w-0 truncate sm:inline">{t("واتساب")}</span>
                </button>
                <button
                  onClick={() => handleExternalShare(telegramShareUrl)}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md bg-[#229ed9] px-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  aria-label={t("تليجرام")}
                  title={t("تليجرام")}
                  type="button"
                >
                  <Send className="h-4 w-4 shrink-0" />
                  <span className="hidden min-w-0 truncate sm:inline">{t("تليجرام")}</span>
                </button>
                <button
                  onClick={() => handleExternalShare(xShareUrl)}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md bg-[#111111] px-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  aria-label="X"
                  title="X"
                  type="button"
                >
                  <Twitter className="h-4 w-4 shrink-0" />
                  <span className="hidden min-w-0 truncate sm:inline">X</span>
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={handleCopyText}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold transition-colors hover:bg-muted"
                  type="button"
                >
                  {copied === "text" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied === "text" ? t("تم نسخ النص") : t("نسخ النص")}
                </button>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!currentUrl}
                  type="button"
                >
                  {copied === "link" ? <Check className="h-4 w-4 text-emerald-600" /> : <LinkIcon className="h-4 w-4" />}
                  {copied === "link" ? t("تم نسخ الرابط") : t("نسخ الرابط")}
                </button>
              </div>
            </section>

            <section className="mt-5 rounded-md border border-border bg-background p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Pencil className="h-4 w-4" />
                  {t("نص المشاركة")}
                </div>
                <button
                  className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={editableText === text && textMarks.length === 0}
                  onClick={resetQuoteText}
                  type="button"
                >
                  {t("استعادة النص الأصلي")}
                </button>
              </div>
              <textarea
                aria-label={t("نص المشاركة")}
                className="min-h-32 w-full resize-y rounded-md border border-border bg-muted/30 px-3 py-2 font-serif text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/35 focus:bg-background focus:ring-1 focus:ring-ring"
                dir={direction}
                onBlur={(event) => updateTextSelection(event.currentTarget)}
                onChange={(event) => handleTextChange(event.target.value)}
                onKeyUp={(event) => updateTextSelection(event.currentTarget)}
                onMouseUp={(event) => updateTextSelection(event.currentTarget)}
                onSelect={(event) => updateTextSelection(event.currentTarget)}
                value={editableText}
              />
              <div className="mt-3 rounded-md border border-border bg-muted/25 p-2">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="truncate">
                    {hasTextSelection ? t("النص المحدد: {text}", { text: selectedText }) : t("حدد كلمة أو عبارة من النص")}
                  </span>
                  {textMarks.length > 0 ? (
                    <button
                      className="shrink-0 font-semibold transition-colors hover:text-foreground"
                      onClick={() => setTextMarks([])}
                      type="button"
                    >
                      {t("مسح التنسيق")}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!hasTextSelection}
                    onClick={() => applyTextMark({ bold: true })}
                    title={t("تغميق النص المحدد")}
                    type="button"
                  >
                    <Bold className="h-4 w-4" />
                    B
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold italic transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!hasTextSelection}
                    onClick={() => applyTextMark({ italic: true })}
                    title={t("جعل النص المحدد مائلا")}
                    type="button"
                  >
                    <Italic className="h-4 w-4" />
                    I
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!hasTextSelection}
                    onClick={() => applyTextMark({ sizeScale: 1.24 })}
                    title={t("تكبير النص المحدد")}
                    type="button"
                  >
                    <Type className="h-4 w-4" />
                    {t("كبير")}
                  </button>
                  <label
                    aria-disabled={!hasTextSelection}
                    className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2 text-sm font-semibold transition hover:bg-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
                  >
                    <span className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: selectedColor }} />
                    <span>{t("لون")}</span>
                    <input
                      aria-label={t("لون النص المحدد")}
                      className="sr-only"
                      disabled={!hasTextSelection}
                      onChange={(event) => {
                        setSelectedColor(event.target.value);
                        applyTextMark({ color: event.target.value });
                      }}
                      type="color"
                      value={selectedColor}
                    />
                  </label>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!hasTextSelection}
                    onClick={clearSelectedTextMarks}
                    type="button"
                  >
                    {t("إزالة تنسيق المحدد")}
                  </button>
                </div>
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                {t("شكل البطاقة")}
              </div>
              <div className="grid gap-2">
                {quotePresets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => selectPreset(preset)}
                    className="group grid grid-cols-[auto_1fr] items-start gap-3 rounded-md border border-border p-3 text-start transition hover:border-foreground data-[active=true]:border-foreground data-[active=true]:bg-muted"
                    data-active={activePreset === preset.key}
                  >
                    <span
                      className="mt-1 h-8 w-8 rounded-md border border-border"
                      style={{
                        background: preset.dark
                          ? `linear-gradient(135deg, ${preset.background}, ${preset.accent})`
                          : `linear-gradient(135deg, ${preset.surface}, ${preset.accent})`,
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{t(preset.title)}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{t(preset.description)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-5">
              <p className="mb-3 text-xs font-semibold text-muted-foreground">{t("المقاس والتفاصيل")}</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(formatDimensions) as ShareFormat[]).map((option) => (
                  <button
                    aria-pressed={format === option}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-border px-3 text-sm font-semibold transition hover:border-foreground data-[active=true]:border-foreground data-[active=true]:bg-muted"
                    data-active={format === option}
                    key={option}
                    onClick={() => setFormat(option)}
                    type="button"
                  >
                    {t(formatDimensions[option].label)}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2">
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    {t("إظهار المصدر")}
                  </span>
                  <input
                    checked={showSource}
                    className="h-4 w-4 accent-foreground"
                    onChange={(event) => setShowSource(event.target.checked)}
                    type="checkbox"
                  />
                </label>
                {showSource ? (
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{t("تفاصيل المصدر")}</p>
                    <div className="grid gap-2">
                      <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                        <span className="font-semibold text-foreground">{t("إضافة اسم الكتاب")}</span>
                        <input
                          checked={includeBookTitle}
                          className="h-4 w-4 accent-foreground"
                          onChange={(event) => setIncludeBookTitle(event.target.checked)}
                          type="checkbox"
                        />
                      </label>
                      <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                        <span className="font-semibold text-foreground">{t("إضافة عنوان الصفحة أو القسم أو الفصل")}</span>
                        <input
                          checked={includeSourceLocation && hasSourceLocation}
                          className="h-4 w-4 accent-foreground"
                          disabled={!hasSourceLocation}
                          onChange={(event) => setIncludeSourceLocation(event.target.checked)}
                          type="checkbox"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
                    <Globe2 className="h-4 w-4 text-muted-foreground" />
                    {t("إظهار الموقع")}
                  </span>
                  <input
                    checked={showSite}
                    className="h-4 w-4 accent-foreground"
                    onChange={(event) => setShowSite(event.target.checked)}
                    type="checkbox"
                  />
                </label>
                {showSite ? (
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{t("تفاصيل الموقع")}</p>
                    <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                      <span className="font-semibold text-foreground">{t("إرفاق رابط القراءة")}</span>
                      <input
                        checked={includeLink && Boolean(currentUrl)}
                        className="h-4 w-4 accent-foreground"
                        disabled={!currentUrl}
                        onChange={(event) => setIncludeLink(event.target.checked)}
                        type="checkbox"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="mt-5 rounded-md border border-border bg-background p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Palette className="h-4 w-4" />
                {t("ألوان البطاقة")}
              </div>
              <ColorPickerRow
                label={t("التأكيد")}
                t={t}
                palettes={accentPalettes}
                value={colors.accent}
                onChange={(accent) => setColors((current) => ({ ...current, accent }))}
              />
              <div className="mt-4">
                <ColorPickerRow
                  label={t("الخلفية")}
                  t={t}
                  palettes={backgroundPalettes}
                  value={colors.background}
                  onChange={(background) => setColors((current) => ({ ...current, background }))}
                />
              </div>
            </section>

            <section className="mt-5 rounded-md border border-border bg-muted/40 p-4">
              <QuoteTextPreview direction={direction} marks={textMarks} text={editableText} />
              {showSource ? (
                <p className="mt-3 text-xs leading-6 text-muted-foreground">
                  {sourcePreviewText}
                </p>
              ) : null}
              {showSite && sitePreviewText ? (
                <p className="mt-2 truncate text-xs leading-6 text-muted-foreground">
                  {sitePreviewText}
                </p>
              ) : null}
            </section>

            <section className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={handleDownload}
                className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                type="button"
              >
                <Download className="h-4 w-4" />
                {t("تحميل الصورة")}
              </button>

              {canCopyImage && (
                <button
                  onClick={handleCopyImage}
                  className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted"
                  type="button"
                >
                  {copied === "image" ? <Check className="h-4 w-4 text-emerald-600" /> : <ImageDown className="h-4 w-4" />}
                  {copied === "image" ? t("تم نسخ الصورة") : t("نسخ الصورة")}
                </button>
              )}
            </section>

            {shareError ? <p className="mt-3 text-xs leading-6 text-destructive">{shareError}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function QuoteTextPreview({
  direction,
  marks,
  text,
}: {
  direction: TextDirection;
  marks: QuoteTextMark[];
  text: string;
}) {
  const normalizedText = normalizeStyledText(text);
  const runs = getStyledRunsForRange(
    normalizedText,
    snapMarksToWordBoundaries(normalizedText, compactTextMarks(marks, normalizedText.length)),
    0,
    normalizedText.length,
  );

  return (
    <p className="line-clamp-4 font-serif text-base leading-8 text-foreground" dir={direction}>
      <span>“</span>
      {runs.map((run) => (
        <span
          key={`${run.start}-${run.end}-${run.text}`}
          style={{
            color: run.style.color,
            fontSize: run.style.sizeScale > 1 ? `${run.style.sizeScale}em` : undefined,
            fontStyle: run.style.italic ? "italic" : undefined,
            fontWeight: run.style.bold ? 900 : undefined,
          }}
        >
          {run.text}
        </span>
      ))}
      <span>”</span>
    </p>
  );
}

function ColorPickerRow({
  label,
  palettes,
  t,
  value,
  onChange,
}: {
  label: string;
  palettes: string[];
  t: (key: string, params?: Record<string, string | number>) => string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <label className="relative inline-flex h-8 w-8 cursor-pointer overflow-hidden rounded-md border border-border">
          <span className="sr-only">{t("اختيار لون {label}", { label })}</span>
          <span className="h-full w-full" style={{ backgroundColor: value }} />
          <input
            aria-label={t("اختيار لون {label}", { label })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {palettes.map((color) => (
          <button
            aria-label={t("لون {color}", { color })}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            className="h-7 w-7 rounded-full border border-border ring-offset-2 ring-offset-background transition hover:scale-105 data-[selected=true]:ring-2 data-[selected=true]:ring-foreground"
            data-selected={value.toLowerCase() === color.toLowerCase()}
            key={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}
