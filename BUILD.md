# Building ScanCraft

Two ways to produce an installable build: **EAS cloud build** (recommended — no local
Android toolchain required) or a **local Gradle build**.

---

## 1. EAS cloud build (recommended)

The build runs on Expo's servers. Your machine only uploads the project and downloads
the finished APK link.

### One-time setup

```sh
npm install --global eas-cli     # or use `npx eas-cli@latest` per command
eas login                        # Expo account (free at https://expo.dev/signup)
```

Alternatively, authenticate non-interactively with an access token
(https://expo.dev/settings/access-tokens):

```sh
# PowerShell
$env:EXPO_TOKEN = "<your token>"
```

The project is already linked:

- Project ID: `5adbe72f-0d98-411c-992b-872a14c80e5a`
- Owner: `asefahmed`, slug: `scancraft`
- Android package: `com.scancraft.app`

(If it ever needs re-linking: `eas init --id 5adbe72f-0d98-411c-992b-872a14c80e5a`.)

### Build an installable APK

```sh
eas build -p android --profile preview --non-interactive --no-wait
```

- `--profile preview` → **APK** you can sideload onto any Android phone
  (defined in `eas.json`; signing is handled by the local keystore config in
  `android/app/build.gradle`)
- `--no-wait` → prints the build-page URL immediately and returns

Output looks like:

```
See logs: https://expo.dev/accounts/asefahmed/projects/scancraft/builds/<build-id>
```

### Build a store AAB (Google Play)

```sh
eas build -p android --profile production --non-interactive --no-wait
```

### Watch progress / get the APK link

Open the build page URL, or poll from the CLI:

```sh
eas build:view <build-id> --json                       # status + artifact URL
eas build:list --platform android --limit 5 --json     # recent builds
```

When the status is `FINISHED`, the download link looks like:

```
https://expo.dev/artifacts/eas/<id>.apk
```

Typical duration: 5–15 minutes (plus queue time during busy periods).

### Housekeeping

```sh
eas build:cancel <build-id>    # cancel a queued/running build
eas build:delete <build-id>    # remove an old build (and its artifact link)
```

### Troubleshooting

- **`An Expo user account is required`** — you are not logged in. Run `eas login`
  or set `EXPO_TOKEN`.
- **Build stuck `IN_QUEUE`** — shared-queue congestion; it will start on its own.
  Cancelling and re-queuing usually lands a newer spot.
- **GraphQL `ECONNRESET` when submitting** — network hiccup during upload; just rerun
  the build command (fingerprinting is cached).

---

## 2. Local Gradle build (offline alternative)

Requires JDK 17 + Android SDK (platform-36, build-tools 36.0.0, NDK 27.1.12297006,
CMake 3.22.1) and licenses accepted.

```sh
npx expo prebuild --platform android --no-install   # regenerate android/ (CNG)
cd android
set JAVA_HOME=D:\Android\jdk\jdk-17.0.20.1+1        # Windows example
set ANDROID_HOME=D:\Android\android-sdk
gradlew.bat assembleRelease
```

APK lands at:

```
android\app\build\outputs\apk\release\app-release.apk
```

Release signing: EAS manages Android credentials automatically
(`android/` is generated and not committed — never commit keystores).

---

## Verify before shipping

```sh
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint — 0 problems
npm test            # jest — filters math + storage integrity suite
```
