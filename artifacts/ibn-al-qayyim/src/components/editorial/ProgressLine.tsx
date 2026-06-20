import { cn } from "@/lib/utils";
import { useUiTranslations } from "@/lib/ui-translations";

interface ProgressLineProps {
  className?: string;
  label?: string;
  showValue?: boolean;
  value: number;
}

export default function ProgressLine({
  className,
  label = "نسبة القراءة",
  showValue = true,
  value,
}: ProgressLineProps) {
  const { t } = useUiTranslations();
  const normalizedValue = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className={cn("flex items-center gap-3", className)} aria-label={`${t(label)}: ${normalizedValue}%`}>
      {showValue && <span className="min-w-9 text-xs text-muted-foreground tabular-nums">{normalizedValue}%</span>}
      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-foreground/80 transition-all duration-500 ease-out"
          style={{ width: `${normalizedValue}%` }}
        />
      </div>
    </div>
  );
}
