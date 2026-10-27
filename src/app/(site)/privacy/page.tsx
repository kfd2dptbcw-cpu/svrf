import { Container, PageHeader, Section } from "@/components/ui/PageHeader";
import { env } from "@/lib/env";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "What the SVRF forecast website and iPhone app do and do not collect: no accounts, no tracking, favourites kept on your device.",
  path: "/privacy",
});

const CONTACT_EMAIL = "info@svrf.uk";
const UPDATED = "27 October 2026";

export default function PrivacyPage() {
  return (
    <Container className="max-w-4xl">
      <PageHeader eyebrow="Legal" title="Privacy policy">
        <p>
          This policy covers the {env.siteName} website and the SVRF Forecast iPhone app. In short: there are no
          accounts, no advertising and no tracking. Last updated {UPDATED}.
        </p>
      </PageHeader>

      <div className="space-y-2">
        <Section title="Who we are">
          <p className="glass p-6 text-slate-700 dark:text-slate-300">
            The forecast is run by SVRF, a trading name of LYCreative Ltd, a company registered in the United Kingdom.
            You can contact us about anything in this policy at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-flag-deep">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="glass list-disc space-y-2 p-6 pl-10 text-slate-700 dark:text-slate-300">
            <li>
              <strong>No account or personal details.</strong> You do not sign up, log in or give us your name, email
              address or location. We do not ask for or use your device location.
            </li>
            <li>
              <strong>Favourite spots and alert settings</strong> are stored only on your own device (in the app or
              browser storage). They are never sent to us. Deleting the app or clearing site data removes them.
            </li>
            <li>
              <strong>Standard server logs.</strong> Like any website, our hosting provider (Netlify) records technical
              details of each request, such as IP address, browser type and the page requested, to deliver the site and
              keep it secure. We do not use these logs to identify individuals.
            </li>
            <li>
              <strong>No analytics, advertising or tracking.</strong> We do not use analytics tools, advertising
              networks or tracking cookies, and we do not sell or share data about you.
            </li>
          </ul>
        </Section>

        <Section title="Notifications">
          <p className="glass p-6 text-slate-700 dark:text-slate-300">
            If you turn on surf alerts in the iPhone app, the app asks for permission to send notifications. Alerts are
            created on your phone from the public forecast and shown as local notifications. We do not receive your
            device token or your choices, and you can switch alerts off in the app or in iOS Settings at any time.
          </p>
        </Section>

        <Section title="Third parties">
          <ul className="glass list-disc space-y-2 p-6 pl-10 text-slate-700 dark:text-slate-300">
            <li>
              <strong>Map tiles.</strong> The spot map loads map tiles from OpenStreetMap. Your device contacts their
              servers when you view a map, so they will see your IP address under{" "}
              <a href="https://wikimediafoundation.org/wiki/Privacy_policy" className="underline hover:text-flag-deep" rel="noopener">
                their own privacy terms
              </a>
              .
            </li>
            <li>
              <strong>Forecast data.</strong> Weather and ocean data is fetched by our servers from Vaisala Xweather. Your
              device does not contact them and no information about you is passed on.
            </li>
            <li>
              <strong>Plain-English summaries.</strong> Some day summaries are written by an AI service (Anthropic) on our
              server from the public forecast numbers. No information about you is included.
            </li>
            <li>
              <strong>Hosting.</strong> The site is hosted by Netlify, which processes the server logs described above.
            </li>
          </ul>
        </Section>

        <Section title="Children">
          <p className="glass p-6 text-slate-700 dark:text-slate-300">
            We do not knowingly collect personal information from anyone, including children.
          </p>
        </Section>

        <Section title="Your rights">
          <p className="glass p-6 text-slate-700 dark:text-slate-300">
            Because we hold no personal data about you beyond standard server logs, there is usually nothing to access
            or delete. If you want to ask about your rights under UK data protection law, or to complain, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-flag-deep">
              {CONTACT_EMAIL}
            </a>
            . You can also complain to the Information Commissioner&apos;s Office at ico.org.uk.
          </p>
        </Section>

        <Section title="Changes">
          <p className="glass p-6 text-slate-700 dark:text-slate-300">
            If we change how the site or app handles data, we will update this page and the date above.
          </p>
        </Section>
      </div>
    </Container>
  );
}
