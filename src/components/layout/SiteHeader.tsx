import Link from "next/link";
import { Menu } from "lucide-react";
import { env } from "@/lib/env";
import type { SearchIndexEntry } from "@/lib/forecast/selectors";
import { SpotSearch } from "./SpotSearch";
import { ThemeToggle } from "./ThemeToggle";

/** The main SVRF site this forecast belongs to. */
export const SVRF_HOME = "https://svrf.uk";

export const NAV_LINKS = [
  { href: "/today", label: "Today" },
  { href: "/tomorrow", label: "Tomorrow" },
  { href: "/7-day", label: "7-Day" },
  { href: "/spots", label: "All Spots" },
  { href: "/regions", label: "Regions" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader({ searchIndex }: { searchIndex: SearchIndexEntry[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-900/5 bg-chalk dark:border-white/5 dark:bg-ink">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-baseline gap-2" aria-label={`${env.siteName} home`}>
          <Wordmark />
          <span className="hidden font-mono text-xs tracking-wide text-slate-600 uppercase sm:inline dark:text-slate-400">
            Surf Forecast
          </span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-1 text-sm font-medium">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-md px-3 py-2 text-slate-600 transition hover:bg-slate-950/5 hover:text-ink dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-chalk"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex flex-1 items-center justify-end gap-2 lg:flex-none">
          <a
            href={SVRF_HOME}
            className="hidden shrink-0 font-mono text-xs tracking-wide text-slate-600 uppercase hover:text-flag-deep md:inline dark:text-slate-400 dark:hover:text-flag"
          >
            svrf.uk ↗
          </a>
          <SpotSearch index={searchIndex} />
          <ThemeToggle />
          {/* Zero-JS mobile menu */}
          <details className="group relative lg:hidden">
            <summary
              className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-900/10 bg-paper dark:border-white/10 dark:bg-white/5 [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </summary>
            <nav aria-label="Mobile" className="glass absolute top-12 right-0 w-56 p-2 !rounded-lg">
              <ul className="grid gap-0.5 text-sm font-medium">
                <li>
                  <a href={SVRF_HOME} className="block rounded-md px-3 py-2 font-mono text-xs tracking-wide uppercase hover:bg-slate-950/5 dark:hover:bg-white/5">
                    svrf.uk ↗
                  </a>
                </li>
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="block rounded-md px-3 py-2 hover:bg-slate-950/5 dark:hover:bg-white/5">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

/** Flat text wordmark. */
function Wordmark() {
  return <span className="font-display text-2xl leading-none tracking-tight text-ink dark:text-chalk">SVRF</span>;
}
