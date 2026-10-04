import Link from "next/link";
import { Menu } from "lucide-react";
import { env } from "@/lib/env";
import type { SearchIndexEntry } from "@/lib/forecast/selectors";
import { SpotSearch } from "./SpotSearch";
import { ThemeToggle } from "./ThemeToggle";

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
    <header className="sticky top-0 z-40 border-b border-slate-900/5 bg-white/60 backdrop-blur-xl dark:border-white/5 dark:bg-abyss/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <Logo />
          <span className="hidden sm:inline">{env.siteName}</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-1 text-sm font-medium">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex flex-1 items-center justify-end gap-2 lg:flex-none">
          <SpotSearch index={searchIndex} />
          <ThemeToggle />
          {/* Zero-JS mobile menu */}
          <details className="group relative lg:hidden">
            <summary
              className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-900/10 bg-white/70 dark:border-white/10 dark:bg-white/5 [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </summary>
            <nav aria-label="Mobile" className="glass absolute top-12 right-0 w-56 p-2 !rounded-2xl">
              <ul className="grid gap-0.5 text-sm font-medium">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="block rounded-xl px-3 py-2 hover:bg-ocean-500/10">
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

function Logo() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-400 to-ocean-700 text-white shadow-lg shadow-ocean-500/30">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M2 16c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
        <path d="M3 11c1.5-4 5-7 9-7 3 0 5 1.5 5 4-2-1-4-.5-5 1.5" />
      </svg>
    </span>
  );
}
