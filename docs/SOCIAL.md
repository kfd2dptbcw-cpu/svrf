# Daily social posts (Facebook and Instagram)

Every morning, straight after the forecast refresh, SVRF posts a "Best surf today" card to the SVRF Facebook Page, Instagram account and (optionally) TikTok. The card shows the top three spots, at most one per region, with size, stars, wind and best window. Posting starts on **3 November 2026**.

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

## TikTok (optional)

TikTok posts the same card as a photo post through the Content Posting API (Direct Post). It is skipped unless the three TikTok secrets are set, has its own "already posted today" record, and a TikTok failure is only a warning in the Actions log (the run stays green) and never stops Facebook or Instagram.

**Status (5 Nov 2026): parked.** The sandbox app, authorisation and token refresh all work, but TikTok refuses Direct Post from an unaudited app unless the TikTok *account* is private (`unaudited_client_can_only_post_to_private_accounts`), and TikTok's audit rules for Direct Post expect a screen where a person previews, picks privacy and consents before each post, which this unattended job doesn't have. Options when picking it up again: test with a private throwaway account added as a sandbox target user; or switch to the Upload (draft-to-inbox) mode, which may not need the audit (unconfirmed).

**Until TikTok approves the app, every post is private ("only me")** (`TIKTOK_PRIVACY_LEVEL` defaults to `SELF_ONLY`). After approval, add the secret `TIKTOK_PRIVACY_LEVEL` = `PUBLIC_TO_EVERYONE`.

1. **Developer app** at developers.tiktok.com: add **Login Kit** and **Content Posting API** (Direct Post, scope `video.publish`), set the redirect URI to `https://forecast.svrf.uk/tiktok-callback`, add the SVRF account as a target user, and verify the `svrf.uk` domain (DNS TXT at `@`; this also covers `forecast.svrf.uk`). TikTok only pulls images from a verified domain.
2. **Authorise once**, from a checkout of this repo with Node installed:
   ```bash
   TIKTOK_CLIENT_KEY=... npm run tiktok:auth                      # prints the link to open
   TIKTOK_CLIENT_KEY=... TIKTOK_CLIENT_SECRET=... npm run tiktok:auth -- --code="..."
   ```
   Open the link while logged in to the SVRF TikTok account, approve, then copy the `code=` value from the address bar (the page itself can show an error). The second command prints the refresh token. Never paste the secret or tokens into chat or commit them.
3. **GitHub secrets:** `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`.
4. **Test:** run *Daily social post* with Dry run unticked and Force unticked (Facebook and Instagram are skipped if already posted today).

Access tokens last about a day; the script refreshes one on every run and keeps any rotated refresh token in Upstash, so the secret only seeds it. Re-run step 2 and update `TIKTOK_REFRESH_TOKEN` if the account is deauthorised or the token lapses (about a year).

## Running it locally

```bash
npm run social:post -- --dry-run
```

This prints the captions and image URL from your local cache. Without `--dry-run` it posts for real, if the Meta variables are set in `.env.local`.

## Troubleshooting

- **"Social post skipped: no fresh forecast"**: the refresh didn't produce today's forecast (for example, the API allowance was used up). Nothing is posted rather than an old forecast.
- **`(#10) Application does not have permission` / `(#200)`**: a permission from step 2 is missing. Switch it on under Use cases (step 3) and generate the token again with all six.
- **`Only photo or video can be accepted as media type`** on Instagram: Meta couldn't download a JPEG from `FORECAST_SITE_URL`. Check that the site is deployed and that `/api/social-card?format=jpeg` opens in a browser.
- **TikTok `url_ownership_unverified`:** the domain is not verified for the app (step 1). **`unaudited_client_can_only_post_to_private_accounts`:** keep `TIKTOK_PRIVACY_LEVEL` unset or `SELF_ONLY` until the app is approved.
- **The token stopped working:** a password change or removing the app revokes Page tokens. Repeat steps 4–5.
