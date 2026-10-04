import { activeCredits } from "@/lib/attribution";

/**
 * Credit links required by the active data providers — for Xweather, a link to
 * xweather.com reading exactly "Powered by Vaisala Xweather". Rendered on every
 * page (footer) and in every embeddable widget, i.e. wherever the data appears.
 */
export function DataAttribution({ className = "" }: { className?: string }) {
  const required = activeCredits().filter((credit) => credit.requiredLinkText);
  if (required.length === 0) return null;
  return (
    <span className={className}>
      {required.map((credit, index) => (
        <span key={credit.name}>
          {index > 0 && " · "}
          <a
            href={credit.url}
            target="_blank"
            rel="noopener"
            title={credit.requiredLinkText}
            className="font-medium underline hover:text-ocean-600 dark:hover:text-ocean-300"
          >
            {credit.requiredLinkText}
          </a>
        </span>
      ))}
    </span>
  );
}
