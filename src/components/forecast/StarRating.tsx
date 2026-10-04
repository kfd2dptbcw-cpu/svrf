import type { StarRating as Rating } from "@/types/forecast";
import { RATING_TEXT } from "./rating-styles";

const SIZES = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-7 w-7" } as const;

export function StarRating({ rating, size = "md", label }: { rating: Rating; size?: keyof typeof SIZES; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars${label ? ` — ${label}` : ""}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`${SIZES[size]} ${star <= rating ? RATING_TEXT[rating] : "text-slate-300 dark:text-slate-700"}`}
          fill="currentColor"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L10 14.9l-5.25 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}
