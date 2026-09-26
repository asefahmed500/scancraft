# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# ScanCraft — Agent Context

Native document-scanner app (CamScanner alternative). React Native + Expo SDK 57, TypeScript strict.

## Commands

```sh
npm run typecheck        # tsc --noEmit — MUST pass
npx expo lint            # eslint — MUST pass (0 problems)
npx expo export --platform ios --output-dir .export-test   # bundle smoke test
npx expo start           # dev server (Expo Go on device)
eas build -p android --profile preview --non-interactive --no-wait   # APK (needs EXPO_TOKEN)
```

- EAS project: `5adbe72f-0d98-411c-992b-872a14c80e5a`, owner `asefahmed`, slug `scancraft`
- Android package: `com.scancraft.app` (older dev builds used `com.anonymous.scancraft`)
- `eas.json`: `preview` → installable APK; `production` → store AAB

## Architecture

```
src/
  app/            expo-router screens (stack, no headers — custom ScreenHeader)
    _layout.tsx   fonts (Geist 600/500 + Inter 400/500) → GestureHandlerRootView
                  → SafeAreaProvider → SessionProvider → ImageRasterizerProvider → Stack
    index.tsx     Library: grid, search, sort, long-press multi-select (batch PDF/delete);
                  gates on settings.onboarded → redirects to /onboarding on first launch
    onboarding.tsx  logo reveal (LogoReveal ~2s) → 3 slides (vector-tile icons) →
                  sets settings.onboarded=true → '/'
    capture.tsx   CameraView + Fast-capture burst mode (skips review) + flash/haptics
    review.tsx    4-corner crop — bbox model (u0/u1/v0/v1 shared values), rotate, re-crop
    filter.tsx    5 Skia color-matrix presets + brightness/contrast/saturation sliders
    pages.tsx     multi-page manager (reorder/rotate/re-crop/delete)
    export.tsx    name/format(PDF|JPG|PNG)/quality → rasterize → persist → share/Photos
    files.tsx     storage browser (per-doc files, sizes, recycle bin)
    settings.tsx  defaults (facing/format/quality/fastCapture), storage meter, wipe
    document/[id]  saved-doc paged viewer, re-export, delete
    gallery hook-up: first page confirm routes capture → /filter (not /pages)
  lib/
    theme.ts      ALL design tokens (colors/spacing/radius/fonts/type) — type tokens
                  carry fontFamily + default color; never hardcode inline styles
    session.tsx   capture-session context (pages, filterId, adjustments)
    storage.ts    expo-file-system (new File/Directory/Paths API): documents/<id>/
                  page-N.jpg + thumb-N.jpg, index.json (atomic tmp→swap + .bak
                  fallback), settings.json. safeDeleteCacheFile = only deletes
                  under cache dirs.
    filters.ts    4x5 color-matrix math (multiply/brightness/contrast/saturation)
    imaging.ts    cropRotate / makeThumb / downscaleIfNeeded (pre-skia OOM guard,
                  EDIT_MAX_DIM=3024) / applyLook / buildPdf (pdf-lib — NOT expo-print)
    rasterizer.tsx  CRITICAL: exports rasterize via hidden declarative <Canvas>
                  + makeImageFromView. Do NOT use Skia Surface.MakeOffscreen —
                  it renders BLACK frames on devices. applyLook delegates here.
```

## Hard-won rules (do not regress)

1. **Never render exports with imperative Skia surfaces** — black-frame bug. Only
   the declarative `<Canvas>` path (see rasterizer.tsx).
2. **PDF via pdf-lib embedding JPEG bytes** — expo-print HTML/data-URI pipeline
   produced black/unrendered pages.
3. **Downscale before crop/rotate** — full 12MP passes crash low-memory devices.
4. **Camera must unmount when screen unfocused** (`isFocused` gate in capture).
5. **Session page files may be in generic OS cache** — only delete via
   `safeDeleteCacheFile`; never delete documents/ files outside delete APIs.
6. **persistDocument deletes its source files** — reset the session when export
   succeeds, or hardware-back leaves dead URIs.
7. **index.json writes are atomic** (tmp → backup → swap); loadIndex falls back
   to .bak and shape-validates entries.
8. React Compiler is ON (`reactCompiler: true`): no setState directly in effects
   (react-hooks/set-state-in-effect), no ref access during render. Exceptions:
   `react-hooks/immutability` disabled in review/onboarding/logo-reveal (Reanimated).
9. Async handlers: busyRef (sync) + mountedRef guards; disable buttons while busy.
10. First captured page confirm routes to /filter; later pages return to capture.

## Design tokens (theme.ts)

- bg `#FAFAF8`, surface `#FFFFFF`, border `#EDEBE6`, inset `#F3F1EC`
- text `#141414`, secondary `#6B6B68`, tertiary `#9C9A94`
- accent = `#141414` (black & white theme — NO blue)
- radius 4/8/12 (sharp), full only for circular controls; spacing base 8, screens pad 16
- Fonts: Geist_600SemiBold (headings), Inter_400Regular/Inter_500Medium (body/labels)
- One primary action per screen; primary button = gray→white gradient
  (`expo-linear-gradient` ['#FFFFFF','#E9E7E2'], black text, hairline border)
- **ALL buttons** use GradientButton (components/gradient-button.tsx) — primary
  gets flex:1 via style, secondary gets ghostBtn (paddingHorizontal: 8)
- LogoReveal (components/logo-reveal.tsx): animated brand wordmark + scan line;
  static variant used as the Library first-paint gate while settings load

## Key dependencies

expo-camera, expo-image, expo-image-manipulator (new ctx API: manipulate →
renderAsync → saveAsync, `compress` NOT `quality`), @shopify/react-native-skia
(`encodeToBytes` quality is 0–100, NOT 0–1), pdf-lib, expo-print (legacy, unused),
expo-media-library (`Asset.create`, write-only perms), expo-sharing, expo-file-system,
expo-haptics, expo-blur, expo-linear-gradient, @react-native-community/slider,
@expo-google-fonts/geist + inter.

## Android toolchain (this machine)

- JDK 17: `D:\Android\jdk\jdk-17.0.20.1+1`
- Android SDK: `D:\Android\android-sdk` (platform-36, build-tools 36.0.0; NDK
  27.1.12297006 + cmake 3.22.1 may still be incomplete — network kept resetting;
  local `gradlew assembleRelease` blocked on it. Use EAS builds meanwhile.)
- Signing: `android/app/scancraft-release.keystore` (credentials kept locally —
  NOT committed; ask the owner or check the local keystore notes) wired into
  android/app/build.gradle release buildType.
- `android/` is CNG from `npx expo prebuild --platform android --no-install`.
