import { Shirt } from "lucide-react";
import { afterSessionKit, pickWetsuit } from "@/lib/forecast/engine/wetsuit";
import { formatTemp } from "@/lib/format";
import type { DayForecast } from "@/types/forecast";

const SHOP = "https://svrf.uk/products";

function gearLine(label: string, value: string) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-200/60 py-1.5 text-sm last:border-0 dark:border-slate-700/60">
      <dt className="font-mono text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

/**
 * What to wear in the water, from the day's sea temperature and wind.
 * The pick is a fixed rules table (see engine/wetsuit.ts), not generated text.
 */
export function WetsuitPicker({ day }: { day: DayForecast }) {
  const pick = pickWetsuit({
    seaTempC: day.seaTempC,
    airTempC: day.airTempMinC ?? day.airTempMaxC,
    windSpeedKmh: day.wind?.speedKmh ?? null,
  });
  if (!pick) return null;

  const kit = afterSessionKit(pick);
  const bootsText = { none: "Not needed", optional: "Optional", "3mm": "3mm", "5mm": "5mm" }[pick.boots];
  const glovesText = { none: "Not needed", optional: "If hands struggle", "3mm": "3mm" }[pick.gloves];

  return (
    <section aria-labelledby="wetsuit-title" className="glass-subtle space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Shirt className="h-8 w-8 text-flag" aria-hidden="true" />
        <div>
          <h2 id="wetsuit-title" className="text-sm font-semibold font-mono tracking-wide text-slate-500 uppercase dark:text-slate-400">
            What to wear
          </h2>
          <p className="text-lg font-semibold">{pick.headline}</p>
        </div>
      </div>

      <dl>
        {gearLine("Sea", formatTemp(day.seaTempC))}
        {gearLine("Suit", pick.suit === "shorty" ? "Shorty or 3/2mm" : pick.suit)}
        {gearLine("Boots", bootsText)}
        {gearLine("Gloves", glovesText)}
        {gearLine("Hood", pick.hood ? "Yes" : "Not needed")}
      </dl>

      {pick.notes.length > 0 && (
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          {pick.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="mb-1 text-xs font-medium font-mono tracking-wide text-slate-500 uppercase dark:text-slate-400">For the car park afterwards</h3>
        <ul className="space-y-1 text-sm">
          {kit.map((item) => (
            <li key={item.slug}>
              <a href={`${SHOP}/${item.slug}`} className="font-semibold underline underline-offset-2 hover:text-flag">
                {item.label}
              </a>{" "}
              <span className="text-slate-500 dark:text-slate-400">{item.why}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">A conditions guide, not a safety call. Use your own judgement and the lifeguards&apos; advice.</p>
    </section>
  );
}
