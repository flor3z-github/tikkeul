import type { CSSProperties } from "react";
import {
  Car,
  Coffee,
  Film,
  Gift,
  HeartHandshake,
  HeartPulse,
  HelpCircle,
  Home,
  Plane,
  Repeat,
  ShoppingBag,
  Utensils,
  Wine,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  wine: Wine,
  "shopping-bag": ShoppingBag,
  car: Car,
  // Legacy slug retained so historical rows (icon='bus') still render.
  bus: Car,
  repeat: Repeat,
  home: Home,
  "heart-pulse": HeartPulse,
  "heart-handshake": HeartHandshake,
  film: Film,
  plane: Plane,
  gift: Gift,
  "more-horizontal": HelpCircle,
};

export function CategoryIcon({
  slug,
  className,
  style,
}: {
  slug: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = (slug && ICONS[slug]) || HelpCircle;
  return <Icon className={className} style={style} />;
}
