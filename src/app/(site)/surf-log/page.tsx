import Image, { type StaticImageData } from "next/image";
import {
  ArrowUpRight,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  Compass,
  MapPin,
  NotebookPen,
  Target,
  Waves,
} from "lucide-react";
import cover from "@/assets/surf-log/cover.webp";
import guidePage from "@/assets/surf-log/page-guide.webp";
import quiverPage from "@/assets/surf-log/page-quiver.webp";
import sessionPage from "@/assets/surf-log/page-session.webp";
import spotPage from "@/assets/surf-log/page-spot.webp";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, Section } from "@/components/ui/PageHeader";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { SURF_LOG } from "@/lib/surf-log";

export const metadata = pageMetadata({
  title: "SVRF Surf Log: a surf journal for reading the sea",
  description:
    "A 192-page surf journal built around forecast vs reality: 120 session pages, spot files, quiver log, monthly reviews and a field guide for UK cold-water surfers. Paperback on Amazon.",
  path: SURF_LOG.path,
});

const FEATURES = [
  { icon: NotebookPen, title: "120 session pages", text: "Forecast vs reality side by side, with a tide curve, swell and wind compass, kit, crowd and stoke." },
  { icon: Target, title: "Forecast scorecard", text: "Give every forecast a verdict (called it, close or way off) and work out your season hit rate." },
  { icon: MapPin, title: "8 spot files", text: "Map each break's recipe: swell window, offshore wind, best tide, hazards and a lineup sketch." },
  { icon: Waves, title: "6 quiver pages", text: "Dims, volume, fins and a ding log for every board, plus a wetsuit log and car-kit checklist." },
  { icon: Compass, title: "7-page field guide", text: "Swell period, wind, tides and the rule of twelfths, wetsuits by water temperature, etiquette and safety." },
  { icon: CalendarRange, title: "Monthly reviews", text: "Twelve reviews and a year-at-a-glance tracker that turn a stack of sessions into lessons." },
] as const;

const PAGES: { src: StaticImageData; alt: string; caption: string }[] = [
  { src: sessionPage, alt: "A session page with the forecast vs reality table, tide curve and compass", caption: "Session page" },
  { src: spotPage, alt: "A spot file page with compasses for the swell window and offshore wind", caption: "Spot file" },
  { src: guidePage, alt: "The field guide page on swell and period", caption: "Field guide" },
  { src: quiverPage, alt: "A quiver page for logging a surfboard's dimensions and dings", caption: "The quiver" },
];

const STEPS = [
  { title: "Write the forecast", text: "Before you paddle out, note the size, period, swell and wind the forecast called. Thirty seconds in the car park." },
  { title: "Log what you got", text: "After the session, fill in what actually turned up. Draw the arrows, bracket the tide, colour in the rating." },
  { title: "Give it a verdict", text: "Called it, close or way off. Over a season you'll learn which forecasts to trust, at which spots, in which conditions." },
] as const;

function BuyButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={SURF_LOG.amazonUrl}
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-2 rounded-full bg-flag px-5 py-3 font-semibold text-ink transition hover:bg-flag-deep hover:text-chalk ${className}`}
    >
      Buy on Amazon <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

function bookJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: SURF_LOG.title,
    alternativeHeadline: SURF_LOG.subtitle,
    bookFormat: "https://schema.org/Paperback",
    numberOfPages: SURF_LOG.pages,
    inLanguage: "en-GB",
    author: { "@type": "Organization", name: "SVRF" },
    publisher: { "@type": "Organization", name: "LYCreative Ltd" },
    image: absoluteUrl(`${SURF_LOG.path}/opengraph-image.jpg`),
    url: absoluteUrl(SURF_LOG.path),
    sameAs: SURF_LOG.amazonUrl,
  };
}

export default function SurfLogPage() {
  return (
    <>
      <JsonLd data={bookJsonLd()} />
      <section className="overflow-hidden bg-ink text-chalk">
        <Container className="grid items-center gap-10 py-14 sm:py-20 md:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-sm font-semibold tracking-wide text-slate-400 uppercase">{SURF_LOG.title} · Paperback</p>
            <h1 className="mt-2 font-display text-4xl tracking-tight text-balance sm:text-6xl">Forecast first. Reality after.</h1>
            <span className="mt-5 block h-1.5 w-16 bg-flag" aria-hidden="true" />
            <p className="mt-5 max-w-2xl text-lg text-seafoam">
              The forecast said four foot and clean. You got two foot and onshore, or the session of your life. The SVRF
              Surf Log is a surf journal built around that gap: write the forecast before you paddle out, log what you
              actually got, and give it a verdict.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <BuyButton />
              <p className="font-mono text-xs tracking-wide text-slate-400 uppercase">
                {SURF_LOG.pages} pages · {SURF_LOG.format}
              </p>
            </div>
          </div>
          <div className="mx-auto w-56 sm:w-72 md:mx-0">
            <Image
              src={cover}
              alt="SVRF Surf Log cover"
              width={800}
              height={1200}
              priority
              sizes="(min-width: 640px) 288px, 224px"
              className="h-auto w-full rounded-sm shadow-2xl ring-1 ring-white/10"
            />
          </div>
        </Container>
      </section>

      <Container>
        <Section title="How it works" id="how-it-works">
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="glass p-6">
                <span className="font-mono text-sm font-bold text-flag-deep dark:text-flag">0{index + 1}</span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-300">{step.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="What's inside" id="inside" description="192 pages, printed on white paper with a matte cover, at a size that fits the glovebox.">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="glass flex gap-4 p-5">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-flag-deep dark:text-flag" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Look inside"
          id="look-inside"
          description={
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" aria-hidden="true" /> A few of the pages, as printed.
            </span>
          }
        >
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {PAGES.map((page) => (
              <li key={page.caption}>
                <figure>
                  <Image
                    src={page.src}
                    alt={page.alt}
                    width={800}
                    height={1200}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="h-auto w-full rounded-sm bg-white shadow-md ring-1 ring-slate-900/10"
                  />
                  <figcaption className="mt-2 font-mono text-xs tracking-wide text-slate-600 uppercase dark:text-slate-400">
                    {page.caption}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </Section>

        <section className="mt-16 rounded-2xl bg-ink p-8 text-chalk sm:p-12" aria-labelledby="surf-log-cta-title">
          <ClipboardCheck className="h-6 w-6 text-flag" aria-hidden="true" />
          <h2 id="surf-log-cta-title" className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
            Log it. Learn it. Call it.
          </h2>
          <p className="mt-3 max-w-xl text-seafoam">
            For surfers at every level, from first lessons to cold-water regulars, and a good gift for the surfer who
            checks the forecast five times before breakfast.
          </p>
          <BuyButton className="mt-6" />
        </section>
      </Container>
    </>
  );
}
