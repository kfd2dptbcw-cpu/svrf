"use client";

import Link from "next/link";
import { Heart, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DirectionArrow } from "@/components/forecast/DirectionArrow";
import { RatingBadge } from "@/components/forecast/RatingBadge";
import { RATING_BG } from "@/components/forecast/rating-styles";
import { StarRating } from "@/components/forecast/StarRating";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFavourites } from "@/hooks/useFavourites";
import type { CompactDay, SpotListItem } from "@/lib/forecast/selectors";
import { formatMph, formatSurfRange, formatTimeRange, WIND_TYPE_LABELS } from "@/lib/format";
import { matchScore } from "@/lib/search";
import type { SkillLevel } from "@/types/forecast";

interface Filters {
  q: string;
  region: string;
  day: "today" | "tomorrow";
  minFt: number;
  skill: "" | SkillLevel;
  minRating: number;
  wind: "" | "offshore" | "clean";
  sort: "best" | "size" | "name";
  favourites: boolean;
}

const DEFAULT_FILTERS: Filters = {
  q: "",
  region: "",
  day: "today",
  minFt: 0,
  skill: "",
  minRating: 0,
  wind: "",
  sort: "best",
  favourites: false,
};

/** Read filters from the query string so filtered views can be shared and bookmarked. */
function filtersFromUrl(): Filters {
  const params = new URLSearchParams(window.location.search);
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const value = params.get(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  };
  return {
    q: params.get("q") ?? "",
    region: params.get("region") ?? "",
    day: pick("day", ["today", "tomorrow"] as const, "today"),
    minFt: Number(params.get("minFt")) || 0,
    skill: pick("skill", ["", "beginner", "intermediate", "advanced"] as const, ""),
    minRating: Number(params.get("minRating")) || 0,
    wind: pick("wind", ["", "offshore", "clean"] as const, ""),
    sort: pick("sort", ["best", "size", "name"] as const, "best"),
    favourites: params.get("favourites") === "1",
  };
}

function filtersToQuery(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters) as [keyof Filters, Filters[keyof Filters]][]) {
    if (value === DEFAULT_FILTERS[key]) continue;
    params.set(key, typeof value === "boolean" ? "1" : String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function matchesWind(day: CompactDay, wind: Filters["wind"]) {
  if (!wind) return true;
  if (day.windSpeedKmh !== null && day.windSpeedKmh < 5) return true;
  if (wind === "offshore") return day.windType === "offshore";
  return day.windType === "offshore" || day.windType === "cross-offshore";
}

export function SpotExplorer({
  spots,
  regions,
  dateKeys,
}: {
  spots: SpotListItem[];
  regions: { slug: string; name: string }[];
  /** [today, tomorrow] date keys. */
  dateKeys: [string, string];
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [hydrated, setHydrated] = useState(false);
  const { favourites, toggle } = useFavourites();
  const query = useDebouncedValue(filters.q, 80);

  useEffect(() => {
    setFilters(filtersFromUrl());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const url = `${window.location.pathname}${filtersToQuery(filters)}`;
    window.history.replaceState(window.history.state, "", url);
  }, [filters, hydrated]);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const dateKey = filters.day === "today" ? dateKeys[0] : dateKeys[1];

  const results = useMemo(() => {
    const list = spots
      .map((spot) => ({ spot, day: spot.days[dateKey] }))
      .filter(({ spot, day }) => {
        if (query && matchScore(query, spot.name, spot.regionName) === 0) return false;
        if (filters.region && spot.region !== filters.region) return false;
        if (filters.favourites && !favourites.includes(spot.slug)) return false;
        if (!day) return !(filters.minFt || filters.skill || filters.minRating || filters.wind);
        if (day.surfMaxFt < filters.minFt) return false;
        if (filters.minRating && day.rating < filters.minRating) return false;
        if (filters.skill && !["ideal", "good"].includes(day.suitability[filters.skill])) return false;
        return matchesWind(day, filters.wind);
      });
    return list.sort((a, b) => {
      if (filters.sort === "name") return a.spot.name.localeCompare(b.spot.name);
      const sa = a.day ? (filters.sort === "size" ? a.day.surfMaxFt : a.day.score) : -1;
      const sb = b.day ? (filters.sort === "size" ? b.day.surfMaxFt : b.day.score) : -1;
      return sb - sa || a.spot.name.localeCompare(b.spot.name);
    });
  }, [spots, dateKey, query, filters, favourites]);

  const quick = (day: Filters["day"]) => setFilters({ ...DEFAULT_FILTERS, day, minRating: 3, sort: "best" });
  const selectClass =
    "h-10 rounded-xl border border-slate-900/10 bg-paper px-3 text-sm dark:border-white/10 dark:bg-slate-900/60";

  return (
    <div>
      <div className="glass space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-flag-deep dark:text-flag" aria-hidden="true" />
          <span className="mr-2 text-sm font-semibold">Quick filters</span>
          <Chip active={filters.day === "today" && filters.minRating === 3} onClick={() => quick("today")}>
            Best today
          </Chip>
          <Chip active={filters.day === "tomorrow" && filters.minRating === 3} onClick={() => quick("tomorrow")}>
            Best tomorrow
          </Chip>
          <Chip active={filters.skill === "beginner"} onClick={() => update("skill", filters.skill === "beginner" ? "" : "beginner")}>
            Beginner-friendly
          </Chip>
          <Chip active={filters.wind === "offshore"} onClick={() => update("wind", filters.wind === "offshore" ? "" : "offshore")}>
            Offshore winds
          </Chip>
          <Chip active={filters.favourites} onClick={() => update("favourites", !filters.favourites)}>
            <Heart className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            Favourites
          </Chip>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="ml-auto text-sm font-medium text-flag-deep hover:underline dark:text-flag"
          >
            Reset
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <label className="grid gap-1 text-xs font-medium text-slate-500 lg:col-span-2 dark:text-slate-400">
            Search
            <input
              type="search"
              value={filters.q}
              onChange={(event) => update("q", event.target.value)}
              placeholder="Spot or region…"
              className={selectClass}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Day
            <select value={filters.day} onChange={(event) => update("day", event.target.value as Filters["day"])} className={selectClass}>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Region
            <select value={filters.region} onChange={(event) => update("region", event.target.value)} className={selectClass}>
              <option value="">All regions</option>
              {regions.map((region) => (
                <option key={region.slug} value={region.slug}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Wave height
            <select value={filters.minFt} onChange={(event) => update("minFt", Number(event.target.value))} className={selectClass}>
              <option value={0}>Any size</option>
              <option value={2}>2ft+</option>
              <option value={3}>3ft+</option>
              <option value={4}>4ft+</option>
              <option value={6}>6ft+</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Skill level
            <select value={filters.skill} onChange={(event) => update("skill", event.target.value as Filters["skill"])} className={selectClass}>
              <option value="">Any level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Rating
            <select value={filters.minRating} onChange={(event) => update("minRating", Number(event.target.value))} className={selectClass}>
              <option value={0}>Any rating</option>
              <option value={2}>Fair+</option>
              <option value={3}>Good+</option>
              <option value={4}>Excellent+</option>
              <option value={5}>Epic</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Wind
            <select value={filters.wind} onChange={(event) => update("wind", event.target.value as Filters["wind"])} className={selectClass}>
              <option value="">Any wind</option>
              <option value="clean">Clean (offshore / cross-off)</option>
              <option value="offshore">Offshore only</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between text-sm">
          <p aria-live="polite" className="text-slate-600 dark:text-slate-300">
            {results.length} {results.length === 1 ? "spot" : "spots"}
          </p>
          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            Sort
            <select value={filters.sort} onChange={(event) => update("sort", event.target.value as Filters["sort"])} className={selectClass}>
              <option value="best">Best rated</option>
              <option value="size">Biggest waves</option>
              <option value="name">A–Z</option>
            </select>
          </label>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="glass mt-6 p-8 text-center text-slate-600 dark:text-slate-300">
          No spots match these filters. Try widening your search.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(({ spot, day }) => (
            <li key={spot.slug}>
              <ExplorerCard spot={spot} day={day} favourite={favourites.includes(spot.slug)} onToggleFavourite={() => toggle(spot.slug)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
        active
          ? "bg-ink text-chalk ring-ink dark:bg-chalk dark:text-ink dark:ring-chalk"
          : "bg-white/60 text-slate-700 ring-slate-900/10 hover:bg-white dark:bg-white/5 dark:text-slate-200 dark:ring-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function ExplorerCard({
  spot,
  day,
  favourite,
  onToggleFavourite,
}: {
  spot: SpotListItem;
  day: CompactDay | undefined;
  favourite: boolean;
  onToggleFavourite: () => void;
}) {
  return (
    <article className="glass relative flex h-full flex-col gap-3 p-5 transition hover:border-slate-400 dark:hover:border-slate-500">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium font-mono tracking-wide text-slate-600 uppercase dark:text-slate-400">{spot.regionName}</p>
          <h3 className="truncate text-lg font-semibold">
            <Link href={spot.path} className="after:absolute after:inset-0 after:rounded-xl">
              {spot.name}
            </Link>
          </h3>
        </div>
        <button
          type="button"
          onClick={onToggleFavourite}
          aria-pressed={favourite}
          aria-label={favourite ? `Remove ${spot.name} from favourites` : `Add ${spot.name} to favourites`}
          className="relative z-10 rounded-full p-2 text-slate-400 transition hover:bg-flag/10 hover:text-flag"
        >
          <Heart className={`h-4 w-4 ${favourite ? "fill-flag text-flag" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {day ? (
        <>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold font-mono tabular-nums">{formatSurfRange(day.surfMinFt, day.surfMaxFt)}</p>
            <div className="flex items-center gap-2">
              {day.swellDirectionDeg !== null && <DirectionArrow fromDeg={day.swellDirectionDeg} kind="swell" size={22} />}
              {day.windDirectionDeg !== null && (
                <DirectionArrow fromDeg={day.windDirectionDeg} kind="wind" windType={day.windType} size={22} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StarRating rating={day.rating} size="sm" label={day.label} />
            <RatingBadge rating={day.rating} label={day.label} />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{day.headline}</p>
          <p className="mt-auto text-xs text-slate-500 dark:text-slate-400">
            {day.windType ? `${WIND_TYPE_LABELS[day.windType]} ${formatMph(day.windSpeedKmh)}` : "Wind n/a"} ·{" "}
            {day.bestWindow ? `Best ${formatTimeRange(day.bestWindow.start, day.bestWindow.end)}` : "No clear window"}
          </p>
          <span className={`absolute inset-x-5 bottom-0 h-0.5 rounded-full ${RATING_BG[day.rating]}`} aria-hidden="true" />
        </>
      ) : (
        <p className="text-sm text-slate-500">Forecast unavailable</p>
      )}
    </article>
  );
}
