import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

type Size = "sm" | "md" | "lg";

interface BookCoverProps {
  coverColor: string;
  coverImageAlt?: string;
  coverImageUrl?: string;
  editionLabel?: string;
  publisher?: string;
  title: string;
  size?: Size;
  badge?: ReactNode;
  className?: string;
}

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-[8.5rem] w-24 px-3",
  md: "h-52 w-36 px-4",
  lg: "h-72 w-48 px-6",
};

const TITLE_CLASS: Record<Size, string> = {
  sm: "book-cover-title--sm",
  md: "book-cover-title--md",
  lg: "book-cover-title--lg",
};

const AUTHOR_DISPLAY_NAME = "\u0627\u0628\u0646 \u0627\u0644\u0642\u064A\u0645";
const COVER_VARIANT_COUNT = 4;

const COVER_PALETTES = [
  { deep: "#0d1f1a", mid: "#245747", light: "#6f9b86", gold: "#f3d98a" },
  { deep: "#101c24", mid: "#2a5b68", light: "#76a6ad", gold: "#f4dc93" },
  { deep: "#111827", mid: "#2f4f73", light: "#7894b8", gold: "#f3d783" },
  { deep: "#141c18", mid: "#415846", light: "#8da07a", gold: "#f5df9a" },
  { deep: "#161923", mid: "#424a64", light: "#858ba8", gold: "#f2d88a" },
  { deep: "#0d2424", mid: "#2c6662", light: "#7fb2a5", gold: "#f1d98d" },
] as const;

function getTitleHash(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function isNeutralColor(value: string) {
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return false;

  const hex = match[1]!;
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  const brightness = (red + green + blue) / 3;

  return spread < 12 && brightness > 180;
}

function isWarmRedColor(value: string) {
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return false;

  const hex = match[1]!;
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return red > green + 35 && red > blue + 35;
}

function getTitleDensity(value: string) {
  const length = value.replace(/\s+/g, "").length;
  if (length > 48) return "very-long";
  if (length > 34) return "long";
  if (length > 20) return "medium";
  return "short";
}

export default function BookCover({
  coverColor,
  coverImageAlt,
  coverImageUrl,
  editionLabel,
  publisher,
  title,
  size = "sm",
  badge,
  className = "",
}: BookCoverProps) {
  const titleHash = getTitleHash(title);
  const palette = COVER_PALETTES[titleHash % COVER_PALETTES.length]!;
  const accent =
    coverColor && !isNeutralColor(coverColor) && !isWarmRedColor(coverColor)
      ? coverColor
      : palette.mid;
  const coverMeta = editionLabel ?? publisher;
  const coverTextStyle = { color: "var(--cover-ink)", WebkitTextFillColor: "var(--cover-ink)" } as CSSProperties;
  const [imageFailed, setImageFailed] = useState(false);
  const canShowImage = !!coverImageUrl && !imageFailed;
  const coverVariant = titleHash % COVER_VARIANT_COUNT;
  const titleDensity = getTitleDensity(title);

  useEffect(() => {
    setImageFailed(false);
  }, [coverImageUrl]);

  return (
    <div
      className={`book-cover flex items-center justify-center text-center ${canShowImage ? `book-cover--image ${SIZE_CLASS[size]} px-0` : SIZE_CLASS[size]} ${className}`}
      data-cover-size={size}
      data-cover-variant={coverVariant}
      data-title-density={titleDensity}
      style={{
        "--cover-accent": accent,
        "--cover-deep": palette.deep,
        "--cover-gold": palette.gold,
        "--cover-ink": "#fff1bd",
        "--cover-light": palette.light,
        "--cover-line": "#ead693",
        "--cover-mid": accent,
      } as CSSProperties}
    >
      {badge && <div className="absolute left-2 top-2 z-10">{badge}</div>}

      {canShowImage ? (
        <>
          <div className="book-cover-page-stack" aria-hidden="true" />
          <img
            alt={coverImageAlt ?? title}
            className="book-cover-image"
            decoding="async"
            loading="lazy"
            onError={() => setImageFailed(true)}
            src={coverImageUrl}
          />
          <div className="book-cover-image-sheen" aria-hidden="true" />
        </>
      ) : (
        <>
          <div className="book-cover-pattern" aria-hidden="true" />
          <div className="book-cover-frame" aria-hidden="true" />
          <div className="book-cover-glow" aria-hidden="true" />
          <div className="book-cover-top-rule" aria-hidden="true" />
          <div className="book-cover-bottom-rule" aria-hidden="true" />
          <div className="book-cover-center-seal" aria-hidden="true" />

          <div className="book-cover-author relative z-10" style={coverTextStyle}>
            {AUTHOR_DISPLAY_NAME}
          </div>

          <div className="book-cover-title-panel relative z-10 w-[88%]" dir="auto">
            <h3
              className={`book-cover-title ${TITLE_CLASS[size]}`}
              style={coverTextStyle}
            >
              {title}
            </h3>
            {coverMeta && (
              <p className="book-cover-meta mt-2 line-clamp-1" style={coverTextStyle}>
                {coverMeta}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
