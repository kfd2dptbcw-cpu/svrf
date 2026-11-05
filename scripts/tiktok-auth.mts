/**
 * One-off helper to authorise the SVRF TikTok account with the app and get the
 * refresh token for the TIKTOK_REFRESH_TOKEN GitHub secret.
 *
 *   TIKTOK_CLIENT_KEY=... npm run tiktok:auth
 *       prints the authorisation link to open while logged in to the SVRF TikTok account
 *   TIKTOK_CLIENT_KEY=... TIKTOK_CLIENT_SECRET=... npm run tiktok:auth -- --code="<code from the address bar>"
 *       exchanges the code for tokens and prints the refresh token
 *
 * The redirect page doesn't need to exist: after you approve, TikTok sends the
 * browser to TIKTOK_REDIRECT_URI with ?code=... in the address bar. Copy that
 * code (it works once and expires in minutes). The client secret and the
 * tokens are only ever printed to your own terminal; never paste them in chat.
 */
const DEFAULT_REDIRECT = "https://forecast.svrf.uk/tiktok-callback";

const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim() || DEFAULT_REDIRECT;
const codeArg = process.argv.slice(2).find((arg) => arg.startsWith("--code="));

if (!clientKey) {
  console.error("✖ Set TIKTOK_CLIENT_KEY (from the TikTok developer portal → your app → Basic information).");
  process.exit(1);
}

if (!codeArg) {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", "user.info.basic,video.publish");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", "svrf");
  console.log(`1. Log in to TikTok as the SVRF account, then open:\n\n${url}\n`);
  console.log(`2. Approve. The browser goes to ${redirectUri}?code=... (the page itself may show an error; that's fine).`);
  console.log('3. Copy the value after "code=" up to the next "&", then run:\n\n   npm run tiktok:auth -- --code="<that value>"\n');
  process.exit(0);
}

if (!clientSecret) {
  console.error("✖ Set TIKTOK_CLIENT_SECRET to exchange the code.");
  process.exit(1);
}

// TikTok URL-encodes the code (e.g. %2A); the token endpoint wants it decoded.
const code = decodeURIComponent(codeArg.slice("--code=".length).replace(/^"|"$/g, ""));
const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
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
  console.error("  The code works once and expires quickly: repeat step 1 and try again with a fresh code.");
  process.exit(1);
}
const days = json.refresh_expires_in ? Math.round(json.refresh_expires_in / 86400) : "?";
console.log(`✔ Authorised (scopes: ${json.scope ?? "?"}). The refresh token lasts about ${days} days and renews itself on each post.`);
console.log(`\nSet this as the TIKTOK_REFRESH_TOKEN secret in GitHub (nothing else, no quotes):\n\n${json.refresh_token}\n`);
