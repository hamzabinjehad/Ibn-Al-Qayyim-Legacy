import { Search } from "lucide-react";

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
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={`flex w-full flex-col gap-3 sm:flex-row ${className}`}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-14 w-full rounded-lg border border-border bg-background pr-12 pl-4 text-base text-foreground shadow-[0_16px_40px_-36px_rgba(0,0,0,0.7)] placeholder:text-muted-foreground transition-colors focus:border-foreground focus:outline-none"
          type="search"
        />
      </div>
      <button
        className="h-14 rounded-lg bg-primary px-7 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        disabled={value.trim().length < 2}
        type="submit"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
