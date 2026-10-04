import type { Metadata } from "next";
import { ResizeReporter } from "@/components/embed/ResizeReporter";
import { DataAttribution } from "@/components/layout/DataAttribution";
import { env } from "@/lib/env";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

/** Chrome-less layout for iframe widgets embedded on other websites. */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3">
      <ResizeReporter />
      <div className="glass p-4">
        {children}
        <p className="mt-3 border-t border-slate-900/5 pt-2 text-right text-[11px] text-slate-500 dark:border-white/5 dark:text-slate-400">
          Forecast by{" "}
          <a href={absoluteUrl("/")} target="_blank" rel="noopener" className="font-medium text-flag-deep dark:text-flag">
            {env.siteName}
          </a>
          <DataAttribution className="ml-1 before:mr-1 before:content-['·']" />
        </p>
      </div>
    </div>
  );
}
