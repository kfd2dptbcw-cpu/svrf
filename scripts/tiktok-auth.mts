/**
 * One-off helper to authorise the SVRF TikTok account with the app and get the
 * refresh token for the TIKTOK_REFRESH_TOKEN GitHub secret.
 *
 *   npm run tiktok:auth
 *
 * It asks for the Client key and secret (the secret is hidden as you paste),
 * prints the authorisation link, waits while you approve in the browser, then
 * asks for the address the browser lands on. Paste the WHOLE address (the page
 * itself can show a 404; that's fine): the script pulls the code out of it.
 * The code works once and lasts only minutes, so paste it straight away.
 *
 * Optional: set TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI
 * in the environment to skip those prompts. The secret and tokens are only ever
 * printed to your own terminal; never paste them in chat.
 */
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

const DEFAULT_REDIRECT = "https://forecast.svrf.uk/tiktok-callback";

let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
// Lines are queued by the iterator, so a multi-line paste can't be lost between prompts.
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string, { hidden = false } = {}): Promise<string> {
  process.stdout.write(question);
  muted = hidden;
  const next = await lines.next();
  muted = false;
  if (hidden) process.stdout.write("\n");
  if (next.done) {
    console.error("\n✖ Input ended before every question was answered.");
    process.exit(1);
  }
  return String(next.value).trim();
}

const fail = (message: string): never => {
  console.error(`✖ ${message}`);
  rl.close();
  process.exit(1);
};

const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim() || (await ask("Client key (from the TikTok developer portal): "));
if (!clientKey) fail("A Client key is required.");
const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim() || (await ask("Client secret (from the same portal page; hidden as you paste): ", { hidden: true }));
if (!clientSecret) fail("A Client secret is required.");
if (/[:/?&=%\s]/.test(clientSecret) || clientSecret.length > 100) {
  fail("That doesn't look like a Client secret (it has spaces, slashes, % & = or is very long: it looks like an address or code). Copy the Client secret from the developer portal, next to the Client key, and run this again.");
}

const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim() || DEFAULT_REDIRECT;

const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
url.searchParams.set("client_key", clientKey);
url.searchParams.set("scope", "user.info.basic,video.publish");
url.searchParams.set("response_type", "code");
url.searchParams.set("redirect_uri", redirectUri);
url.searchParams.set("state", "svrf");
console.log(`\n1. Log in to TikTok as the SVRF account, then open this link in a browser:\n\n${url}\n`);
console.log(`2. Approve. The browser goes to ${redirectUri}?code=... (a 404 page there is fine).`);
console.log("3. Copy the WHOLE address from the browser's address bar, come back here and paste it below.\n");


const pasted = await ask("Paste the full address you were sent to: ");
let code = pasted;
try {
  // A whole URL: URLSearchParams decodes %2A etc. for us and drops &scopes=...&state=...
  code = new URL(pasted).searchParams.get("code") ?? "";
} catch {
  // Not a URL: treat it as a bare code, tidying up a "code=" prefix or "&..." tail.
  code = decodeURIComponent(pasted.replace(/^code=/, "").split("&")[0] ?? "");
}
if (!code) fail("No code found in what you pasted. Paste the whole address, including ?code=...");
rl.close();

// Safe diagnostics: the key is not a secret; for the secret only its length and shape are shown.
console.log(
  `\nSending Client key "${clientKey}" (${clientKey.length} characters) and a Client secret of ${clientSecret.length} characters` +
    `${/\s/.test(clientSecret) ? " that CONTAINS WHITESPACE" : ""}${/[%&=]/.test(clientSecret) ? " that contains % & or = (looks like a code or URL, not a secret)" : ""}.`,
);

const tokenRequest = (init: RequestInit) =>
  fetch("https://open.tiktokapis.com/v2/oauth/token/", init).catch((error: unknown) =>
    fail(`Could not reach TikTok (${error instanceof Error ? error.message : String(error)}). Check your internet connection and try again.`),
  );

const response = await tokenRequest({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
  body: new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  }),
});
const json = (await response.json().catch(() => ({}))) as {
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};
if (!response.ok || !json.refresh_token) {
  console.error(`✖ TikTok said: ${json.error ?? response.status}: ${json.error_description ?? response.statusText}`);
  console.error("  The code works once and expires in minutes: run the command again and paste the address straight after approving.");
  process.exit(1);
}
const days = json.refresh_expires_in ? Math.round(json.refresh_expires_in / 86400) : "?";
console.log(`\n✔ Authorised (scopes: ${json.scope ?? "?"}). The refresh token lasts about ${days} days and renews itself on each post.`);
console.log(`\nSet this as the TIKTOK_REFRESH_TOKEN secret in GitHub (nothing else, no quotes):\n\n${json.refresh_token}\n`);
