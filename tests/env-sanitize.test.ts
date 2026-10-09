import { afterEach, describe, expect, it } from "vitest";
import { env, sanitizeEnvValue, sanitizeUpstashUrl } from "@/lib/env";

const TOKEN = "AXc9AAIncDE5ZGQ3NzBiYjEwZTk0ZjU2YmE4ZDc0NWQ5ZjNmYjY4YnAxMA";
const HOST = "https://smart-gnu-12345.upstash.io";

describe("sanitizeEnvValue (UPSTASH_REDIS_REST_TOKEN)", () => {
  const clean = (raw: string | undefined) => sanitizeEnvValue("UPSTASH_REDIS_REST_TOKEN", raw);

  it.each([
    ["plain", TOKEN],
    ["surrounding whitespace", `  ${TOKEN}  `],
    ["trailing newline", `${TOKEN}\n`],
    ["CRLF", `${TOKEN}\r\n`],
    ["tabs and newlines", `\t\n${TOKEN}\n\t`],
    ["double quotes", `"${TOKEN}"`],
    ["single quotes", `'${TOKEN}'`],
    ["quotes plus newline", `"${TOKEN}"\n`],
    ["NAME= prefix", `UPSTASH_REDIS_REST_TOKEN=${TOKEN}`],
    ["NAME= prefix with spaces", `UPSTASH_REDIS_REST_TOKEN = ${TOKEN}`],
    ["NAME=\"value\" from a .env file", `UPSTASH_REDIS_REST_TOKEN="${TOKEN}"\n`],
    ["\"NAME=value\" in quotes", `"UPSTASH_REDIS_REST_TOKEN=${TOKEN}"`],
    ["export NAME='value'", `export UPSTASH_REDIS_REST_TOKEN='${TOKEN}'`],
  ])("cleans %s", (_label, raw) => {
    expect(clean(raw)).toBe(TOKEN);
  });

  it("keeps '=' inside or at the end of the value", () => {
    expect(clean(`${TOKEN}==`)).toBe(`${TOKEN}==`);
    expect(clean(`UPSTASH_REDIS_REST_TOKEN=${TOKEN}=`)).toBe(`${TOKEN}=`);
  });

  it("only strips its own variable name", () => {
    expect(clean(`OTHER_NAME=${TOKEN}`)).toBe(`OTHER_NAME=${TOKEN}`);
  });

  it("leaves unmatched quotes alone", () => {
    expect(clean(`"${TOKEN}'`)).toBe(`"${TOKEN}'`);
  });

  it("returns null for missing or blank values", () => {
    expect(clean(undefined)).toBeNull();
    expect(clean("")).toBeNull();
    expect(clean("  \n")).toBeNull();
    expect(clean('""')).toBeNull();
    expect(clean("UPSTASH_REDIS_REST_TOKEN=")).toBeNull();
  });
});

describe("sanitizeUpstashUrl", () => {
  it.each([
    ["plain", HOST],
    ["trailing slash", `${HOST}/`],
    ["several trailing slashes", `${HOST}///`],
    ["a path", `${HOST}/get/test`],
    ["a query", `${HOST}/get/test?_token=${TOKEN}`],
    ["whitespace and newline", `  ${HOST}/\n`],
    ["double quotes", `"${HOST}"`],
    ["single quotes", `'${HOST}/'`],
    ["NAME= prefix", `UPSTASH_REDIS_REST_URL=${HOST}`],
    ["NAME=\"value\" with path", `UPSTASH_REDIS_REST_URL="${HOST}/get/x"\n`],
    ["no scheme", "smart-gnu-12345.upstash.io"],
    ["http scheme", "http://smart-gnu-12345.upstash.io/"],
  ])("reduces %s to https://host", (_label, raw) => {
    expect(sanitizeUpstashUrl(raw)).toBe(HOST);
  });

  it("returns null for missing or unusable values", () => {
    expect(sanitizeUpstashUrl(undefined)).toBeNull();
    expect(sanitizeUpstashUrl("  ")).toBeNull();
    expect(sanitizeUpstashUrl("https://")).toBeNull();
  });
});

describe("env.upstashUrl / env.upstashToken", () => {
  const saved = { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  afterEach(() => {
    for (const [key, value] of [
      ["UPSTASH_REDIS_REST_URL", saved.url],
      ["UPSTASH_REDIS_REST_TOKEN", saved.token],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("returns the sanitised values", () => {
    process.env.UPSTASH_REDIS_REST_URL = `"${HOST}/"\n`;
    process.env.UPSTASH_REDIS_REST_TOKEN = `UPSTASH_REDIS_REST_TOKEN="${TOKEN}"\n`;
    expect(env.upstashUrl).toBe(HOST);
    expect(env.upstashToken).toBe(TOKEN);
  });
});
