import { useEffect, useState, type CSSProperties } from "react";

type Size = "sm" | "md" | "lg";

interface BookCoverProps {
  coverColor: string;
  coverImageAlt?: string;
  coverImageUrl?: string;
  editionLabel?: string;
  publisher?: string;
  title: string;
  size?: Size;
  badge?: React.ReactNode;
  className?: string;
}

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-32 px-4",
  md: "h-44 px-5",
  lg: "h-60 px-7",
};

const TITLE_CLASS: Record<Size, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
};

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
  const accent = coverColor && coverColor !== "#f7f7f7" ? coverColor : "#b08d45";
  const [imageFailed, setImageFailed] = useState(false);
  const canShowImage = !!coverImageUrl && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [coverImageUrl]);

  return (
    <div
      className={`book-cover flex items-center justify-center rounded-md text-center transition-transform duration-200 group-hover:-translate-y-0.5 ${canShowImage ? `book-cover--image ${SIZE_CLASS[size]} px-0` : SIZE_CLASS[size]} ${className}`}
      style={{ "--cover-accent": accent } as CSSProperties}
    >
      {badge && <div className="absolute left-2 top-2 z-10">{badge}</div>}

      {canShowImage ? (
        <img
          alt={coverImageAlt ?? title}
          className="book-cover-image"
          decoding="async"
          loading="lazy"
          onError={() => setImageFailed(true)}
          src={coverImageUrl}
        />
      ) : (
        <>
          <div className="book-cover-frame" aria-hidden="true" />
          <div className="book-cover-glow" aria-hidden="true" />
          <div className="book-cover-top-rule" aria-hidden="true" />
          <div className="book-cover-bottom-rule" aria-hidden="true" />

          <p className="book-cover-author relative z-10">ابن قيم الجوزية</p>
          <h3
            className={`book-cover-title relative z-10 max-w-[85%] font-bold ${TITLE_CLASS[size]} line-clamp-3`}
          >
            {title}
          </h3>
          <p className="book-cover-edition relative z-10">{editionLabel ?? publisher ?? "موروث ابن القيم"}</p>
        </>
      )}
    </div>
  );
}
