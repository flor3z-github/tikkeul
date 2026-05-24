import type { CSSProperties } from "react";
import {
  Baby,
  Book,
  BusFront,
  Car,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  HandCoins,
  HeartHandshake,
  HeartPulse,
  HelpCircle,
  Home,
  PawPrint,
  PiggyBank,
  Plane,
  Repeat,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
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
  // Legacy slug retained so historical rows (icon='bus') still render as Car.
  // The new dedicated bus icon uses the `bus-front` slug below.
  bus: Car,
  repeat: Repeat,
  home: Home,
  "heart-pulse": HeartPulse,
  "heart-handshake": HeartHandshake,
  film: Film,
  plane: Plane,
  gift: Gift,
  "more-horizontal": HelpCircle,
  // Custom-category icons (12 new).
  dumbbell: Dumbbell,
  book: Book,
  "gamepad-2": Gamepad2,
  "paw-print": PawPrint,
  baby: Baby,
  shirt: Shirt,
  smartphone: Smartphone,
  fuel: Fuel,
  "bus-front": BusFront,
  sparkles: Sparkles,
  "hand-coins": HandCoins,
  "piggy-bank": PiggyBank,
};

// Icon slugs offered in the category picker, in display order. Meaningful
// slugs only — the legacy `bus` alias and the catch-all `more-horizontal`
// fallback are intentionally excluded (24 = 12 seed icons + 12 new). The
// server action validates created/updated categories against this allowlist.
export const CATEGORY_ICON_SLUGS: string[] = [
  "utensils",
  "coffee",
  "wine",
  "shopping-bag",
  "shirt",
  "car",
  "bus-front",
  "fuel",
  "home",
  "smartphone",
  "heart-pulse",
  "dumbbell",
  "film",
  "gamepad-2",
  "book",
  "plane",
  "heart-handshake",
  "gift",
  "baby",
  "paw-print",
  "sparkles",
  "hand-coins",
  "piggy-bank",
  "repeat",
];

// Fixed swatch palette for custom categories: the Apple system colors used by
// the seed categories, plus a few extras for variety. The server action
// validates the chosen color against this list.
export const CATEGORY_COLORS: string[] = [
  "#FF9500", // orange (식비)
  "#FF6482", // pink (경조/선물)
  "#FF375F", // red-pink (데이트)
  "#FF3B30", // red
  "#A2845E", // brown (술/유흥)
  "#FF9F0A", // amber
  "#FFCC00", // yellow
  "#34C759", // green
  "#30B0C7", // teal (여행/숙박)
  "#32ADE6", // sky
  "#007AFF", // blue
  "#5856D6", // indigo (문화/여가)
  "#AF52DE", // purple
  "#8E8E93", // gray (기타)
];

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
