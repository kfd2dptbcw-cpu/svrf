/**
 * Validate config/regions.json and config/spots.json and regenerate the JSON
 * Schemas in config/schema/ (which give editors autocompletion and inline
 * validation). Run with: npm run config:validate
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ConfigError, parseConfig } from "../src/lib/config";
import { regionsFileSchema, spotsFileSchema } from "../src/lib/config/schema";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => JSON.parse(readFileSync(path.join(root, "config", file), "utf8")) as unknown;

try {
  const { regions, spots } = parseConfig(read("regions.json"), read("spots.json"));
  const schemaDir = path.join(root, "config", "schema");
  mkdirSync(schemaDir, { recursive: true });
  for (const [file, schema] of [
    ["regions.schema.json", regionsFileSchema],
    ["spots.schema.json", spotsFileSchema],
  ] as const) {
    const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
    writeFileSync(path.join(schemaDir, file), `${JSON.stringify(json, null, 2)}\n`);
  }
  console.log(`✔ Configuration valid: ${regions.length} regions, ${spots.length} enabled spots.`);
  for (const spot of spots) {
    console.log(`  ${spot.path.padEnd(42)} marine point ${spot.marinePoint.lat.toFixed(3)}, ${spot.marinePoint.lon.toFixed(3)}`);
  }
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
  throw error;
}
