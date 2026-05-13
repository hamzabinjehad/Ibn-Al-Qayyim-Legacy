type Size = "sm" | "md" | "lg";

interface BookCoverProps {
  coverColor: string;
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
  title,
  size = "sm",
  badge,
  className = "",
}: BookCoverProps) {
  return (
    <div
      className={`book-cover flex items-center justify-center rounded-md text-center transition-transform duration-200 group-hover:-translate-y-0.5 ${SIZE_CLASS[size]} ${className}`}
      style={{ backgroundColor: coverColor }}
    >
      <div className="book-cover-frame" aria-hidden="true" />

      {badge && <div className="absolute left-2 top-2 z-10">{badge}</div>}

      <h3
        className={`book-cover-title relative z-10 max-w-[85%] font-bold ${TITLE_CLASS[size]} line-clamp-3`}
      >
        {title}
      </h3>
    </div>
  );
}
