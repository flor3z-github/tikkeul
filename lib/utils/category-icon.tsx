import {
  Bus,
  Coffee,
  Heart,
  HelpCircle,
  Home,
  Repeat,
  ShoppingBag,
  Utensils,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  bus: Bus,
  "shopping-bag": ShoppingBag,
  repeat: Repeat,
  home: Home,
  "heart-pulse": Heart,
  "more-horizontal": HelpCircle,
};

export function CategoryIcon({
  slug,
  className,
}: {
  slug: string | null;
  className?: string;
}) {
  const Icon = (slug && ICONS[slug]) || HelpCircle;
  return <Icon className={className} />;
}
