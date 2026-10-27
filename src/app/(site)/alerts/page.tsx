import { AlertsSettings } from "@/components/alerts/AlertsSettings";
import { Container, PageHeader, Section } from "@/components/ui/PageHeader";
import { pageMetadata } from "@/lib/seo";

export const metadata = {
  ...pageMetadata({
    title: "Surf Alerts",
    description: "Get a notification the evening before a good surf day at your favourite spots.",
    path: "/alerts",
  }),
  robots: { index: false, follow: false },
};

export default function AlertsPage() {
  return (
    <Container className="max-w-2xl">
      <PageHeader eyebrow="iPhone app" title="Surf alerts">
        <p>A notification the evening before a day your favourite spots are forecast to be good.</p>
      </PageHeader>
      <Section title="Settings">
        <AlertsSettings />
      </Section>
    </Container>
  );
}
