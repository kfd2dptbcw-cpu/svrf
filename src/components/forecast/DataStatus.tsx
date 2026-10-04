import { AlertTriangle, FlaskConical, RefreshCw } from "lucide-react";
import { formatTimestamp } from "@/lib/format";
import type { ForecastBundle } from "@/types/forecast";

/** Shows when the forecast was produced and warns about stale or sample data. */
export function DataStatus({ bundle, compact = false }: { bundle: ForecastBundle; compact?: boolean }) {
  const updated = bundle.generatedAt > 0 ? formatTimestamp(bundle.generatedAt) : null;
  const next = formatTimestamp(bundle.nextRefreshAt);

  if (bundle.status === "sample") {
    return (
      <Banner tone="violet" icon={<FlaskConical className="h-4 w-4" aria-hidden="true" />}>
        <strong>Sample data — not a real forecast.</strong> Synthetic data is enabled (FORECAST_DATA_SOURCE=sample) for
        development.
      </Banner>
    );
  }
  if (bundle.status === "unavailable") {
    return (
      <Banner tone="rose" icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}>
        <strong>Forecast temporarily unavailable.</strong> Our data providers can&apos;t be reached right now. We&apos;ll try
        again automatically — please check back shortly.
      </Banner>
    );
  }
  if (bundle.status === "stale") {
    return (
      <Banner tone="amber" icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}>
        <strong>Showing the last available forecast</strong>
        {updated ? ` from ${updated}` : ""}. Live data is temporarily unavailable; we&apos;ll refresh automatically.
      </Banner>
    );
  }
  if (compact) return null;
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      Updated {updated} · next update {next} (UK time)
    </p>
  );
}

const TONES = {
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-900 dark:text-violet-200",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
} as const;

function Banner({ tone, icon, children }: { tone: keyof typeof TONES; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div role="status" className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm backdrop-blur ${TONES[tone]}`}>
      <span className="mt-0.5">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
