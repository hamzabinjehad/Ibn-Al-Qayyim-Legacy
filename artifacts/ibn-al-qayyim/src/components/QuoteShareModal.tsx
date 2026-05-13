import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ImageDown, MessageCircle, Share2, Twitter, X } from "lucide-react";

interface Props {
  text: string;
  bookTitle: string;
  chapterTitle: string;
  pageNumber?: number;
  coverColor?: string;
  onClose: () => void;
}

type QuoteImageVariant = {
  key: string;
  title: string;
  description: string;
  accent: string;
  background: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  ornament: string;
  dark?: boolean;
};

const quoteImageVariants: QuoteImageVariant[] = [
  {
    key: "manuscript",
    title: "مخطوط",
    description: "هادئ وواضح للقراءة",
    accent: "#b99242",
    background: "#f7f1e5",
    surface: "#fffaf0",
    ink: "#221a12",
    muted: "#746653",
    line: "#dcccae",
    ornament: "#efe2c6",
  },
  {
    key: "night",
    title: "ليلي",
    description: "تباين قوي للمشاركة",
    accent: "#d8b65d",
    background: "#101010",
    surface: "#191816",
    ink: "#fff8e8",
    muted: "#c8b995",
    line: "#373229",
    ornament: "#2b271e",
    dark: true,
  },
  {
    key: "emerald",
    title: "زمردي",
    description: "لون لطيف وأنيق",
    accent: "#2f8f73",
    background: "#edf7f2",
    surface: "#fbfffc",
    ink: "#13231e",
    muted: "#5f756d",
    line: "#c8ded4",
    ornament: "#dbeee6",
  },
  {
    key: "cover",
    title: "غلاف",
    description: "يربط الاقتباس بالكتاب",
    accent: "#4f6f9a",
    background: "#eef2f7",
    surface: "#ffffff",
    ink: "#172033",
    muted: "#657184",
    line: "#d4dce8",
    ornament: "#dfe7f2",
  },
];

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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
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
): { lines: string[]; fontSize: number; lineHeight: number } {
  let fontSize = startFontSize;

  while (fontSize >= minFontSize) {
    ctx.font = `400 ${fontSize}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = fontSize * 1.72;
    if (lines.length * lineHeight <= maxHeight) {
      return { lines, fontSize, lineHeight };
    }
    fontSize -= 2;
  }

  ctx.font = `400 ${minFontSize}px ${fontFamily}`;
  const lineHeight = minFontSize * 1.72;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);

  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 5 ? `${last.slice(0, -4)}...` : last;
  }

  return { lines, fontSize: minFontSize, lineHeight };
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

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
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

function drawBackground(ctx: CanvasRenderingContext2D, variant: QuoteImageVariant, width: number, height: number) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, variant.background);
  bg.addColorStop(0.55, variant.surface);
  bg.addColorStop(1, variant.dark ? "#0d0c0b" : variant.background);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = variant.dark ? 0.18 : 0.28;
  ctx.fillStyle = variant.ornament;
  for (let i = 0; i < 65; i += 1) {
    const x = (i * 173) % width;
    const y = (i * 97) % height;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = variant.line;
  ctx.lineWidth = 2;
  roundRect(ctx, 52, 52, width - 104, height - 104, 36);
  ctx.stroke();

  ctx.strokeStyle = variant.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  roundRect(ctx, 74, 74, width - 148, height - 148, 28);
  ctx.stroke();
}

function drawMetadata(
  ctx: CanvasRenderingContext2D,
  variant: QuoteImageVariant,
  bookTitle: string,
  chapterTitle: string,
  pageNumber: number | undefined,
  fontFamily: string,
) {
  ctx.textAlign = "right";
  ctx.fillStyle = variant.ink;
  ctx.font = `700 34px ${fontFamily}`;
  ctx.fillText(bookTitle, 930, 138);

  ctx.fillStyle = variant.muted;
  ctx.font = `400 23px ${fontFamily}`;
  const meta = pageNumber ? `${chapterTitle} - صفحة ${pageNumber}` : chapterTitle;
  ctx.fillText(meta, 930, 178);

  ctx.strokeStyle = variant.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(150, 220);
  ctx.lineTo(930, 220);
  ctx.stroke();

  drawDiamond(ctx, 540, 220, 12, variant.accent);
}

function drawCoverMark(
  ctx: CanvasRenderingContext2D,
  variant: QuoteImageVariant,
  bookTitle: string,
  coverColor: string | undefined,
  fontFamily: string,
) {
  const x = 105;
  const y = 120;
  const w = 128;
  const h = 176;
  const coverAccent = coverColor || variant.accent;

  const coverGradient = ctx.createLinearGradient(x, y, x + w, y + h);
  coverGradient.addColorStop(0, coverAccent);
  coverGradient.addColorStop(1, variant.dark ? "#332613" : "#181511");

  ctx.fillStyle = coverGradient;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();

  ctx.strokeStyle = variant.accent;
  ctx.lineWidth = 3;
  roundRect(ctx, x + 12, y + 14, w - 24, h - 28, 8);
  ctx.stroke();

  ctx.fillStyle = "#f7e6ad";
  ctx.textAlign = "center";
  ctx.font = `700 18px ${fontFamily}`;
  const lines = wrapText(ctx, bookTitle, w - 34).slice(0, 3);
  drawTextBlock(ctx, lines, x + w / 2, y + 56, 30);
}

function generateImageForVariant({
  text,
  bookTitle,
  chapterTitle,
  pageNumber,
  coverColor,
  variant,
}: {
  text: string;
  bookTitle: string;
  chapterTitle: string;
  pageNumber?: number;
  coverColor?: string;
  variant: QuoteImageVariant;
}) {
  const width = 1080;
  const height = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const fontFamily = "'Amiri', 'Noto Naskh Arabic', serif";
  ctx.direction = "rtl";
  ctx.textBaseline = "alphabetic";

  drawBackground(ctx, variant, width, height);
  drawMetadata(ctx, variant, bookTitle, chapterTitle, pageNumber, fontFamily);

  if (variant.key === "cover") {
    drawCoverMark(ctx, variant, bookTitle, coverColor, fontFamily);
  } else {
    drawDiamond(ctx, 150, 144, 16, variant.accent);
    drawDiamond(ctx, 190, 144, 8, variant.line);
  }

  const quoteX = 875;
  const quoteY = 322;
  const quoteMaxWidth = 670;
  const quoteMaxHeight = 438;
  const { lines, fontSize, lineHeight } = fitTextToArea(ctx, text, quoteMaxWidth, quoteMaxHeight, 48, 27, fontFamily);
  const quoteHeight = lines.length * lineHeight;
  const startY = quoteY + Math.max(0, (quoteMaxHeight - quoteHeight) / 2) + lineHeight * 0.72;

  ctx.fillStyle = variant.accent;
  ctx.globalAlpha = variant.dark ? 0.26 : 0.2;
  ctx.font = `700 142px ${fontFamily}`;
  ctx.textAlign = "right";
  ctx.fillText("”", 925, 355);
  ctx.globalAlpha = 1;

  ctx.fillStyle = variant.ink;
  ctx.font = `400 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "right";
  drawTextBlock(ctx, lines, quoteX, startY, lineHeight);

  ctx.fillStyle = variant.accent;
  ctx.fillRect(872, 810, 58, 3);

  ctx.fillStyle = variant.ink;
  ctx.font = `700 28px ${fontFamily}`;
  ctx.fillText("ابن القيم الجوزية رحمه الله", 930, 868);

  ctx.fillStyle = variant.muted;
  ctx.font = `400 21px ${fontFamily}`;
  ctx.fillText("موروث ابن القيم", 930, 906);

  ctx.textAlign = "left";
  ctx.fillStyle = variant.muted;
  ctx.font = `400 18px ${fontFamily}`;
  ctx.fillText("ibn-al-qayyim", 150, 906);

  return canvas.toDataURL("image/png");
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return await response.blob();
}

export default function QuoteShareModal({ text, bookTitle, chapterTitle, pageNumber, coverColor, onClose }: Props) {
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({});
  const [activeVariant, setActiveVariant] = useState(quoteImageVariants[0].key);
  const [copied, setCopied] = useState<"text" | "image" | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [canCopyImage, setCanCopyImage] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const activeVariantConfig = quoteImageVariants.find((variant) => variant.key === activeVariant) ?? quoteImageVariants[0];
  const imageDataUrl = imageDataUrls[activeVariant];
  const shareText = useMemo(
    () => `${text.trim()}\n\n- ابن القيم الجوزية رحمه الله\n${bookTitle} / ${chapterTitle}`,
    [bookTitle, chapterTitle, text],
  );

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setCanCopyImage(
      typeof navigator !== "undefined" &&
        Boolean(navigator.clipboard?.write) &&
        typeof ClipboardItem !== "undefined",
    );

    const urls: Record<string, string> = {};
    for (const variant of quoteImageVariants) {
      urls[variant.key] = generateImageForVariant({
        text,
        bookTitle,
        chapterTitle,
        pageNumber,
        coverColor,
        variant,
      });
    }
    setImageDataUrls(urls);
  }, [bookTitle, chapterTitle, coverColor, pageNumber, text]);

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
    a.download = `اقتباس-ابن-القيم-${activeVariant}.png`;
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
        const file = new File([blob], `quote-${activeVariant}.png`, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: `اقتباس من ${bookTitle}`, text: shareText, files: [file] });
          return;
        }
      }

      await navigator.share({ title: `اقتباس من ${bookTitle}`, text: shareText });
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError") {
        setShareError("تعذرت المشاركة المباشرة. يمكنك نسخ النص أو تحميل الصورة.");
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="grid max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl md:grid-cols-[minmax(0,1fr)_23rem]"
        dir="rtl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-h-0 overflow-y-auto border-b border-border bg-muted/35 p-4 md:border-b-0 md:border-l md:p-6">
          <div className="mx-auto max-w-[34rem]">
            <div className="relative overflow-hidden rounded-lg border border-border bg-background p-3 shadow-lg">
              {imageDataUrl ? (
                <img
                  src={imageDataUrl}
                  alt="بطاقة الاقتباس"
                  className="aspect-square w-full rounded-md object-cover"
                />
              ) : (
                <div className="aspect-square w-full animate-pulse rounded-md bg-muted" />
              )}
            </div>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Share2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">مشاركة الاقتباس</h2>
                <p className="truncate text-xs text-muted-foreground">{bookTitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="إغلاق"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div>
              <p className="mb-3 text-xs font-semibold text-muted-foreground">شكل الصورة</p>
              <div className="grid grid-cols-2 gap-2">
                {quoteImageVariants.map((variant) => (
                  <button
                    key={variant.key}
                    type="button"
                    onClick={() => setActiveVariant(variant.key)}
                    className="group rounded-lg border p-3 text-right transition hover:border-foreground data-[active=true]:border-foreground data-[active=true]:bg-muted"
                    data-active={activeVariant === variant.key}
                  >
                    <span
                      className="mb-3 block h-2 w-14 rounded-full"
                      style={{ backgroundColor: variant.accent }}
                    />
                    <span className="block text-sm font-semibold text-foreground">{variant.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{variant.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
              <p className="line-clamp-4 font-serif text-base leading-8 text-foreground">"{text}"</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {chapterTitle}
                {pageNumber ? ` - صفحة ${pageNumber}` : ""}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={handleDownload}
                className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                type="button"
              >
                <Download className="h-4 w-4" />
                تحميل الصورة
              </button>

              {canNativeShare && (
                <button
                  onClick={handleNativeShare}
                  disabled={sharing}
                  className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                >
                  <Share2 className="h-4 w-4" />
                  {sharing ? "جاري المشاركة..." : "مشاركة مباشرة"}
                </button>
              )}

              {canCopyImage && (
                <button
                  onClick={handleCopyImage}
                  className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-muted"
                  type="button"
                >
                  {copied === "image" ? <Check className="h-4 w-4 text-emerald-600" /> : <ImageDown className="h-4 w-4" />}
                  {copied === "image" ? "تم نسخ الصورة" : "نسخ الصورة"}
                </button>
              )}

              <button
                onClick={handleWhatsApp}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f9d61] px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                type="button"
              >
                <MessageCircle className="h-4 w-4" />
                واتساب
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
                {copied === "text" ? "تم نسخ النص" : "نسخ النص"}
              </button>
            </div>

            {shareError ? <p className="mt-3 text-xs leading-6 text-destructive">{shareError}</p> : null}

            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              القالب الحالي: {activeVariantConfig.title}. الصورة مربعة ومناسبة للمنشورات العامة.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
