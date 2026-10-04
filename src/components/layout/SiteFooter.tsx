import Link from "next/link";
import { getActiveRegions } from "@/lib/config";
import { activeCredits } from "@/lib/attribution";
import { env } from "@/lib/env";

export function SiteFooter() {
  const regions = getActiveRegions();
  const credits = activeCredits();
  return (
    <footer className="mt-24 border-t border-slate-900/5 dark:border-white/5">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 text-sm sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-semibold">{env.siteName}</p>
          <p className="mt-2 max-w-sm text-slate-600 dark:text-slate-400">
            Independent surf forecasts for the UK, built on professional weather and ocean models and updated twice a day.
          </p>
        </div>
        <nav aria-label="Regions">
          <p className="font-semibold">Regions</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-slate-600 dark:text-slate-400">
            {regions.map((region) => (
              <li key={region.slug}>
                <Link href={`/surf/${region.slug}`} className="hover:text-ocean-600 dark:hover:text-ocean-300">
                  {region.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="font-semibold">Data</p>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {credits.length > 0 ? (
              <>
                Marine and weather data from{" "}
                {credits.map((credit, index) => (
                  <span key={credit.name}>
                    {index > 0 && (index === credits.length - 1 ? " and " : ", ")}
                    <a href={credit.url} className="underline hover:text-ocean-600" rel="noopener">
                      {credit.name}
                    </a>
                  </span>
                ))}
                .
              </>
            ) : (
              "Sample data for development — not a real forecast."
            )}{" "}
            Tides are modelled and not for navigation.
          </p>
          <p className="mt-3">
            <Link href="/about" className="font-medium text-ocean-700 hover:underline dark:text-ocean-300">
              How our forecasts work →
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
