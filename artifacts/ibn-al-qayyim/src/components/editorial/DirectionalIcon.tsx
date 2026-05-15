import type { ComponentPropsWithoutRef } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage, type TextDirection } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type DirectionalRole = "back" | "forward";
type IconProps = ComponentPropsWithoutRef<typeof ArrowLeft>;

function pointsLeft(role: DirectionalRole, direction: TextDirection) {
  return role === "forward" ? direction === "rtl" : direction === "ltr";
}

export function DirectionalArrow({
  className,
  direction,
  role = "forward",
  ...props
}: IconProps & { direction?: TextDirection; role?: DirectionalRole }) {
  const language = useLanguage();
  const Icon = pointsLeft(role, direction ?? language.direction) ? ArrowLeft : ArrowRight;

  return <Icon className={cn("shrink-0", className)} {...props} />;
}

export function DirectionalChevron({
  className,
  direction,
  role = "forward",
  ...props
}: IconProps & { direction?: TextDirection; role?: DirectionalRole }) {
  const language = useLanguage();
  const Icon = pointsLeft(role, direction ?? language.direction) ? ChevronLeft : ChevronRight;

  return <Icon className={cn("shrink-0", className)} {...props} />;
}

export function DisclosureChevron({
  className,
  direction,
  open,
  ...props
}: IconProps & { direction?: TextDirection; open: boolean }) {
  const language = useLanguage();
  const resolvedDirection = direction ?? language.direction;
  const Icon = open ? ChevronDown : resolvedDirection === "rtl" ? ChevronLeft : ChevronRight;

  return <Icon className={cn("shrink-0 transition-transform", className)} {...props} />;
}
