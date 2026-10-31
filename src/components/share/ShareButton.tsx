"use client";

import { useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Share this page. Uses the phone's native share sheet where there is one
 * (iOS, Android, the app) and copies the link everywhere else. The shared link
 * shows the page's own Open Graph card (today's surf at the spot).
 */
export function ShareButton({ title, text, url }: { title: string; text: string; url: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // The person closed the share sheet: nothing to do.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-paper px-4 py-2 text-sm font-medium transition hover:bg-white dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
