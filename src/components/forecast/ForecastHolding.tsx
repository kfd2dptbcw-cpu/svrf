/**
 * Shown on full-site pages in place of forecast content when there is no
 * forecast at all (bundle status "unavailable"). Stale forecasts keep showing
 * with DataStatus's note instead. Embed widgets collapse rather than use this.
 */
export const HOLDING_LINKS = [
  { label: "Where to go in the meantime", href: "https://svrf.uk/pages/uk-surf-spots" },
  { label: "Spot reviews", href: "https://svrf.uk/blogs/news" },
  { label: "Kit for the car park", href: "https://svrf.uk/collections/all" },
] as const;

export function ForecastHolding({ className = "" }: { className?: string }) {
  return (
    <section
      role="status"
      aria-labelledby="forecast-holding-title"
      data-forecast-holding=""
      className={`glass border-l-4 border-l-flag p-6 sm:p-8 ${className}`}
    >
      <p className="font-mono text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-400">FORECAST · OFF THE BOIL</p>
      <h2 id="forecast-holding-title" className="mt-2 text-2xl text-balance sm:text-3xl">
        The forecast&apos;s having a lie-in.
      </h2>
      <p className="mt-3 max-w-2xl text-slate-700 dark:text-slate-300">
        Our data feed has run dry for a bit, so there&apos;s nothing honest to show you right now. We&apos;d rather show you
        nothing than make something up. It&apos;ll be back shortly.
      </p>
      <ul className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
        {HOLDING_LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="font-mono text-sm font-medium underline decoration-flag decoration-2 underline-offset-4 hover:text-flag-deep dark:hover:text-flag"
            >
              {link.label} →
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
