import Link from "next/link";
import { Container } from "@/components/ui/PageHeader";

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="text-sm font-semibold font-mono tracking-wide text-slate-600 uppercase dark:text-slate-400">404</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Wiped out</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">We couldn&apos;t find that page. It may have been washed away.</p>
      <Link href="/spots" className="mt-8 inline-block rounded-full bg-flag px-5 py-3 font-semibold text-ink hover:bg-flag-deep hover:text-chalk">
        Browse surf spots
      </Link>
    </Container>
  );
}
