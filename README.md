# CardScanner — on-device visiting card scanner (POC)

Photographs a business card, extracts contact fields **fully on-device**
(OCR → LLM via [react-native-executorch](https://docs.swmansion.com/react-native-executorch/)),
and saves them through the native iOS "New Contact" form. Works offline after a
one-time ~0.5 GB model download. No cloud APIs.

## Stack
- Expo SDK 55 (custom dev build — Expo Go is NOT supported), New Architecture
- react-native-executorch 0.9.3 (pinned): `useOCR` (CRAFT+CRNN, en) + `useLLM` (Qwen 3 0.6B quantized)
- expo-camera / expo-image-picker / expo-contacts

## Run (physical iPhone required)
    npm install
    npx expo run:ios --device

First launch downloads models (~45 MB OCR + ~470 MB LLM) — use Wi-Fi.

The iPhone must be running iOS 17 or newer (deployment target forced by
react-native-executorch's podspec).

## Test
    npm test          # pure extraction logic (Jest, runs on the Mac)
    npx tsc --noEmit

## Notes
- Design spec: docs/superpowers/specs/2026-08-11-card-scanner-design.md
- Implementation plan: docs/superpowers/plans/2026-08-11-card-scanner.md
- Known constraint: release builds cannot target the iOS simulator (ExecuTorch).
- Xcode 26.4 / Apple Clang 21 breaks stock RN builds (upstream issue); this repo
  carries the workaround in `plugins/withFmtConstevalPatch.js` (FMT_USE_CONSTEVAL=0).
