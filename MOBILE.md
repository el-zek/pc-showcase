# Bizz Automators — Web + Android + iOS

One codebase, one backend (Lovable Cloud / Supabase), one database.
The web app is unchanged; Capacitor 8 wraps the **same deployed app**.

## Facts of this implementation

| Item | Value |
| --- | --- |
| App name (all platforms) | `Bizz Automators` |
| Production web URL | https://buzz-gallery-hub.lovable.app |
| `CAP_SERVER_URL` (default in `capacitor.config.ts`) | `https://buzz-gallery-hub.lovable.app` |
| Android application ID | `com.bizzautomators.app` |
| iOS bundle identifier | `com.bizzautomators.app` |
| versionName / versionCode | `1.0.0` / `1` (`android/app/build.gradle`) |
| MARKETING_VERSION / CURRENT_PROJECT_VERSION | `1.0` / `1` (Xcode) |
| min / target / compile SDK | 24 / 36 / 36 |
| Native projects | `android/` and `ios/` exist in the repo |
| Permissions | `INTERNET` only |

### Why `server.url`
The app is server-rendered (TanStack Start on the edge), so there is no static
`dist/` to embed. `capacitor.config.ts` points the native webview at the
production HTTPS URL. `mobile-shell/index.html` is only the local fallback
shell. Navigation outside the allow-listed hosts opens in the system browser.

Override the URL for a staging build:
```bash
export CAP_SERVER_URL=https://project--c1583629-42a8-41d7-81b9-87fbacf94a59.lovable.app
```

## What is configured in the native projects

Android (`android/`):
- `applicationId` / namespace `com.bizzautomators.app`, label `Bizz Automators`
- launcher + adaptive icons and splash screens generated from `resources/`
- `INTERNET` permission only; no cleartext traffic
- `windowSoftInputMode="adjustResize"` for keyboard behaviour
- App Links intent-filter (`https://buzz-gallery-hub.lovable.app`, `autoVerify`)
  plus custom scheme `com.bizzautomators.app://`
- release build type: R8 `minifyEnabled` + `shrinkResources` with Capacitor
  keep-rules in `android/app/proguard-rules.pro`
- signing config reads `android/key.properties` (git-ignored; template at
  `android/key.properties.example`). No secrets are committed.

iOS (`ios/`):
- bundle id `com.bizzautomators.app`, `CFBundleDisplayName = Bizz Automators`
- app icons + launch screen generated from `resources/`
- `ITSAppUsesNonExemptEncryption = false` (skips export-compliance prompts)
- `CFBundleURLTypes` custom scheme `com.bizzautomators.app`
- status bar / safe-area / keyboard handled by Capacitor plugins

Runtime (`src/lib/native.ts`, no-op on web):
status bar style, splash hide, Android hardware back (closes dialogs first,
then history, then exits), deep-link routing, external links via system
browser, keyboard open/close class used by the fixed bottom nav.

## Commands (run locally; Android SDK / Xcode are not available in Lovable)

```bash
bun install

# sync config + plugins into the native projects after any change
bun run cap:sync

# run on device/emulator
bun run android:run
bun run ios:open        # then Run in Xcode

# release builds (Play Store)
bun run android:build:aab   # android/app/build/outputs/bundle/release/app-release.aab
bun run android:build:apk   # android/app/build/outputs/apk/release/

# regenerate icons/splash from resources/
bun run cap:assets
```

## Android signing (only remaining Android blocker)

```bash
keytool -genkey -v -keystore bizz-release.keystore -alias bizz \
  -keyalg RSA -keysize 2048 -validity 10000
cp android/key.properties.example android/key.properties   # fill in values
```
Then `bun run android:build:aab` produces a signed AAB.

## Remaining external actions (cannot be done inside Lovable)

1. Generate the release keystore and fill `android/key.properties`.
2. Build the AAB locally (`bun run android:build:aab`) — needs Android SDK.
3. Google Play Console: developer account, app listing, screenshots, privacy
   policy URL, data-safety form, upload AAB to internal testing.
4. Apple: Developer account, App ID `com.bizzautomators.app`, signing/profiles
   in Xcode, Archive → Distribute, App Store Connect record, screenshots,
   privacy details, TestFlight.
5. Optional App Links verification: host
   `/.well-known/assetlinks.json` on `buzz-gallery-hub.lovable.app` with the
   release keystore SHA-256 fingerprint (and `apple-app-site-association` plus
   the Associated Domains entitlement for iOS universal links).
