import Link from "next/link";
import { Container } from "@/components/ui/PageHeader";

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="text-sm font-semibold tracking-wide text-ocean-700 uppercase dark:text-ocean-300">404</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Wiped out</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">We couldn&apos;t find that page. It may have been washed away.</p>
      <Link href="/spots" className="mt-8 inline-block rounded-full bg-ocean-600 px-5 py-3 font-semibold text-white hover:bg-ocean-700">
        Browse surf spots
      </Link>
    </Container>
  );
}
