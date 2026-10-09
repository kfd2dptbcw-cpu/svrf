/**
 * Rendered by a widget that has no forecast to show. Instead of an
 * "unavailable" message the widget collapses: the layout hides its frame
 * (globals.css), ResizeReporter posts height 0 and /embed.js marks the
 * placeholder with `data-surf-empty` so the host page can hide it too.
 */
export function EmbedEmpty() {
  return <div data-surf-empty="" hidden />;
}
