"use client";

import { useEffect } from "react";

/**
 * Posts the document height to the parent window so /embed.js can size the
 * iframe to fit its content with no scrollbars.
 */
export function ResizeReporter() {
  useEffect(() => {
    if (window.parent === window) return;
    const post = () =>
      window.parent.postMessage({ type: "uk-surf-forecast:resize", height: document.documentElement.scrollHeight, href: location.pathname }, "*");
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    post();
    return () => observer.disconnect();
  }, []);
  return null;
}
