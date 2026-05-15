import { Search } from "lucide-react";
import { useUiTranslations } from "@/lib/ui-translations";

export default function SearchBox({
  buttonLabel = "بحث",
  className = "",
  onChange,
  onSubmit,
  placeholder = "ابحث في المكتبة",
  value,
}: {
  buttonLabel?: string;
  className?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  value: string;
}) {
  const { direction, t } = useUiTranslations();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={`flex w-full min-w-0 flex-col gap-2 sm:flex-row ${className}`}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t(placeholder)}
          className="h-12 w-full rounded-lg border border-border bg-background ps-11 pe-4 text-sm text-foreground shadow-[0_14px_34px_-32px_rgba(0,0,0,0.7)] placeholder:text-muted-foreground transition-colors focus:border-foreground focus:outline-none"
          dir={direction}
          type="search"
        />
      </div>
      <button
        className="h-11 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 sm:h-12"
        disabled={value.trim().length < 2}
        type="submit"
      >
        {t(buttonLabel)}
      </button>
    </form>
  );
}
