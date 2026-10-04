"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Favourite spots, stored in localStorage and synchronised across components
 * and browser tabs. The storage key and shape are deliberately simple so they
 * can later be migrated to a user account (see README → Future features).
 */

const STORAGE_KEY = "surf:favourites";
const EVENT = "surf:favourites-change";
const EMPTY: readonly string[] = [];
let cachedRaw: string | null = null;
let cachedValue: readonly string[] = EMPTY;

function read(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedValue = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, callback);
  };
}

export function useFavourites() {
  const favourites = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((slug: string) => {
    const current = read();
    const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const isFavourite = useCallback((slug: string) => favourites.includes(slug), [favourites]);

  return { favourites, toggle, isFavourite };
}
