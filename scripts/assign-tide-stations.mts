/**
 * Assign the nearest ADMIRALTY tidal station to spots in config/spots.json.
 *
 *   npm run tides:assign              # match spots WITHOUT a tideStationId, using config/tide-stations.json
 *   npm run tides:assign -- --all     # re-match every spot (overwrites hand-reviewed choices)
 *   npm run tides:assign -- --dry     # report only, don't write
 *   npm run tides:assign -- --api     # refresh config/tide-stations.json from the API first
 *                                       (needs ADMIRALTY_API_KEY in the environment or .env.local)
 *
 * The match is the nearest station by distance. Spots more than ~15 km from
 * their station, or whose station lies behind the beach (possibly across a
 * headland, estuary or bay), are listed for a human to check on a map — the
 * nearest station is not always on the same stretch of coast.
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

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry");
const root = path.resolve(import.meta.dirname, "..");
const stationsFile = path.join(root, "config", "tide-stations.json");

if (args.has("--api")) {
  const key = process.env.ADMIRALTY_API_KEY?.trim();
  if (!key) {
    console.error("✖ --api needs ADMIRALTY_API_KEY (free Discovery key: https://admiraltyapi.portal.azure-api.net/).");
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
  const body = await response.json();
  if (parseStations(body).length === 0) {
    console.error("✖ /Stations returned no stations in a recognised format.");
    process.exit(1);
  }
  // The response contains only station metadata — never the key.
  if (!dryRun) writeFileSync(stationsFile, `${JSON.stringify(body)}\n`);
  console.log(`Fetched the station list from the API${dryRun ? "" : " and saved config/tide-stations.json"}.`);
}

const stations = parseStations(JSON.parse(readFileSync(stationsFile, "utf8")));
if (stations.length === 0) {
  console.error("✖ config/tide-stations.json has no stations in a recognised format.");
  process.exit(1);
}
console.log(`${stations.length} tidal stations loaded.\n`);

const assignments = new Map<string, string>();
const flagged: string[] = [];
const all = args.has("--all");
for (const spot of spots) {
  if (spot.tideStationId && !all) continue;
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
if (assignments.size === 0) {
  console.log("Every spot already has a tideStationId (use --all to re-match).");
  process.exit(0);
}
const file = path.join(root, "config", "spots.json");
const raw = JSON.parse(readFileSync(file, "utf8")) as { spots: Record<string, unknown>[] };
for (const spot of raw.spots) {
  const id = assignments.get(spot.slug as string);
  if (id) spot.tideStationId = id;
}
writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);
console.log(`\n✔ Wrote tideStationId for ${assignments.size} spot(s). Next: npm run config:validate.`);
