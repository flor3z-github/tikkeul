import type { CSSProperties } from "react";
import {
  Book,
  BusFront,
  Briefcase,
  Cloud,
  Film,
  HandCoins,
  Music,
  Repeat,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/**
 * Visual mapping for a fixed expense's `category` (a free-text catalog label
 * copied from subscription_plans at activation — AI/OTT/음악/…, NOT a row in
 * the `categories` table). Used to render fixed-expense rows inside the
 * dashboard day list with the same icon-circle look as transaction rows.
 *
 * Manual ("직접 추가") items carry no category (null) — they get a neutral
 * "repeat" icon; the 「고정」 badge already signals they're recurring, and the
 * subscription vocabulary (AI/OTT/…) doesn't fit 월세/통신비.
 */

type FixedCategoryVisual = { Icon: LucideIcon; color: string };

const NEUTRAL: FixedCategoryVisual = { Icon: Repeat, color: "#8E8E93" };

// Keyed on the catalog category strings (see CATEGORY_ORDER in
// components/fixed-expenses/fixed-expenses-view.tsx). Colors reuse the seed
// palette in lib/utils/category-icon.tsx for visual consistency.
const VISUALS: Record<string, FixedCategoryVisual> = {
  AI: { Icon: Sparkles, color: "#AF52DE" },
  OTT: { Icon: Film, color: "#FF375F" },
  음악: { Icon: Music, color: "#FF6482" },
  멤버십: { Icon: HandCoins, color: "#FF9F0A" },
  배달: { Icon: Utensils, color: "#FF9500" },
  교통: { Icon: BusFront, color: "#007AFF" },
  생산성: { Icon: Briefcase, color: "#5856D6" },
  "독서/교육": { Icon: Book, color: "#30B0C7" },
  클라우드: { Icon: Cloud, color: "#32ADE6" },
};

export function getFixedCategoryVisual(
  category: string | null,
): FixedCategoryVisual {
  if (!category) return NEUTRAL;
  return VISUALS[category] ?? NEUTRAL;
}

/**
 * Icon-circle for a fixed expense, matching the transaction row's swatch
 * (size-10 rounded-full, color @ 15% bg + full-color glyph).
 */
export function FixedCategoryBadge({
  category,
  className,
  style,
}: {
  category: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const { Icon, color } = getFixedCategoryVisual(category);
  return (
    <span
      className={
        "flex size-10 shrink-0 items-center justify-center rounded-full " +
        (className ?? "")
      }
      style={{ backgroundColor: `${color}26`, color, ...style }}
    >
      <Icon className="size-5" />
    </span>
  );
}
