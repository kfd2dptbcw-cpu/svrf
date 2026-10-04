"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { matchScore } from "@/lib/search";
import type { SearchIndexEntry } from "@/lib/forecast/selectors";

/** Instant spot search (press "/" to focus). Runs entirely client-side on a tiny index. */
export function SpotSearch({ index }: { index: SearchIndexEntry[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return index
      .map((entry) => ({ entry, score: matchScore(query, entry.name, entry.regionName) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
      .slice(0, 8)
      .map((result) => result.entry);
  }, [index, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(path);
  };

  const showResults = open && query.trim().length > 0;

  return (
    <div className="relative w-full max-w-xs">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search surf spots
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showResults}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showResults && results[active] ? `${listId}-${results[active].slug}` : undefined}
        autoComplete="off"
        placeholder="Search spots…  /"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (event.key === "Enter" && results[active]) {
            event.preventDefault();
            go(results[active].path);
          } else if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="h-10 w-full rounded-full border border-slate-900/10 bg-paper pr-4 pl-9 text-sm placeholder:text-slate-400 focus:border-flag focus:outline-none dark:border-white/10 dark:bg-white/5"
      />
      {showResults && (
        <ul
          id={listId}
          role="listbox"
          className="glass absolute top-12 right-0 left-0 z-50 max-h-80 overflow-auto p-1.5 !rounded-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No spots match “{query}”</li>
          ) : (
            results.map((entry, i) => (
              <li
                key={entry.slug}
                id={`${listId}-${entry.slug}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(entry.path);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer rounded-xl px-3 py-2 text-sm ${i === active ? "bg-slate-950/10 dark:bg-white/10" : ""}`}
              >
                <span className="font-medium">{entry.name}</span>
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{entry.regionName}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
