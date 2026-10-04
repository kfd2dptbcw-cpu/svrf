"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { SpotListItem } from "@/lib/forecast/selectors";
import { formatWeekday } from "@/lib/format";

const SurfMap = dynamic(() => import("./SurfMap"), {
  ssr: false,
  loading: () => <MapPlaceholder text="Loading map…" />,
});

/**
 * Lazy-loads Leaflet only when the map scrolls into view, keeping it out of
 * the initial bundle (important for Lighthouse performance).
 */
export function MapSection({ spots, dateKeys }: { spots: SpotListItem[]; dateKeys: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dateKey, setDateKey] = useState(dateKeys[0] ?? "");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="glass overflow-hidden p-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div role="tablist" aria-label="Map day" className="inline-flex rounded-full bg-slate-900/5 p-1 dark:bg-white/5">
          {dateKeys.map((key, index) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === dateKey}
              onClick={() => setDateKey(key)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                key === dateKey ? "bg-white shadow dark:bg-white/15" : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {index === 0 ? "Today" : index === 1 ? "Tomorrow" : formatWeekday(key, "short")}
            </button>
          ))}
        </div>
        <Legend />
      </div>
      <div ref={ref} className="h-[440px] overflow-hidden rounded-lg sm:h-[560px]">
        {visible ? <SurfMap spots={spots} dateKey={dateKey} /> : <MapPlaceholder text="Map loads as you scroll" />}
      </div>
    </div>
  );
}

function MapPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950/5 dark:bg-white/5 text-sm text-slate-500 dark:text-slate-400">
      {text}
    </div>
  );
}

function Legend() {
  const items = [
    ["bg-rating-1", "Poor"],
    ["bg-rating-2", "Fair"],
    ["bg-rating-3", "Good"],
    ["bg-rating-4", "Excellent"],
    ["bg-rating-5", "Epic"],
  ] as const;
  return (
    <ul className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300" aria-label="Rating colours">
      {items.map(([colour, label]) => (
        <li key={label} className="inline-flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-full ${colour}`} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}
