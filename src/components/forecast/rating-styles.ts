import type { StarRating } from "@/types/forecast";

/**
 * Rating colours follow the SVRF palette: neutrals (Fog → Slate → Ink/Chalk)
 * build up to the single accent, Flag Orange, for Excellent and Epic.
 * Literal class names so Tailwind can see them at build time.
 */
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
  1: "bg-slate-950/5 text-slate-600 ring-slate-950/10 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10",
  2: "bg-slate-950/10 text-slate-700 ring-slate-950/15 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15",
  3: "bg-ink/90 text-chalk ring-ink dark:bg-chalk/90 dark:text-ink dark:ring-chalk",
  4: "bg-flag/15 text-flag-deep ring-flag/40 dark:text-flag",
  5: "bg-flag text-ink ring-flag",
};

/** Hex values (for SVG, Open Graph images and map markers rendered outside Tailwind). */
export const RATING_HEX: Record<StarRating, string> = {
  1: "#8E9A9C",
  2: "#4A5459",
  3: "#0B0D0E",
  4: "#FF8A66",
  5: "#FF4E1F",
};
