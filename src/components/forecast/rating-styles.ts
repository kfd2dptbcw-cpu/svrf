import type { StarRating } from "@/types/forecast";

/** Literal class names per rating so Tailwind can see them at build time. */
export const RATING_TEXT: Record<StarRating, string> = {
  1: "text-rating-1",
  2: "text-rating-2",
  3: "text-rating-3",
  4: "text-rating-4",
  5: "text-rating-5",
};

export const RATING_BG: Record<StarRating, string> = {
  1: "bg-rating-1",
  2: "bg-rating-2",
  3: "bg-rating-3",
  4: "bg-rating-4",
  5: "bg-rating-5",
};

export const RATING_SOFT: Record<StarRating, string> = {
  1: "bg-rating-1/15 text-rose-700 ring-rating-1/30 dark:text-rose-300",
  2: "bg-rating-2/15 text-amber-700 ring-rating-2/30 dark:text-amber-300",
  3: "bg-rating-3/15 text-emerald-700 ring-rating-3/30 dark:text-emerald-300",
  4: "bg-rating-4/15 text-cyan-700 ring-rating-4/30 dark:text-cyan-300",
  5: "bg-rating-5/15 text-violet-700 ring-rating-5/30 dark:text-violet-300",
};

/** Hex values (for SVG / map markers rendered outside Tailwind). */
export const RATING_HEX: Record<StarRating, string> = {
  1: "#f43f5e",
  2: "#f59e0b",
  3: "#10b981",
  4: "#06b6d4",
  5: "#8b5cf6",
};
