import { cn } from "@/lib/utils";

interface PageFrameProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  maxWidth?: string;
}

export default function PageFrame({
  children,
  className,
  containerClassName,
  maxWidth = "max-w-[90rem]",
}: PageFrameProps) {
  return (
    <main className={cn("scholarly-bg min-h-screen", className)} id="main-content">
      <div className={cn("mx-auto px-3.5 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-20 md:pt-10", maxWidth, containerClassName)}>
        {children}
      </div>
    </main>
  );
}
