"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">
        We couldn&apos;t load this forecast. This is usually temporary.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-full bg-flag px-5 py-3 font-semibold text-ink hover:bg-flag-deep hover:text-chalk"
      >
        Try again
      </button>
    </div>
  );
}
