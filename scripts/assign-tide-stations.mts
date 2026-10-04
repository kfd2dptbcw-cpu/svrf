/**
 * Assign the nearest ADMIRALTY tidal station to every spot in config/spots.json.
 *
 *   ADMIRALTY_API_KEY=... npm run tides:assign            # write tideStationId values
 *   ADMIRALTY_API_KEY=... npm run tides:assign -- --dry   # report only
 *
 * Reads the key from .env.local / .env too. Uses one request to the UK Tidal
 * API `/Stations` endpoint, then lists any spot whose station is more than
 * ~15 km away or possibly across a headland so it can be checked by hand.
 * Existing tideStationId values are replaced; re-run is safe.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spots } from "../src/lib/config";
import { nearestStation, parseStations } from "../src/lib/tide-stations";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // not present
  }
}

const dryRun = process.argv.includes("--dry");
const key = process.env.ADMIRALTY_API_KEY?.trim();
if (!key) {
  console.error("✖ ADMIRALTY_API_KEY is not set (get a free Discovery key at https://admiraltyapi.portal.azure-api.net/).");
  process.exit(1);
}

const response = await fetch("https://admiraltyapi.azure-api.net/uktidalapi/api/V1/Stations", {
  headers: { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) {
  console.error(`✖ /Stations responded ${response.status}: ${(await response.text()).slice(0, 300)}`);
  process.exit(1);
}
const stations = parseStations(await response.json());
if (stations.length === 0) {
  console.error("✖ /Stations returned no stations in a recognised format.");
  process.exit(1);
}
console.log(`Fetched ${stations.length} tidal stations.\n`);

const assignments = new Map<string, string>();
const flagged: string[] = [];
for (const spot of spots) {
  const match = nearestStation({ slug: spot.slug, ...spot.location, orientation: spot.orientation }, stations);
  if (!match) continue;
  assignments.set(spot.slug, match.station.id);
  const line = `${spot.name.padEnd(30)} → ${match.station.name} (${match.station.id})  ${match.distanceKm.toFixed(1)} km`;
  console.log(`${match.flags.length ? "⚠" : "✔"} ${line}${match.flags.length ? `  [${match.flags.join("; ")}]` : ""}`);
  if (match.flags.length) flagged.push(`${spot.name}: ${match.station.name} (${match.station.id}) — ${match.flags.join("; ")}`);
}

if (flagged.length) {
  console.log(`\nCheck these ${flagged.length} on a map before relying on their tide times:\n  - ${flagged.join("\n  - ")}`);
}

if (dryRun) {
  console.log("\n(dry run — config/spots.json not changed)");
  process.exit(0);
}

// Edit the raw JSON so comments-free formatting and field order are preserved.
const file = path.resolve(import.meta.dirname, "..", "config", "spots.json");
const raw = JSON.parse(readFileSync(file, "utf8")) as { spots: Record<string, unknown>[] };
for (const spot of raw.spots) {
  const id = assignments.get(spot.slug as string);
  if (id) spot.tideStationId = id;
}
writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);
console.log(`\n✔ Wrote tideStationId for ${assignments.size} spots. Next: npm run config:validate, set TIDE_PROVIDER=admiralty.`);
