"use client";

import { useEffect } from "react";
import { syncAlertsIfStale } from "@/lib/native-alerts";

/** Refreshes scheduled surf alerts whenever the iPhone app is opened. Renders nothing. */
export function AlertsScheduler() {
  useEffect(() => {
    syncAlertsIfStale().catch(() => {
      // Alerts are best-effort; a failed refresh just keeps the previous schedule.
    });
  }, []);
  return null;
}
