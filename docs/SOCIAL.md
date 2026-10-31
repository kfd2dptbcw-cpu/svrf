# Daily social posts (Facebook and Instagram)

Every morning, straight after the forecast refresh, SVRF posts a "Best surf today" card to the SVRF Facebook Page and Instagram account. The card shows the top three spots, at most one per region, with size, stars, wind and best window. Posting starts on **3 November 2026**.

- **Image:** `/api/social-card` is a 1080×1350 portrait card (PNG; add `&format=jpeg` for Instagram, which only accepts JPEG). Add `?date=YYYY-MM-DD` for another day. You can open it in a browser any time, for example to post by hand or to use in a Story.
- **Captions:** Facebook gets a clickable link to `/today` with UTM tags. Instagram captions can't hold links, so they say "link in bio" and add hashtags. Both end with a question to get people commenting.
- **Schedule:** `.github/workflows/social-post.yml` runs when the "Scheduled forecast refresh" workflow succeeds (about 06:20 UTC). It only reads the forecast cache and never calls the data providers.
- **Safety:** it posts at most once a day per platform, remembering what it posted in Upstash, so a re-run only retries the platform that failed. It never posts an out-of-date forecast, and it skips days when every spot is flat. Tokens are never printed.

## One-time setup

You need admin access to the SVRF Facebook Page, and the SVRF Instagram account must be a **Professional** (Business or Creator) account **linked to that Page**. To link it, open Instagram → Settings → Account type and tools, or use Meta Business Suite → Settings → Instagram accounts.

1. **Create a Meta app.** Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → Create app → *Other* → *Business*. While the app is in Development mode it can post to Pages you administer, which is all this needs.
2. **Get a user token.** Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer/) and select your app. Add these permissions, then click *Generate Access Token*:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `business_management`, `instagram_basic`, `instagram_content_publish`
3. **Make it long-lived.** Paste the token into the [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) and click *Extend Access Token*. Copy the new token.
4. **Get the Page token and ID.** In the Explorer, using the long-lived token, run `GET me/accounts`. Find the SVRF Page and copy its `id` (this is **META_PAGE_ID**) and its `access_token` (this is **META_PAGE_ACCESS_TOKEN**). A Page token taken from a long-lived user token does not expire.
5. **Get the Instagram ID.** Run `GET {META_PAGE_ID}?fields=instagram_business_account` and copy the `id` inside it. This is **INSTAGRAM_USER_ID**.
6. **Add GitHub secrets.** In the repository, go to Settings → Secrets and variables → Actions and add:

   | Secret | Value |
   | --- | --- |
   | `META_PAGE_ID` | from step 4 |
   | `META_PAGE_ACCESS_TOKEN` | from step 4 |
   | `INSTAGRAM_USER_ID` | from step 5 (leave it out to post to Facebook only) |
   | `FORECAST_SITE_URL` | `https://forecast.svrf.uk` (may already be set) |
   | `SOCIAL_START_DATE` | optional, defaults to `2026-11-03` |

   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are already there for the refresh.
7. **Test it.** Go to Actions → *Daily social post* → *Run workflow*. Leave **Dry run** ticked. The log shows both captions and the image URL; open the URL to check the card. To send a real post before the start date, untick Dry run and tick Force.

The workflow must be on the default branch (`main`), because GitHub only runs scheduled and `workflow_run` workflows from there.

## Running it locally

```bash
npm run social:post -- --dry-run
```

This prints the captions and image URL from your local cache. Without `--dry-run` it posts for real, if the Meta variables are set in `.env.local`.

## Troubleshooting

- **"Social post skipped: no fresh forecast"**: the refresh didn't produce today's forecast (for example, the API allowance was used up). Nothing is posted rather than an old forecast.
- **`(#10) Application does not have permission` / `(#200)`**: a permission from step 2 is missing. Generate the token again with all six.
- **`Only photo or video can be accepted as media type`** on Instagram: Meta couldn't download a JPEG from `FORECAST_SITE_URL`. Check that the site is deployed and that `/api/social-card?format=jpeg` opens in a browser.
- **The token stopped working:** a password change or removing the app revokes Page tokens. Repeat steps 2–4.
