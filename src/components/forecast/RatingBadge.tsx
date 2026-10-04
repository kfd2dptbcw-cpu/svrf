import type { StarRating } from "@/types/forecast";
import { RATING_SOFT } from "./rating-styles";

export function RatingBadge({ rating, label, className = "" }: { rating: StarRating; label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold ring-1 ring-inset ${RATING_SOFT[rating]} ${className}`}>
      {label}
    </span>
  );
}
