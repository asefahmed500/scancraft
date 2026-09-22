# ScanCraft

A native document scanner app built with [Expo](https://expo.dev) and React Native — a clean,
off-white CamScanner-style flow with Geist + Inter typography.

## Features

- **Library** — grid of saved documents with page-count badges, timestamps, pull-to-refresh
- **Capture** — live camera (back/front, flash modes) with document guide frame, plus picking an
  existing photo from the library
- **Review & crop** — draggable four-corner crop with grid overlay and 90° rotation
- **Filter & enhance** — live Skia-powered previews: Original, Grayscale, B&W, Color, Magic Color,
  plus brightness / contrast / saturation sliders
- **Multi-page sessions** — reorder, rotate, re-crop, or delete pages before export
- **Export** — PDF (via `expo-print`) or JPG/PNG saved to your photo library, with share-sheet
  integration; quality presets control resolution and compression
- **Settings** — default camera, default export format/quality, storage usage, clear cache,
  delete all documents

All scans stay on-device: documents live under the app's document directory with an `index.json`
library index; nothing is uploaded.

## Stack

- Expo SDK 57, React Native 0.86, TypeScript, expo-router (file-based navigation)
- `expo-camera` capture, `expo-image-manipulator` crop/rotate, `@shopify/react-native-skia`
  color-matrix filters, `expo-print` PDF, `expo-media-library` + `expo-sharing` export,
  `expo-file-system` persistence
- `react-native-reanimated` + `react-native-gesture-handler` for the crop interaction

## Run

```sh
npm install
npx expo start
```

Press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with Expo Go.

## Verify

```sh
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Jest — filters math + storage integrity
```

## Build & deploy

See [BUILD.md](./BUILD.md) for the full EAS cloud build walkthrough (APK + store AAB)
and the local Gradle alternative.
