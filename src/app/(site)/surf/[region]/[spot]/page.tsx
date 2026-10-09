import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Code2, MapPin } from "lucide-react";
import { ConditionTiles } from "@/components/forecast/ConditionTiles";
import { DataStatus } from "@/components/forecast/DataStatus";
import { DayStrip } from "@/components/forecast/DayStrip";
import { ForecastHolding } from "@/components/forecast/ForecastHolding";
import { HourlyTable } from "@/components/forecast/HourlyTable";
import { RatingBadge } from "@/components/forecast/RatingBadge";
import { StarRating } from "@/components/forecast/StarRating";
import { SuitabilityBadges } from "@/components/forecast/SuitabilityBadges";
import { TideChart } from "@/components/forecast/TideChart";
import { FavouriteButton } from "@/components/favourites/FavouriteButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, Section } from "@/components/ui/PageHeader";
import { getRegion, getSpot, spots, type ResolvedSpot } from "@/lib/config";
import { degreesToCompass } from "@/lib/forecast/engine/angles";
import { getSpotForecast } from "@/lib/forecast/service";
import { todayKey } from "@/lib/forecast/selectors";
import { formatFullDate, formatSurfRange, formatWeekday } from "@/lib/format";
import { ukDateKey } from "@/lib/time";
import { breadcrumbJsonLd, pageMetadata, spotJsonLd } from "@/lib/seo";

export const revalidate = 3600;

type Params = Promise<{ region: string; spot: string }>;

export function generateStaticParams() {
  return spots.map((spot) => ({ region: spot.region, spot: spot.slug }));
}

async function resolve(params: Params) {
  const { region: regionSlug, spot: spotSlug } = await params;
  const spot = getSpot(spotSlug);
  const region = getRegion(regionSlug);
  if (!spot || !region || spot.region !== region.slug) return null;
  return { spot, region };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const resolved = await resolve(params);
  if (!resolved) return {};
  const { spot, region } = resolved;
  return pageMetadata({
    title: `${spot.name} Surf Forecast`,
    description: `${spot.name}, ${region.name} surf forecast: wave height, swell period and direction, wind, tides, best surf times and a 7-day outlook. Updated daily.`,
    path: spot.path,
  });
}

export default async function SpotPage({ params }: { params: Params }) {
  const resolved = await resolve(params);
  if (!resolved) notFound();
  const { spot, region } = resolved;
  const { bundle, forecast } = await getSpotForecast(spot.slug);
  const today = todayKey();
  const days = forecast?.days.filter((day) => day.date >= today) ?? [];
  const current = days[0];

  return (
    <Container>
      <JsonLd
        data={[
          spotJsonLd(spot, region),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: region.name, path: `/surf/${region.slug}` },
            { name: spot.name, path: spot.path },
          ]),
        ]}
      />
      <nav aria-label="Breadcrumb" className="pt-6 text-sm text-slate-500 dark:text-slate-400">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-flag-deep">Home</Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <li>
            <Link href={`/surf/${region.slug}`} className="hover:text-flag-deep">{region.name}</Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <li aria-current="page" className="text-slate-700 dark:text-slate-200">{spot.name}</li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4 pt-6 pb-6">
        <div className="max-w-3xl">
          <p className="flex items-center gap-1 text-sm font-semibold font-mono tracking-wide text-slate-600 uppercase dark:text-slate-400">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {region.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{spot.name} surf forecast</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">{spot.description}</p>
        </div>
        <FavouriteButton slug={spot.slug} name={spot.name} />
      </header>

      <DataStatus bundle={bundle} />

      {current ? (
        <>
          <section aria-labelledby="now-title" className="glass mt-6 grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="flex flex-col gap-4">
              <h2 id="now-title" className="text-sm font-semibold font-mono tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {current.date === today ? "Today" : formatWeekday(current.date)} · {formatFullDate(current.date)}
              </h2>
              <p className="text-6xl font-bold tracking-tight font-mono tabular-nums sm:text-7xl">
                {formatSurfRange(current.surfMinFt, current.surfMaxFt)}
              </p>
              <div className="flex items-center gap-3">
                <StarRating rating={current.rating} size="lg" label={current.label} />
                <RatingBadge rating={current.rating} label={current.label} className="text-sm" />
              </div>
              <div className="space-y-1 text-lg">
                {current.summary.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            <ConditionTiles day={current} />
          </section>

          <Section title="Who's it for?" id="suitability">
            <SuitabilityBadges suitability={current.suitability} detailed />
          </Section>

          <Section title="7-day forecast" id="week">
            <DayStrip days={days} todayKey={today} />
          </Section>

          <Section title="Day by day" id="days" description="Hourly conditions through daylight hours. Bars are coloured by surf quality.">
            <div className="space-y-4">
              {days.map((day, index) => {
                const hours = forecast!.hourly.filter((hour) => ukDateKey(hour.time) === day.date);
                return (
                  <details key={day.date} id={`day-${day.date}`} open={index === 0} className="glass group scroll-mt-24 p-0">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-5 [&::-webkit-details-marker]:hidden">
                      <span className="w-40 font-semibold">
                        {day.date === today ? "Today" : formatWeekday(day.date)}
                        <span className="block text-sm font-normal text-slate-500 dark:text-slate-400">{formatFullDate(day.date)}</span>
                      </span>
                      <span className="text-2xl font-bold font-mono tabular-nums">{formatSurfRange(day.surfMinFt, day.surfMaxFt)}</span>
                      <StarRating rating={day.rating} size="sm" label={day.label} />
                      <span className="hidden flex-1 text-sm text-slate-600 md:block dark:text-slate-300">{day.summary[0]}</span>
                      <ChevronRight className="ml-auto h-5 w-5 transition group-open:rotate-90" aria-hidden="true" />
                    </summary>
                    <div className="space-y-6 border-t border-slate-900/5 p-5 dark:border-white/5">
                      <div className="space-y-0.5 text-slate-700 dark:text-slate-200">
                        {day.summary.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                      <SuitabilityBadges suitability={day.suitability} />
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">Tide</h3>
                        <TideChart hours={hours} events={day.tideEvents} window={day.bestWindow} />
                      </div>
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">Hour by hour</h3>
                        <HourlyTable hours={hours} caption={`Hourly surf forecast for ${spot.name}, ${formatFullDate(day.date)}`} />
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </Section>
        </>
      ) : bundle.status === "unavailable" ? (
        <ForecastHolding className="mt-6" />
      ) : (
        <p className="glass mt-6 p-8 text-center text-slate-600 dark:text-slate-300">
          The forecast for {spot.name} is temporarily unavailable. We refresh automatically every day — please check back soon.
        </p>
      )}

      <Section title={`About ${spot.name}`} id="about-spot">
        <SpotProfile spot={spot} />
      </Section>

      <p className="mt-10 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Code2 className="h-4 w-4" aria-hidden="true" />
        Want this forecast on your website? Embed{" "}
        <Link href={`/embed/${spot.region}/${spot.slug}`} className="font-medium text-flag-deep hover:underline dark:text-flag">
          the {spot.name} widget
        </Link>
        .
      </p>
    </Container>
  );
}

function SpotProfile({ spot }: { spot: ResolvedSpot }) {
  const items: [string, string][] = [
    ["Break type", spot.breakType === "rivermouth" ? "River mouth" : spot.breakType.charAt(0).toUpperCase() + spot.breakType.slice(1)],
    ["Faces", `${degreesToCompass(spot.orientation)} (${Math.round(spot.orientation)}°)`],
    ["Best swell", `${degreesToCompass(spot.swell.optimal)} (works ${degreesToCompass(spot.swell.window[0])}–${degreesToCompass(spot.swell.window[1])})`],
    ["Best wind", spot.wind.preferred.map((deg) => degreesToCompass(deg)).join(", ")],
    ["Best tide", spot.tide.ideal.map((phase) => phase.charAt(0).toUpperCase() + phase.slice(1)).join(" to ")],
    ["Typical size", `${spot.waveRangeFt[0]}–${spot.waveRangeFt[1]}ft`],
    ["Suits", spot.skillLevels.map((level) => level.charAt(0).toUpperCase() + level.slice(1)).join(", ")],
    ["Location", `${spot.location.lat.toFixed(4)}, ${spot.location.lon.toFixed(4)}`],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <dl className="glass grid gap-x-6 gap-y-3 p-6 sm:grid-cols-2 lg:col-span-2">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium font-mono tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</dt>
            <dd className="mt-0.5 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="glass p-6">
        <h3 className="text-xs font-medium font-mono tracking-wide text-slate-500 uppercase dark:text-slate-400">Hazards</h3>
        {spot.hazards.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {spot.hazards.map((hazard) => (
              <li key={hazard}>{hazard}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm">No specific hazards listed. Always check local conditions and surf between the flags.</p>
        )}
      </div>
    </div>
  );
}
