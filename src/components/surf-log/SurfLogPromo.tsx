import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import cover from "@/assets/surf-log/cover.webp";
import { SURF_LOG } from "@/lib/surf-log";

/** Promo band for the SVRF Surf Log paperback, used on the homepage. */
export function SurfLogPromo() {
  return (
    <section className="mt-16" aria-labelledby="surf-log-promo-title">
      <div className="grid items-center gap-8 overflow-hidden rounded-2xl bg-ink p-6 text-chalk sm:p-10 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-mono text-xs font-semibold tracking-wide text-slate-400 uppercase">New from SVRF · Paperback</p>
          <h2 id="surf-log-promo-title" className="mt-2 font-display text-3xl tracking-tight text-balance sm:text-4xl">
            Forecast first. Reality after.
          </h2>
          <span className="mt-4 block h-1 w-14 bg-flag" aria-hidden="true" />
          <p className="mt-4 max-w-xl text-seafoam">
            The <strong className="text-chalk">SVRF Surf Log</strong> is a session journal built around the gap between the
            forecast and the surf. Write the call before you paddle out, log what you actually got, and give it a verdict.
            A season later you&apos;ll know your spots better than any app.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={SURF_LOG.amazonUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full bg-flag px-5 py-3 font-semibold text-ink transition hover:bg-chalk"
            >
              Get it on Amazon <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              href={SURF_LOG.path}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 font-semibold transition hover:bg-white/10"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" /> Look inside
            </Link>
          </div>
        </div>
        <Link href={SURF_LOG.path} className="mx-auto block w-40 shrink-0 sm:w-48 md:mx-0" aria-label="SVRF Surf Log: look inside">
          <Image
            src={cover}
            alt="SVRF Surf Log cover"
            width={800}
            height={1200}
            sizes="(min-width: 640px) 192px, 160px"
            className="h-auto w-full rounded-sm shadow-2xl ring-1 ring-white/10 transition hover:-translate-y-1"
          />
        </Link>
      </div>
    </section>
  );
}
