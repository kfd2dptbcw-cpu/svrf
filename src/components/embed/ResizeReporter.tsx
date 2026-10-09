"use client";

import { useEffect } from "react";

/**
 * Posts the document height to the parent window so /embed.js can size the
 * iframe to fit its content with no scrollbars. A widget with no forecast
 * (see EmbedEmpty) reports height 0 and `empty: true` so it collapses.
 */
export function ResizeReporter() {
  useEffect(() => {
    if (window.parent === window) return;
    const post = () => window.parent.postMessage({ type: "uk-surf-forecast:resize", ...measureEmbed(document), href: location.pathname }, "*");
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    post();
    return () => observer.disconnect();
  }, []);
  return null;
}

/** Height to report to the host page: 0 when the widget has nothing to show. */
export function measureEmbed(doc: Pick<Document, "querySelector" | "documentElement">): { height: number; empty: boolean } {
  const empty = doc.querySelector("[data-surf-empty]") !== null;
  return { height: empty ? 0 : doc.documentElement.scrollHeight, empty };
}
