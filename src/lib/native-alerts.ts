"use client";

import { Capacitor } from "@capacitor/core";
import { DEFAULT_ALERT_SETTINGS, alertIds, planAlerts, type AlertSettings } from "@/lib/alerts";
import { ukDateKey } from "@/lib/time";
import type { SpotListItem } from "@/lib/forecast/selectors";

/**
 * Device-side glue for surf alerts. Only does anything inside the iPhone app
 * (Capacitor native platform); on the plain website every function is a no-op.
 * Alerts are local notifications built from the public forecast, so no push
 * server, account or device token is involved.
 */

const SETTINGS_KEY = "surf:alerts";
const LAST_SYNC_KEY = "surf:alerts-synced";
const FAVOURITES_KEY = "surf:favourites";
const RESYNC_AFTER_MS = 3 * 60 * 60 * 1000;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function loadAlertSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_ALERT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AlertSettings>;
    return {
      enabled: parsed.enabled === true,
      minRating: Number.isInteger(parsed.minRating) && parsed.minRating! >= 1 && parsed.minRating! <= 5 ? parsed.minRating! : DEFAULT_ALERT_SETTINGS.minRating,
      hour: Number.isInteger(parsed.hour) && parsed.hour! >= 0 && parsed.hour! <= 23 ? parsed.hour! : DEFAULT_ALERT_SETTINGS.hour,
    };
  } catch {
    return DEFAULT_ALERT_SETTINGS;
  }
}

export function saveAlertSettings(settings: AlertSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: settings just won't persist.
  }
}

function loadFavourites(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Asks iOS for notification permission; resolves true if granted. */
export async function requestAlertPermission(): Promise<boolean> {
  if (!isNativeApp()) return false;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  if (current.display === "denied") return false;
  const result = await LocalNotifications.requestPermissions();
  return result.display === "granted";
}

async function fetchSpots(): Promise<SpotListItem[]> {
  const response = await fetch(`${BASE_PATH}/api/forecast`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Forecast request failed (${response.status})`);
  const data = (await response.json()) as { spots?: SpotListItem[] };
  return data.spots ?? [];
}

/**
 * Cancels previously planned alerts and schedules the next week from the
 * current forecast. Returns how many alerts were scheduled.
 */
export async function syncAlerts(): Promise<number> {
  if (!isNativeApp()) return 0;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: alertIds().map((id) => ({ id })) });

  const settings = loadAlertSettings();
  if (!settings.enabled) return 0;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return 0;

  const now = new Date();
  const plan = planAlerts(await fetchSpots(), loadFavourites(), settings, ukDateKey(Math.floor(now.getTime() / 1000)), now);
  if (plan.length > 0) {
    await LocalNotifications.schedule({
      notifications: plan.map((alert) => ({
        id: alert.id,
        title: alert.title,
        body: alert.body,
        schedule: { at: alert.at, allowWhileIdle: true },
      })),
    });
  }
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(now.getTime()));
  } catch {
    // Ignore.
  }
  return plan.length;
}

/** Re-syncs on app open unless it already ran in the last few hours. */
export async function syncAlertsIfStale(): Promise<void> {
  if (!isNativeApp() || !loadAlertSettings().enabled) return;
  let last = 0;
  try {
    last = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0);
  } catch {
    last = 0;
  }
  if (Date.now() - last < RESYNC_AFTER_MS) return;
  await syncAlerts();
}
