import { AlertTriangle, Loader2 } from "lucide-react";

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  description = "تعذر تحميل البيانات.",
  retry,
  title = "حدث خطأ",
}: {
  description?: string;
  retry?: () => void;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-6 py-14 text-center">
      <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function LoadingState({ label = "جار التحميل" }: { label?: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground">
      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
