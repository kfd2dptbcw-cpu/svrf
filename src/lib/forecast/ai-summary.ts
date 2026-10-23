import { z } from "zod";
import { env } from "@/lib/env";
import { degreesToCompass } from "@/lib/forecast/engine/angles";
import { formatSurfRange, formatTimeRange } from "@/lib/format";
import type { DayForecast, SpotForecast } from "@/types/forecast";

/**
 * AI-WRITTEN SUMMARIES
 * ====================
 * Runs inside the refresh job only (never on a page view). For each spot, one
 * request asks Claude to turn the forecast's own numbers into a short
 * plain-English paragraph per day. Everything here is best effort: with no API
 * key, a failed request, or output that fails validation, the day simply keeps
 * its rule-based `summary` and nothing breaks.
 *
 * The model is only given facts the forecast already computed, and the reply
 * is rejected if it contains a number that was not in those facts.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_SUMMARY_CHARS = 420;
const CONCURRENCY = 4;
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You write the short "in plain English" forecast text for a UK surf forecast site run by SVRF, a cold-water surf clothing brand.

Voice: deadpan, honest, practical. A mate who surfs telling you what the day is really like. No hype, no exclamation marks, no emoji, no clichés like "epic" or "firing" unless the data rating says Epic.

Rules:
- Use ONLY the facts supplied for each day. Never invent conditions, spots, numbers, times or tides.
- Wave sizes, temperatures, wind speeds and times must be copied exactly as given.
- 2 or 3 sentences, under 60 words. Say what the surf will be like, what is helping or hurting it, and who it suits (use the suitability facts).
- Do not give safety guarantees or tell anyone it is safe to go in.
- Reply with JSON only, in this shape: {"days":{"YYYY-MM-DD":"text", ...}} covering every date supplied.`;

const replySchema = z.object({ days: z.record(z.string(), z.string()) });

interface MessagesResponse {
  content?: { type: string; text?: string }[];
}

/** The facts the model is allowed to use for one day, as plain text. */
export function describeDayFacts(day: DayForecast): string {
  const lines: string[] = [
    `Date: ${day.date}`,
    `Surf: ${formatSurfRange(day.surfMinFt, day.surfMaxFt)}, rated ${day.label} (${day.rating} out of 5)`,
  ];
  if (day.primarySwell) {
    const swell = day.primarySwell;
    lines.push(`Swell: ${swell.heightM.toFixed(1)}m at ${Math.round(swell.periodS)}s from the ${degreesToCompass(swell.directionDeg)}`);
  }
  if (day.wind) {
    const gust = day.wind.gustKmh !== null ? `, gusting ${Math.round(day.wind.gustKmh)} km/h` : "";
    lines.push(`Wind: ${Math.round(day.wind.speedKmh)} km/h from the ${degreesToCompass(day.wind.directionDeg)}, ${day.wind.type}${gust}`);
  }
  if (day.bestWindow) {
    const tide = day.bestWindow.tidePhase ? ` around ${day.bestWindow.tidePhase} tide` : "";
    lines.push(`Best window: ${formatTimeRange(day.bestWindow.start, day.bestWindow.end)}${tide}`);
  } else {
    lines.push("Best window: none, conditions stay poor through daylight");
  }
  if (day.seaTempC !== null) lines.push(`Sea temperature: ${Math.round(day.seaTempC)}°C`);
  if (day.airTempMaxC !== null) lines.push(`Air temperature: up to ${Math.round(day.airTempMaxC)}°C`);
  for (const [level, fit] of Object.entries(day.suitability)) lines.push(`Suitability, ${level}: ${fit.level} (${fit.reason})`);
  lines.push(`Existing rule-based summary: ${day.summary.join(" ")}`);
  return lines.join("\n");
}

/** Numbers appearing in a piece of text, e.g. "3-4ft" -> ["3", "4"]. */
function numbersIn(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

/**
 * Accept a summary only if it is a sensible length and every number in it
 * appears in the facts it was written from. This catches invented figures.
 */
export function isGroundedSummary(summary: string, facts: string): boolean {
  const text = summary.trim();
  if (text.length < 20 || text.length > MAX_SUMMARY_CHARS) return false;
  const allowed = new Set(numbersIn(facts));
  if (!numbersIn(text).every((value) => allowed.has(value))) return false;
  // A number with a unit (3-4ft, 13°C, 12 km/h) must appear with that same unit
  // in the facts, so a real "20" from the wind cannot pass as 20ft of surf.
  const squashedFacts = squash(facts);
  return (text.match(MEASURE) ?? []).every((measure) => squashedFacts.includes(squash(measure)));
}

const MEASURE = /\d+(?:\.\d+)?(?:\s?[-–]\s?\d+(?:\.\d+)?)?\s?(?:ft|km\/h|°C|m|s)(?![a-z])/gi;

function squash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "").replace(/–/g, "-");
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

/** Ask the model for summaries for every day of one spot. Returns date -> text for the days that passed validation. */
export async function requestSpotSummaries(
  spotName: string,
  days: DayForecast[],
  options: { apiKey: string; model: string; fetchImpl?: typeof fetch },
): Promise<Record<string, string>> {
  const factsByDate = new Map(days.map((day) => [day.date, describeDayFacts(day)]));
  const prompt = `Spot: ${spotName}\n\n${days.map((day) => factsByDate.get(day.date)).join("\n\n")}`;

  const response = await (options.fetchImpl ?? fetch)(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Anthropic API ${response.status}`);

  const body = (await response.json()) as MessagesResponse;
  const text = body.content?.find((block) => block.type === "text")?.text ?? "";
  const parsed = replySchema.parse(extractJson(text));

  const accepted: Record<string, string> = {};
  for (const [date, summary] of Object.entries(parsed.days)) {
    const facts = factsByDate.get(date);
    if (facts && isGroundedSummary(summary, facts)) accepted[date] = summary.trim();
  }
  return accepted;
}

/**
 * Add `aiSummary` to the days of every forecast, mutating them in place.
 * Never throws: failures are returned as messages for the refresh log.
 */
export async function addAiSummaries(
  forecasts: Record<string, SpotForecast>,
  spotNames: Record<string, string>,
  options: { apiKey?: string | null; model?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ added: number; errors: string[] }> {
  const configuredKey = options.apiKey === undefined ? env.anthropicApiKey : options.apiKey;
  if (!configuredKey) return { added: 0, errors: [] };
  const apiKey: string = configuredKey;
  const model = options.model ?? env.aiSummaryModel;

  const queue = Object.entries(forecasts);
  const errors: string[] = [];
  let added = 0;

  async function worker() {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const [slug, forecast] = entry;
      try {
        const summaries = await requestSpotSummaries(spotNames[slug] ?? slug, forecast.days, { apiKey, model, fetchImpl: options.fetchImpl });
        for (const day of forecast.days) {
          const summary = summaries[day.date];
          if (summary) {
            day.aiSummary = summary;
            added++;
          }
        }
      } catch (error) {
        errors.push(`AI summary skipped for ${slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { added, errors };
}
