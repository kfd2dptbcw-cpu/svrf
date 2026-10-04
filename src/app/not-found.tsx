import Link from "next/link";

/** Root 404 for URLs that match no route group. */
export default function RootNotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-sm font-semibold font-mono tracking-wide text-slate-600 uppercase dark:text-slate-400">404</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Wiped out</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">We couldn&apos;t find that page.</p>
      <Link href="/" className="mt-8 inline-block rounded-full bg-flag px-5 py-3 font-semibold text-ink hover:bg-flag-deep hover:text-chalk">
        Back to the forecast
      </Link>
    </main>
  );
}
