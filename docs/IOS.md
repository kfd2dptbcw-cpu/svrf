# iOS app and widget

The iOS app is a Capacitor shell that loads the live site
(`https://forecast.svrf.uk`, set in `capacitor.config.ts`), so web deploys
update the app without an App Store release. The home-screen widget is native
SwiftUI in `ios/SVRFWidget/` and reads `GET /api/forecast`.

## First-time setup on a Mac

Needs Xcode (App Store) and Node 22.

```
git clone https://github.com/kfd2dptbcw-cpu/svrf.git && cd svrf
git checkout ios-app
npm install
npx cap sync ios      # generates the git-ignored config.xml, capacitor.config.json and public/
npx cap open ios
```

`npx cap sync ios` is required on every fresh clone; without it Xcode fails
with "capacitor.config.json / config.xml / public couldn't be opened".

Signing: in Xcode, App target, Signing & Capabilities, choose your Team. The
first run on a phone needs Developer Mode on and the developer profile trusted
under Settings, General, VPN & Device Management.

## Adding the widget target (one-off, in Xcode)

1. File, New, Target, iOS, Widget Extension. Product name `SVRFWidget`.
   Untick "Include Live Activity", "Include Control" and "Include Configuration
   App Intent". Activate the scheme if asked.
2. Delete the Swift files Xcode generated inside the new `SVRFWidget` group
   (move to Trash).
3. Drag the three files from `ios/SVRFWidget/` (`ForecastAPI.swift`,
   `SpotIntent.swift`, `SVRFWidget.swift`) into the `SVRFWidget` group, with
   target membership ticked for `SVRFWidget` only.
4. Set the widget target's iOS Deployment Target to 17.0 or later.
5. Signing & Capabilities for the widget target: same Team as the app.
6. Run the `App` scheme on the device, then long-press the home screen,
   tap +, search SVRF. Long-press the widget, Edit Widget, to pick the spot.

The default spot is `fistral` (`defaultSpotSlug` in `SpotIntent.swift`); it must
match a slug in `config/spots.json`.
