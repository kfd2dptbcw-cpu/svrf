/** Accent- and case-insensitive text normalisation for instant search ("Llŷn" → "llyn"). */
export function normaliseSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Score how well an entry matches a query: prefix matches on the name rank
 * highest, then word-prefix matches, then substring matches on name or region.
 * Returns 0 for no match.
 */
export function matchScore(query: string, name: string, region: string): number {
  const q = normaliseSearchText(query);
  if (!q) return 0;
  const n = normaliseSearchText(name);
  const r = normaliseSearchText(region);
  if (n.startsWith(q)) return 4;
  if (n.split(/[\s()-]+/).some((word) => word.startsWith(q))) return 3;
  if (n.includes(q)) return 2;
  if (r.includes(q)) return 1;
  return 0;
}
