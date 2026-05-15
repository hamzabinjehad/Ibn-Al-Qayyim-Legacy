export default function SectionHeader({
  action,
  description,
  title,
}: {
  action?: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
