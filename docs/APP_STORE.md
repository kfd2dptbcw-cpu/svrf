# App Store submission pack: SVRF Forecast

Draft copy and answers for App Store Connect. Edit freely; nothing here is
wired into the build. Character limits are Apple's.

## Listing

**App name** (30): `SVRF Forecast`

**Subtitle** (30): `UK surf forecast and widget`

**Promotional text** (170, editable any time without review):
Daily surf forecasts for the UK's best breaks, with a home-screen widget and an evening-before alert when your spots are firing.

**Description** (4000):

Cold water. Real swell. A forecast built for it.

SVRF Forecast is a daily surf forecast for the UK's best surf spots, from Cornwall, Devon and Dorset to Wales, Yorkshire, Scotland and Northern Ireland. Every spot is rated one to five stars from the swell, wind and tide that actually suit that break, so you can see at a glance whether it is worth the drive.

What you get
- A clear daily rating for every spot, with wave height in feet, swell period and direction, and wind type and strength
- A home-screen widget showing today's conditions for the spot you choose, in small and medium sizes
- Surf alerts: a notification the evening before a day your favourite spots reach the rating you set
- A wetsuit picker that suggests what to wear for the day's water and air temperature
- A plain-English summary of each day, so you do not have to read charts
- Tide times, the best surf window, and which breaks suit beginners, intermediates and advanced surfers
- A 7-day outlook, a map of all spots, and favourites to keep your home breaks one tap away

No account, no ads, no tracking. Your favourites and alert settings stay on your phone.

Forecasts are generated from professional weather and ocean models and updated every day. They are a guide, not a guarantee: always check conditions on the beach and surf within your ability. Tide times are indicative and not for navigation.

Made by SVRF, a UK cold-water surf apparel brand.

**Keywords** (100, comma-separated, no spaces after commas):
`surf,surfing,swell,waves,tide,forecast,UK,Cornwall,Devon,wetsuit,surf report,widget`

**Support URL:** https://svrf.uk (use a page with a contact email, or `mailto` is not accepted; add a /support page if needed)

**Marketing URL:** https://forecast.svrf.uk

**Privacy policy URL:** https://forecast.svrf.uk/privacy

**Primary category:** Weather. **Secondary:** Sports.

**Age rating:** 4+ (no objectionable content, no unrestricted web browsing aimed at children).

**Copyright:** `2026 LYCreative Ltd`

## App Privacy ("nutrition label") answers

- Data collection: **Data Not Collected**. The app has no accounts or analytics, and favourites and alert settings are stored only on the device.
- Tracking: **No**.
- Third-party SDKs: none that collect data. Hosting logs (Netlify) are standard server logs for delivering the site.

Re-check these answers if analytics, accounts or push notifications are ever added.

## Review notes (paste into "Notes" for the reviewer)

No sign-in is needed. The app loads the SVRF forecast service (forecast.svrf.uk) and adds native features that the website does not have:

1. A WidgetKit home-screen widget (small and medium) with a spot picker.
2. Surf alerts: native local notifications, set up under Surf alerts at the bottom of any page in the app (the link appears only inside the app). Tap the heart on a spot to favourite it, turn alerts on, then allow notifications.
3. Offline fallback screen when there is no connection.

Forecast data comes from Vaisala Xweather; attribution is shown in the app footer.

## Before submitting

- [ ] Paid Apple Developer Program membership (organisation: LYCreative Ltd; needs a D-U-N-S number)
- [ ] App icon: 1024x1024 PNG, no transparency, no rounded corners (replace the default Capacitor icon in `ios/App/App/Assets.xcassets/AppIcon.appiconset`)
- [ ] Splash image replaced (`Splash.imageset`) with an SVRF one
- [ ] Screenshots: 6.9-inch iPhone set (and 6.5-inch if Apple still requires it), showing the forecast, a spot page, the widget on a home screen and Surf alerts
- [ ] Set the bundle ID to your final one and the version/build numbers in Xcode
- [ ] Trader status in App Store Connect (EU Digital Services Act): trader, with the company's contact details
- [ ] Widget shows real data (Xweather allowance resets 3 Nov 2026) so screenshots and review are not of an empty widget
- [ ] Archive, upload to TestFlight, test on a real device, then submit for review
