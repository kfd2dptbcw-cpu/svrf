import Link from "next/link";
import { Container, PageHeader, Section } from "@/components/ui/PageHeader";
import { activeCredits } from "@/lib/attribution";
import { env } from "@/lib/env";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About Our Surf Forecasts",
  description: "How our UK surf forecasts work: data sources, update schedule, the surf rating algorithm, wind and tide analysis, and limitations.",
  path: "/about",
});

const RATINGS = [
  ["★", "Poor", "Flat, tiny or blown out. Not worth the trip."],
  ["★★", "Fair", "Surfable but compromised — small, short-period or windy."],
  ["★★★", "Good", "Fun waves with decent size and reasonable wind. Worth a session."],
  ["★★★★", "Excellent", "Quality surf: good size, solid period and clean, offshore-ish winds."],
  ["★★★★★", "Epic", "Everything lines up. Call in sick."],
] as const;

export default function AboutPage() {
  const credits = activeCredits();
  const asTime = (hour: number) => `${String(hour % 24).padStart(2, "0")}:00`;
  const slots = env.refreshHoursUtc.map(asTime).join(" and ");
  const summerSlots = env.refreshHoursUtc.map((hour) => asTime(hour + 1)).join(" and ");
  return (
    <Container className="max-w-4xl">
      <PageHeader eyebrow="About" title="How our forecasts work">
        <p>
          Every forecast on this site is generated automatically from professional weather and ocean models, then
          interpreted for each surf spot using its orientation, swell window, preferred winds and tides.
        </p>
      </PageHeader>

      <div className="space-y-2">
        <Section title="Data sources">
          <ul className="glass list-disc space-y-2 p-6 pl-10 text-slate-700 dark:text-slate-300">
            {credits.map((credit, index) => (
              <li key={credit.name}>
                <strong>{index === 0 ? "Swell, waves, wind and weather" : "Backup source"}:</strong> {credit.marine} {credit.weather}
              </li>
            ))}
            <li>
              <strong>Sunrise and sunset:</strong> calculated from standard solar equations for each beach.
            </li>
            <li>
              <strong>Tides:</strong> modelled sea level from the marine model (or official UK Hydrographic Office
              predictions where configured). Tide times are indicative and <em>not for navigation</em>.
            </li>
            <li>
              <strong>Sea temperature:</strong> modelled sea surface temperature at the forecast point.
            </li>
          </ul>
        </Section>

        <Section title="Update schedule">
          <p className="glass p-6 text-slate-700 dark:text-slate-300">
            Forecasts refresh automatically twice a day at {slots} UTC ({summerSlots} during British Summer Time), shortly after the
            main model runs become available. Processed forecasts are cached for up to 12 hours, so the site stays fast and
            we only make a handful of requests to our data providers each day. If a provider is unavailable we keep showing
            the last good forecast and clearly label it.
          </p>
        </Section>

        <Section title="Surf size">
          <div className="glass space-y-3 p-6 text-slate-700 dark:text-slate-300">
            <p>
              Wave models forecast deep-water swell height. We convert that into an estimated breaking wave face height at
              each beach, accounting for:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Swell period</strong> — long-period groundswell breaks much bigger than short-period windswell of the same height.</li>
              <li><strong>Swell direction</strong> — swell from outside a spot&apos;s swell window is blocked or heavily reduced.</li>
              <li><strong>Local calibration</strong> — some beaches break bigger or smaller than the open-ocean swell suggests.</li>
            </ul>
            <p>Sizes are shown in feet as a range of typical waves to the bigger sets.</p>
          </div>
        </Section>

        <Section title="Surf rating">
          <div className="glass space-y-4 p-6 text-slate-700 dark:text-slate-300">
            <p>Each hour is scored from 0 to 10 by combining:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Size (38%)</strong> — how the surf compares with the spot&apos;s ideal range.</li>
              <li><strong>Wind (32%)</strong> — offshore is best, onshore worst, and strength matters.</li>
              <li><strong>Period (20%)</strong> — longer period means more powerful, better-organised waves.</li>
              <li><strong>Swell direction (10%)</strong> — how squarely the swell hits the spot.</li>
              <li><strong>Tide</strong> — the wrong stage of tide reduces the score at tide-sensitive spots.</li>
            </ul>
            <p>
              Flat or blown-out conditions are capped, so one good factor can&apos;t hide a fatal flaw. A day&apos;s rating is
              the average of its three best daylight hours.
            </p>
            <table className="w-full text-sm">
              <caption className="sr-only">Rating scale</caption>
              <tbody>
                {RATINGS.map(([stars, label, description]) => (
                  <tr key={label} className="border-t border-slate-900/5 dark:border-white/5">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{stars}</td>
                    <th scope="row" className="py-2 pr-3 text-left font-semibold">{label}</th>
                    <td className="py-2">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Wind">
          <p className="glass p-6 text-slate-700 dark:text-slate-300">
            Wind is classified relative to each beach: <strong>offshore</strong> (blowing from the land, grooming the waves),{" "}
            <strong>cross-offshore</strong>, <strong>cross-shore</strong> and <strong>onshore</strong> (blowing from the sea,
            making the surf choppy). Under about 3mph conditions are glassy whatever the direction.
          </p>
        </Section>

        <Section title="Best surf window and skill levels">
          <p className="glass p-6 text-slate-700 dark:text-slate-300">
            The best surf window is the run of daylight hours around the day&apos;s peak that stay close to it in quality,
            together with the stage of tide at the peak. Skill suitability considers wave size, wind, overall quality and
            whether the spot is a sand-bottom beach or a reef.
          </p>
        </Section>

        <Section title="Stay safe">
          <p className="glass p-6 text-slate-700 dark:text-slate-300">
            Forecasts are a guide, not a guarantee. Always check conditions on arrival, surf at lifeguarded beaches between
            the black-and-white flags, and never surf beyond your ability. In an emergency at the coast call 999 and ask
            for the Coastguard. Visit the{" "}
            <a href="https://rnli.org/safety" className="font-medium text-flag-deep underline dark:text-flag" rel="noopener">
              RNLI
            </a>{" "}
            for beach safety advice.
          </p>
        </Section>

        <p className="pt-8">
          <Link href="/spots" className="font-semibold text-flag-deep hover:underline dark:text-flag">
            Explore all surf spots →
          </Link>
        </p>
      </div>
    </Container>
  );
}
