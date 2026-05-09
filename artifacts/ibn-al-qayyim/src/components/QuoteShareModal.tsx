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

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0d1b12");
    bg.addColorStop(0.5, "#1a3022");
    bg.addColorStop(1, "#0d1b12");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const gold = "#c9a84c";
    const goldFaint = "rgba(201,168,76,0.18)";
    const goldMid = "rgba(201,168,76,0.5)";
    const cream = "#f7f0e0";

    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, W - 64, H - 64);
    ctx.strokeStyle = goldMid;
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 44, W - 88, H - 88);

    ctx.textAlign = "center";
    ctx.fillStyle = gold;
    ctx.font = `bold 56px 'Amiri', 'Noto Naskh Arabic', serif`;
    ctx.fillText("✦", W / 2, 116);

    ctx.font = `400 30px 'Amiri', 'Noto Naskh Arabic', serif`;
    ctx.fillStyle = gold;
    ctx.fillText(bookTitle, W / 2, 170);

    ctx.font = `300 23px 'Amiri', 'Noto Naskh Arabic', serif`;
    ctx.fillStyle = goldMid;
    ctx.fillText(chapterTitle, W / 2, 208);

    ctx.strokeStyle = goldMid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 234);
    ctx.lineTo(W - 100, 234);
    ctx.stroke();

    ctx.font = `bold 140px 'Amiri', 'Noto Naskh Arabic', serif`;
    ctx.fillStyle = goldFaint;
    ctx.textAlign = "right";
    ctx.fillText("»", W - 70, 360);

    ctx.font = `400 42px 'Amiri', 'Noto Naskh Arabic', serif`;
    ctx.fillStyle = cream;
    ctx.textAlign = "center";
    const lineH = 68;
    const lines = wrapText(ctx, text, W - 220);
    const totalH = lines.length * lineH;
    const midY = (H - 300) / 2 + 240;
    const startY = midY - totalH / 2;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * lineH));

    ctx.font = `bold 140px 'Amiri', 'Noto Naskh Arabic', serif`;
    ctx.fillStyle = goldFaint;
    ctx.textAlign = "left";
    ctx.fillText("«", 70, startY + totalH + 20);

    ctx.strokeStyle = goldMid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, H - 210);
    ctx.lineTo(W - 100, H - 210);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = `bold 34px 'Amiri', 'Noto Naskh Arabic', serif`;
    ctx.fillStyle = gold;
    ctx.fillText("— ابن القيم الجوزية رحمه الله —", W / 2, H - 168);

    ctx.font = `300 22px 'Amiri', 'Noto Naskh Arabic', serif`;
    ctx.fillStyle = goldMid;
    ctx.fillText("موروث ابن القيم", W / 2, H - 122);

    ctx.font = `bold 44px 'Amiri', 'Noto Naskh Arabic', serif`;
    ctx.fillStyle = gold;
    ctx.fillText("✦", W / 2, H - 74);

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
