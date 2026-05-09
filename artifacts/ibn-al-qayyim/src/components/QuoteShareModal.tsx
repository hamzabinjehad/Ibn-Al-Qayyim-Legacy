import { useRef, useEffect, useState } from "react";
import { X, Download, Twitter, MessageCircle, Copy, Check, Share2 } from "lucide-react";

interface Props {
  text: string;
  bookTitle: string;
  chapterTitle: string;
  onClose: () => void;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
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
  fontFamily: string
): { lines: string[]; fontSize: number; lineH: number } {
  let fontSize = startFontSize;
  while (fontSize >= minFontSize) {
    ctx.font = `400 ${fontSize}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth);
    const lineH = fontSize * 1.65;
    if (lines.length * lineH <= maxHeight) {
      return { lines, fontSize, lineH };
    }
    fontSize -= 2;
  }
  ctx.font = `400 ${minFontSize}px ${fontFamily}`;
  const lineH = minFontSize * 1.65;
  const maxLines = Math.floor(maxHeight / lineH);
  let lines = wrapText(ctx, text, maxWidth);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 4 ? last.slice(0, -3) + "..." : last;
  }
  return { lines, fontSize: minFontSize, lineH };
}

export default function QuoteShareModal({ text, bookTitle, chapterTitle, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.direction = "rtl";

    const FONT = "'Amiri', 'Noto Naskh Arabic', serif";
    const gold = "#c9a84c";
    const goldFaint = "rgba(201,168,76,0.15)";
    const goldMid = "rgba(201,168,76,0.5)";
    const cream = "#f7f0e0";

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0d1b12");
    bg.addColorStop(0.5, "#1a3022");
    bg.addColorStop(1, "#0d1b12");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, W - 64, H - 64);
    ctx.strokeStyle = goldMid;
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 44, W - 88, H - 88);

    const HEADER_END = 244;
    const FOOTER_START = H - 214;
    const TEXT_AREA_H = FOOTER_START - HEADER_END - 20;
    const TEXT_MAX_W = W - 200;

    ctx.textAlign = "center";
    ctx.fillStyle = gold;
    ctx.font = `bold 50px ${FONT}`;
    ctx.fillText("✦", W / 2, 110);

    ctx.font = `400 28px ${FONT}`;
    ctx.fillStyle = gold;
    ctx.fillText(bookTitle, W / 2, 162);

    ctx.font = `300 22px ${FONT}`;
    ctx.fillStyle = goldMid;
    ctx.fillText(chapterTitle, W / 2, 200);

    const drawHRule = (y: number) => {
      ctx.strokeStyle = goldMid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(90, y);
      ctx.lineTo(W - 90, y);
      ctx.stroke();
    };
    drawHRule(HEADER_END);
    drawHRule(FOOTER_START);

    ctx.font = `bold 130px ${FONT}`;
    ctx.fillStyle = goldFaint;
    ctx.textAlign = "right";
    ctx.fillText("»", W - 64, HEADER_END + 120);

    const { lines, lineH } = fitTextToArea(
      ctx,
      text,
      TEXT_MAX_W,
      TEXT_AREA_H,
      42,
      18,
      FONT
    );

    const totalH = lines.length * lineH;
    const textStartY = HEADER_END + (TEXT_AREA_H - totalH) / 2 + lineH * 0.85;

    ctx.textAlign = "center";
    ctx.fillStyle = cream;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, textStartY + i * lineH));

    ctx.font = `bold 130px ${FONT}`;
    ctx.fillStyle = goldFaint;
    ctx.textAlign = "left";
    ctx.fillText("«", 64, textStartY + totalH - lineH * 0.2);

    ctx.textAlign = "center";
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillStyle = gold;
    ctx.fillText("— ابن القيم الجوزية رحمه الله —", W / 2, FOOTER_START + 52);

    ctx.font = `300 20px ${FONT}`;
    ctx.fillStyle = goldMid;
    ctx.fillText("موروث ابن القيم", W / 2, FOOTER_START + 92);

    ctx.font = `bold 38px ${FONT}`;
    ctx.fillStyle = gold;
    ctx.fillText("✦", W / 2, FOOTER_START + 140);

    setImageDataUrl(canvas.toDataURL("image/png"));
  }, [text, bookTitle, chapterTitle]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "اقتباس-ابن-القيم.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const shareText = `${text}\n\n— ابن القيم الجوزية رحمه الله\n📚 ${bookTitle} | ${chapterTitle}`;

  const handleTwitter = () =>
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer"
    );

  const handleWhatsApp = () =>
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer"
    );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            <span className="font-bold text-foreground text-sm">مشاركة الاقتباس</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-5">
          {imageDataUrl ? (
            <img
              src={imageDataUrl}
              alt="بطاقة الاقتباس"
              className="w-full rounded-xl border border-border"
            />
          ) : (
            <div className="w-full aspect-square rounded-xl bg-muted animate-pulse" />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="px-5 pt-3 pb-1">
          <p
            className="text-xs text-muted-foreground line-clamp-2 leading-relaxed"
            style={{ fontFamily: "'Amiri', 'Noto Naskh Arabic', serif" }}
          >
            "{text}"
          </p>
        </div>

        <div className="px-5 py-4 grid grid-cols-2 gap-3">
          <button
            onClick={handleDownload}
            className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            تحميل الصورة
          </button>
          <button
            onClick={handleTwitter}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#1DA1F2" }}
          >
            <Twitter className="w-4 h-4" />
            تويتر / X
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle className="w-4 h-4" />
            واتساب
          </button>
          <button
            onClick={handleCopy}
            className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-muted text-foreground rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? "تم النسخ!" : "نسخ النص"}
          </button>
        </div>
      </div>
    </div>
  );
}
