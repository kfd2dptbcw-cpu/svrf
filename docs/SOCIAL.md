# Daily social posts (Facebook and Instagram)

Every morning, straight after the forecast refresh, SVRF posts a "Best surf today" card to the SVRF Facebook Page and Instagram account. The card shows the top three spots, at most one per region, with size, stars, wind and best window. Posting starts on **3 November 2026**.

- **Image:** `/api/social-card` is a 1080×1350 portrait card (PNG; add `&format=jpeg` for Instagram, which only accepts JPEG). Add `?date=YYYY-MM-DD` for another day. You can open it in a browser any time, for example to post by hand or to use in a Story.
- **Captions:** Facebook gets a clickable link to `/today` with UTM tags. Instagram captions can't hold links, so they say "link in bio" and add hashtags. Both end with a question to get people commenting.
- **Schedule:** `.github/workflows/social-post.yml` runs when the "Scheduled forecast refresh" workflow succeeds (about 06:20 UTC). It only reads the forecast cache and never calls the data providers.
- **Safety:** it posts at most once a day per platform, remembering what it posted in Upstash, so a re-run only retries the platform that failed. It never posts an out-of-date forecast, and it skips days when every spot is flat. Tokens are never printed.

## One-time setup

You need admin access to the SVRF Facebook Page, and the SVRF Instagram account must be a **Professional** (Business or Creator) account **linked to that Page**. To link it, open Instagram → Settings → Account type and tools, or use Meta Business Suite → Settings → Instagram accounts.

1. **Register and create a Meta app.** On a computer (the site hides buttons on phones), go to [developers.facebook.com](https://developers.facebook.com). If there's no *Create app* button on *My Apps*, click *Get Started* first to register as a developer. Create an app named something like "SVRF Daily Post". Don't use "Facebook", "Instagram" or "Meta" in the name. Skip connecting a business portfolio.
2. **Add the use cases.** On *Add use cases*, filter by **Content management** and tick **Manage everything on your Page** and **Manage messaging & content on Instagram**. Ignore the Instagram "Configure your app / Create new configuration / Redirect URL" section; it's for apps other people log in to.
3. **Switch on the permissions.** Go to *Use cases* → **Customize** on each use case and click **Add** next to `pages_manage_posts`, `pages_read_engagement` (Page) and `instagram_basic`, `instagram_content_publish` (Instagram). The Graph API Explorer only lists permissions switched on here.
4. **Get a long-lived user token.** Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer/), select the app, and under *Add a Permission* tick all six:
   `business_management`, `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
   Click *Generate Access Token* and allow the SVRF Page and Instagram account. Then click the **ⓘ** by the token → *Open in Access Token Tool* → **Extend Access Token**, and paste the extended token back into the Explorer.
5. **Get the IDs and the Page token.** In the Explorer run `GET me/accounts`: the Page's `id` is **META_PAGE_ID** and its `access_token` is **META_PAGE_ACCESS_TOKEN** (it should show *Expires: Never* in the Access Token Debugger). Then run `GET {META_PAGE_ID}?fields=instagram_business_account`; the `id` inside is **INSTAGRAM_USER_ID**. If that field is missing, the Instagram account isn't linked to the Page or the token lacks the Instagram permissions.
6. **Add GitHub secrets.** In the repository, go to Settings → Secrets and variables → Actions and add:

   | Secret | Value |
   | --- | --- |
   | `META_PAGE_ID` | from step 5 |
   | `META_PAGE_ACCESS_TOKEN` | from step 5 |
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
- **`(#10) Application does not have permission` / `(#200)`**: a permission from step 2 is missing. Switch it on under Use cases (step 3) and generate the token again with all six.
- **`Only photo or video can be accepted as media type`** on Instagram: Meta couldn't download a JPEG from `FORECAST_SITE_URL`. Check that the site is deployed and that `/api/social-card?format=jpeg` opens in a browser.
- **The token stopped working:** a password change or removing the app revokes Page tokens. Repeat steps 4–5.
