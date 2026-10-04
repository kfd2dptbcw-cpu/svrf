"use client";

import { Heart } from "lucide-react";
import { useFavourites } from "@/hooks/useFavourites";

export function FavouriteButton({ slug, name }: { slug: string; name: string }) {
  const { isFavourite, toggle } = useFavourites();
  const active = isFavourite(slug);
  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-flag/40 bg-flag/10 text-flag-deep dark:text-flag"
          : "border-slate-900/10 bg-paper hover:bg-white dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800"
      }`}
    >
      <Heart className={`h-4 w-4 ${active ? "fill-current" : ""}`} aria-hidden="true" />
      {active ? "Favourite" : "Add to favourites"}
      <span className="sr-only"> — {name}</span>
    </button>
  );
}
