"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useFavourites } from "@/hooks/useFavourites";
import type { AlertSettings } from "@/lib/alerts";
import { isNativeApp, loadAlertSettings, requestAlertPermission, saveAlertSettings, syncAlerts } from "@/lib/native-alerts";

const subscribe = () => () => {};
const RATINGS = [
  [2, "Fair or better"],
  [3, "Good or better"],
  [4, "Excellent or better"],
  [5, "Epic only"],
] as const;
const HOURS = [16, 17, 18, 19, 20, 21];

export function AlertsSettings() {
  const native = useSyncExternalStore(subscribe, isNativeApp, () => false);
  const { favourites } = useFavourites();
  const [settings, setSettings] = useState<AlertSettings>(() => (typeof window === "undefined" ? { enabled: false, minRating: 3, hour: 18 } : loadAlertSettings()));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!native) {
    return (
      <p className="glass p-6 text-slate-700 dark:text-slate-300">
        Surf alerts are available in the SVRF Forecast iPhone app. They send you a notification the evening before a day
        your favourite spots are forecast to be good.
      </p>
    );
  }

  async function update(next: AlertSettings) {
    setBusy(true);
    setMessage(null);
    try {
      if (next.enabled && !settings.enabled) {
        const granted = await requestAlertPermission();
        if (!granted) {
          setMessage("Notifications are turned off for this app. Enable them in iOS Settings, Notifications, SVRF Forecast.");
          return;
        }
      }
      setSettings(next);
      saveAlertSettings(next);
      const count = await syncAlerts();
      setMessage(
        !next.enabled
          ? "Alerts are off."
          : count > 0
            ? `${count} alert${count === 1 ? "" : "s"} scheduled for the coming week.`
            : "Alerts are on. Nothing in the next week reaches your rating yet; we will check again when you open the app.",
      );
    } catch {
      setMessage("Could not update alerts. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass space-y-6 p-6 text-slate-700 dark:text-slate-300">
      <label className="flex items-center justify-between gap-4">
        <span className="font-medium">Surf alerts</span>
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={settings.enabled}
          disabled={busy}
          onChange={(event) => update({ ...settings, enabled: event.target.checked })}
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <span>Alert me when a spot is</span>
        <select
          className="rounded-lg border border-slate-900/10 bg-paper px-3 py-2 dark:border-white/10 dark:bg-slate-900"
          value={settings.minRating}
          disabled={busy}
          onChange={(event) => update({ ...settings, minRating: Number(event.target.value) })}
        >
          {RATINGS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between gap-4">
        <span>Send the evening before at</span>
        <select
          className="rounded-lg border border-slate-900/10 bg-paper px-3 py-2 dark:border-white/10 dark:bg-slate-900"
          value={settings.hour}
          disabled={busy}
          onChange={(event) => update({ ...settings, hour: Number(event.target.value) })}
        >
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </label>

      <p className="text-sm">
        {favourites.length > 0 ? (
          <>
            Alerts cover your {favourites.length} favourite spot{favourites.length === 1 ? "" : "s"}.
          </>
        ) : (
          <>
            You have no favourite spots yet. Tap the heart on a{" "}
            <Link href="/spots" className="underline hover:text-flag-deep">
              spot page
            </Link>{" "}
            to add one.
          </>
        )}
      </p>

      {message ? (
        <p role="status" className="text-sm font-medium">
          {message}
        </p>
      ) : null}
    </div>
  );
}
