import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ImageDown,
  MessageCircle,
  Palette,
  Share2,
  Sparkles,
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
  coverColor?: string;
  onClose: () => void;
}

type QuotePresetKey = "manuscript" | "mihrab";
type ShareFormat = "square" | "story";

type ShareColors = {
  accent: string;
  background: string;
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

const quotePresets: QuotePreset[] = [
  {
    key: "manuscript",
    title: "مخطوط",
    description: "ورق هادئ وحدود هندسية للنصوص الطويلة",
    accent: "#b99152",
    background: "#efe2c7",
    surface: "#fff7e8",
    ink: "#2f261f",
    muted: "#7b6042",
    line: "#c9a66c",
  },
  {
    key: "mihrab",
    title: "محراب",
    description: "خلفية داكنة وعمق بصري مناسب للمشاركة",
    accent: "#c99a55",
    background: "#1e1915",
    surface: "#332920",
    ink: "#fff4df",
    muted: "#d2b079",
    line: "#8b6a3c",
    dark: true,
  },
];

const accentPalettes = ["#b99152", "#8f5d2f", "#556b46", "#4f6f9a", "#7d4e57", "#2f7a67", "#1f1f1f"];
const backgroundPalettes = ["#efe2c7", "#1e1915", "#f3f5f7", "#dcc08b", "#332419", "#f2dcc2", "#24362f"];

const formatDimensions: Record<ShareFormat, { width: number; height: number; label: string }> = {
  square: { width: 1080, height: 1080, label: "مربع" },
  story: { width: 1080, height: 1920, label: "قصة" },
};

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

function normalizeQuote(text: string) {
  return text.replace(/\s+/g, " ").trim();
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

function fitTextToArea(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  startFontSize: number,
  minFontSize: number,
  fontFamily: string,
  weight = 700,
) {
  let fontSize = startFontSize;

  while (fontSize >= minFontSize) {
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    const lineHeight = fontSize * 1.72;
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length * lineHeight <= maxHeight) {
      return { lines, fontSize, lineHeight, clipped: false };
    }
    fontSize -= 2;
  }

  ctx.font = `${weight} ${minFontSize}px ${fontFamily}`;
  const lineHeight = minFontSize * 1.72;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 8 ? `${last.slice(0, -5)}…` : last;
  }
  return { lines, fontSize: minFontSize, lineHeight, clipped: true };
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

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawFineTexture(ctx: CanvasRenderingContext2D, preset: QuotePreset, width: number, height: number) {
  ctx.save();
  ctx.globalAlpha = preset.dark ? 0.12 : 0.18;
  ctx.fillStyle = preset.dark ? "#ffffff" : preset.accent;

  for (let i = 0; i < 180; i += 1) {
    const x = (i * 137) % width;
    const y = (i * 211) % height;
    ctx.fillRect(x, y, i % 9 === 0 ? 3 : 1, i % 11 === 0 ? 3 : 1);
  }

  ctx.globalAlpha = preset.dark ? 0.08 : 0.12;
  ctx.strokeStyle = preset.dark ? "#ffffff" : preset.line;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-50, 120 + i * 210);
    ctx.bezierCurveTo(width * 0.25, 20 + i * 190, width * 0.74, 260 + i * 145, width + 60, 80 + i * 205);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGeometricBorder(
  ctx: CanvasRenderingContext2D,
  preset: QuotePreset,
  x: number,
  y: number,
  width: number,
  height: number,
  inset = 34,
) {
  ctx.save();
  ctx.strokeStyle = withAlpha(preset.line, preset.dark ? 0.62 : 0.78);
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, width, height, 18);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(preset.accent, preset.dark ? 0.48 : 0.38);
  ctx.lineWidth = 2;
  roundRect(ctx, x + inset, y + inset, width - inset * 2, height - inset * 2, 8);
  ctx.stroke();

  const corners = [
    [x + inset, y + inset],
    [x + width - inset, y + inset],
    [x + inset, y + height - inset],
    [x + width - inset, y + height - inset],
  ];
  corners.forEach(([cx, cy]) => drawDiamond(ctx, cx, cy, 18, preset.accent));
  ctx.restore();
}

function drawMihrab(ctx: CanvasRenderingContext2D, preset: QuotePreset, width: number, height: number) {
  ctx.save();
  const archWidth = width * 0.74;
  const archX = (width - archWidth) / 2;
  const top = height * 0.17;
  const bottom = height * 0.82;
  const archHeight = bottom - top;

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = preset.accent;
  ctx.beginPath();
  ctx.moveTo(archX, bottom);
  ctx.lineTo(archX, top + archHeight * 0.35);
  ctx.quadraticCurveTo(width / 2, top - 95, archX + archWidth, top + archHeight * 0.35);
  ctx.lineTo(archX + archWidth, bottom);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = preset.line;
  ctx.lineWidth = 4;
  ctx.stroke();
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
  bookTitle: string,
  chapterTitle: string,
  pageNumber: number | undefined,
  fontFamily: string,
  x: number,
  y: number,
  maxWidth: number,
  direction: TextDirection,
  language: LanguageCode,
) {
  const source =
    pageNumber !== undefined
      ? `${bookTitle} / ${chapterTitle} / ${pageText(pageNumber, language)}`
      : `${bookTitle} / ${chapterTitle}`;
  const align = direction === "rtl" ? "right" : "left";
  ctx.textAlign = align;
  ctx.fillStyle = preset.muted;
  ctx.font = `700 27px ${fontFamily}`;
  const lines = wrapText(ctx, source, maxWidth).slice(0, 2);
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
    muted: preset.dark ? mixColors(accent, "#ffffff", 0.35) : mixColors(accent, "#2c2118", 0.42),
  };
}

function drawCardBackground(ctx: CanvasRenderingContext2D, preset: QuotePreset, width: number, height: number) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, preset.dark ? mixColors(preset.background, "#ffffff", 0.06) : mixColors(preset.background, "#ffffff", 0.28));
  bg.addColorStop(0.52, preset.background);
  bg.addColorStop(1, preset.dark ? mixColors(preset.background, "#000000", 0.55) : mixColors(preset.background, preset.accent, 0.18));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.28, height * 0.18, 80, width * 0.28, height * 0.18, height * 0.68);
  glow.addColorStop(0, preset.dark ? withAlpha(preset.accent, 0.28) : "rgba(255,255,255,0.68)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.25, width / 2, height / 2, height * 0.78);
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(1, preset.dark ? "rgba(0,0,0,0.48)" : "rgba(92,55,18,0.14)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  drawFineTexture(ctx, preset, width, height);
}

function generateImageForPreset({
  brandSubtitle,
  brandTitle,
  text,
  bookTitle,
  chapterTitle,
  pageNumber,
  preset,
  colors,
  direction,
  format,
  language,
  showSource,
}: {
  brandSubtitle: string;
  brandTitle: string;
  text: string;
  bookTitle: string;
  chapterTitle: string;
  pageNumber?: number;
  preset: QuotePreset;
  colors: ShareColors;
  direction: TextDirection;
  format: ShareFormat;
  language: LanguageCode;
  showSource: boolean;
}) {
  const { width, height } = formatDimensions[format];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const isRtl = direction === "rtl";
  const fontFamily = isRtl ? "'Amiri', 'Noto Naskh Arabic', serif" : "Georgia, 'Times New Roman', serif";
  const resolvedPreset = resolvePreset(preset, colors);
  const padding = format === "story" ? 86 : 74;
  const cardX = padding;
  const cardY = format === "story" ? 150 : 86;
  const cardW = width - padding * 2;
  const cardH = height - cardY * 2;
  const quoteMaxH = showSource ? cardH * 0.47 : cardH * 0.58;
  const quoteStart = format === "story" ? cardY + cardH * 0.31 : cardY + cardH * 0.32;

  ctx.direction = direction;
  ctx.textBaseline = "alphabetic";
  drawCardBackground(ctx, resolvedPreset, width, height);

  if (resolvedPreset.key === "mihrab") {
    drawMihrab(ctx, resolvedPreset, width, height);
  }

  ctx.save();
  ctx.shadowColor = resolvedPreset.dark ? "rgba(0,0,0,0.45)" : "rgba(69,43,20,0.18)";
  ctx.shadowBlur = resolvedPreset.dark ? 34 : 26;
  ctx.shadowOffsetY = resolvedPreset.dark ? 18 : 16;
  ctx.fillStyle = resolvedPreset.dark ? withAlpha(resolvedPreset.surface, 0.72) : withAlpha(resolvedPreset.surface, 0.88);
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fill();
  ctx.restore();

  drawGeometricBorder(ctx, resolvedPreset, cardX + 22, cardY + 22, cardW - 44, cardH - 44, 34);

  const textX = isRtl ? cardX + cardW - 84 : cardX + 84;
  const brandX = isRtl ? cardX + cardW - 64 : cardX + 64;
  drawBrand(ctx, resolvedPreset, brandX, cardY + 98, fontFamily, direction, brandTitle, brandSubtitle);

  ctx.fillStyle = resolvedPreset.accent;
  ctx.font = `700 ${format === "story" ? 112 : 88}px ${fontFamily}`;
  ctx.textAlign = isRtl ? "right" : "left";
  ctx.fillText("”", isRtl ? cardX + cardW - 70 : cardX + 70, quoteStart - 70);

  const quoteWidth = cardW - 170;
  const quoteWeight = resolvedPreset.key === "mihrab" ? 600 : 700;
  const { lines, fontSize, lineHeight } = fitTextToArea(
    ctx,
    text,
    quoteWidth,
    quoteMaxH,
    format === "story" ? 62 : 54,
    format === "story" ? 34 : 30,
    fontFamily,
    quoteWeight,
  );
  const usedHeight = lines.length * lineHeight;
  const quoteY = quoteStart + Math.max(0, (quoteMaxH - usedHeight) / 2);

  ctx.fillStyle = resolvedPreset.ink;
  ctx.font = `${quoteWeight} ${fontSize}px ${fontFamily}`;
  drawTextLines(ctx, lines, textX, quoteY, lineHeight, isRtl ? "right" : "left");

  ctx.strokeStyle = withAlpha(resolvedPreset.accent, 0.62);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(textX, quoteY + usedHeight + 44);
  ctx.lineTo(textX + (isRtl ? -214 : 214), quoteY + usedHeight + 44);
  ctx.stroke();
  drawDiamond(ctx, textX + (isRtl ? -240 : 240), quoteY + usedHeight + 44, 15, resolvedPreset.accent);

  if (showSource) {
    drawSource(
      ctx,
      resolvedPreset,
      bookTitle,
      chapterTitle,
      pageNumber,
      fontFamily,
      textX,
      cardY + cardH - (format === "story" ? 178 : 126),
      cardW - 170,
      direction,
      language,
    );
  }

  ctx.textAlign = isRtl ? "left" : "right";
  ctx.fillStyle = withAlpha(resolvedPreset.muted, resolvedPreset.dark ? 0.9 : 0.78);
  ctx.font = `400 ${format === "story" ? 22 : 18}px ${fontFamily}`;
  ctx.fillText(brandTitle, isRtl ? cardX + 70 : cardX + cardW - 70, cardY + cardH - 72);

  return canvas.toDataURL("image/png");
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
) {
  const page = pageNumber !== undefined ? ` / ${pageText(pageNumber, language)}` : "";
  return `${normalizeQuote(text)}\n\n- ${translateAttribution(language)}\n${bookTitle} / ${chapterTitle}${page}`;
}

function translateAttribution(language: LanguageCode) {
  if (language === "de") return "Ibn Qayyim al-Dschauziyya, möge Allah ihm barmherzig sein";
  if (language === "en") return "Ibn Qayyim al-Jawziyyah, may Allah have mercy on him";
  return "ابن القيم الجوزية رحمه الله";
}

export default function QuoteShareModal({ text, bookTitle, chapterTitle, pageNumber, onClose }: Props) {
  const { direction, language, t } = useUiTranslations();
  const initialAccent = quotePresets[0].accent;
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [activePreset, setActivePreset] = useState<QuotePresetKey>("manuscript");
  const [format, setFormat] = useState<ShareFormat>("square");
  const [showSource, setShowSource] = useState(true);
  const [colors, setColors] = useState<ShareColors>({
    accent: initialAccent,
    background: quotePresets[0].background,
  });
  const [copied, setCopied] = useState<"text" | "image" | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [canCopyImage, setCanCopyImage] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const activePresetConfig = quotePresets.find((preset) => preset.key === activePreset) ?? quotePresets[0];
  const shareText = useMemo(
    () => buildShareText(text, bookTitle, chapterTitle, language, pageNumber),
    [bookTitle, chapterTitle, language, pageNumber, text],
  );

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setCanCopyImage(
      typeof navigator !== "undefined" &&
        Boolean(navigator.clipboard?.write) &&
        typeof ClipboardItem !== "undefined",
    );
  }, []);

  useEffect(() => {
    setImageDataUrl(
      generateImageForPreset({
        brandSubtitle: t("بطاقة الاقتباس"),
        brandTitle: t("موروث ابن القيم"),
        text,
        bookTitle,
        chapterTitle,
        pageNumber,
        preset: activePresetConfig,
        colors,
        direction,
        format,
        language,
        showSource,
      }),
    );
  }, [activePresetConfig, bookTitle, chapterTitle, colors, direction, format, language, pageNumber, showSource, t, text]);

  const selectPreset = (preset: QuotePreset) => {
    setActivePreset(preset.key);
    setColors({
      accent: preset.accent,
      background: preset.background,
    });
  };

  const flashCopied = (kind: "text" | "image") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2200);
  };

  const handleDownload = async () => {
    if (!imageDataUrl) return;
    const blob = await dataUrlToBlob(imageDataUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ibn-al-qayyim-quote-${activePreset}-${format}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyImage = async () => {
    if (!imageDataUrl || !canCopyImage) return;
    const blob = await dataUrlToBlob(imageDataUrl);
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    flashCopied("image");
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    setSharing(true);
    setShareError(null);

    try {
      if (imageDataUrl) {
        const blob = await dataUrlToBlob(imageDataUrl);
        const file = new File([blob], `quote-${activePreset}-${format}.png`, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: t("اقتباس من {bookTitle}", { bookTitle }), text: shareText, files: [file] });
          return;
        }
      }

      await navigator.share({ title: t("اقتباس من {bookTitle}", { bookTitle }), text: shareText });
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError") {
        setShareError(t("تعذرت المشاركة المباشرة. يمكنك نسخ النص أو تحميل الصورة."));
      }
    } finally {
      setSharing(false);
    }
  };

  const handleTwitter = () =>
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer",
    );

  const handleWhatsApp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");

  const handleCopyText = async () => {
    await copyText(shareText);
    flashCopied("text");
  };

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/65 px-3 py-4 backdrop-blur-sm sm:px-5 sm:py-6"
      onClick={onClose}
    >
      <div
        className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-lg border border-border bg-background shadow-2xl lg:grid-cols-[25rem_minmax(0,1fr)]"
        dir={direction}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="order-1 border-b border-border bg-muted/35 p-4 lg:order-2 lg:border-b-0 lg:border-r lg:p-6">
          <div className="mx-auto flex max-w-[38rem] items-center justify-center lg:min-h-[calc(100vh-5rem)]">
            <div className="w-full">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{t(formatDimensions[format].label)}</span>
                <span className="tabular-nums">
                  {formatNumber(formatDimensions[format].width, language)} × {formatNumber(formatDimensions[format].height, language)}
                </span>
              </div>
              <div
                className="overflow-hidden rounded-lg border border-border bg-background p-3 shadow-lg"
                data-tour="quote-card-preview"
              >
                {imageDataUrl ? (
                  <img
                    src={imageDataUrl}
                    alt={t("بطاقة الاقتباس")}
                    className={`w-full rounded-md object-cover ${format === "story" ? "aspect-[9/16]" : "aspect-square"}`}
                  />
                ) : (
                  <div className={`w-full animate-pulse rounded-md bg-muted ${format === "story" ? "aspect-[9/16]" : "aspect-square"}`} />
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="order-2 flex flex-col lg:order-1">
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
            <section>
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
                    className="group grid grid-cols-[auto_1fr] items-start gap-3 rounded-md border border-border p-3 text-right transition hover:border-foreground data-[active=true]:border-foreground data-[active=true]:bg-muted"
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
              <p className="mb-3 text-xs font-semibold text-muted-foreground">{t("المقاس والمصدر")}</p>
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
              <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-semibold text-foreground">{t("إظهار المصدر")}</span>
                <input
                  checked={showSource}
                  className="h-4 w-4 accent-foreground"
                  onChange={(event) => setShowSource(event.target.checked)}
                  type="checkbox"
                />
              </label>
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
              <p className="line-clamp-4 font-serif text-base leading-8 text-foreground">“{normalizeQuote(text)}”</p>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                {chapterTitle}
                {pageNumber !== undefined ? ` / ${pageText(pageNumber, language)}` : ""}
              </p>
            </section>

            <section className="mt-5 grid grid-cols-2 gap-2" data-tour="quote-card-actions">
              <button
                onClick={handleDownload}
                className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                type="button"
              >
                <Download className="h-4 w-4" />
                {t("تحميل الصورة")}
              </button>

              {canNativeShare && (
                <button
                  onClick={handleNativeShare}
                  disabled={sharing}
                  className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                >
                  <Share2 className="h-4 w-4" />
                  {sharing ? t("جاري المشاركة...") : t("مشاركة مباشرة")}
                </button>
              )}

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

              <button
                onClick={handleWhatsApp}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f9d61] px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                type="button"
              >
                <MessageCircle className="h-4 w-4" />
                {t("واتساب")}
              </button>
              <button
                onClick={handleTwitter}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#111111] px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                type="button"
              >
                <Twitter className="h-4 w-4" />
                X
              </button>
              <button
                onClick={handleCopyText}
                className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-muted px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/75"
                type="button"
              >
                {copied === "text" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied === "text" ? t("تم نسخ النص") : t("نسخ النص")}
              </button>
            </section>

            {shareError ? <p className="mt-3 text-xs leading-6 text-destructive">{shareError}</p> : null}
          </div>
        </aside>
      </div>
    </div>
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
