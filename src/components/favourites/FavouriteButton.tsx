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
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur transition ${
        active
          ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          : "border-slate-900/10 bg-white/70 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      }`}
    >
      <Heart className={`h-4 w-4 ${active ? "fill-current" : ""}`} aria-hidden="true" />
      {active ? "Favourite" : "Add to favourites"}
      <span className="sr-only"> — {name}</span>
    </button>
  );
}
