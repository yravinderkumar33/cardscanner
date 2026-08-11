# Visiting Card Scanner — Design Spec

**Date**: 2026-08-11
**Status**: Approved design, pending implementation plan
**Target**: iOS POC (physical iPhone), React Native ExecuTorch

## 1. Overview

A proof-of-concept iPhone app that scans a visiting (business) card with the camera,
extracts contact fields fully on-device (OCR → small LLM), lets the user review and
correct the fields, and saves them via the native iOS "New Contact" form. No cloud
APIs; after the one-time model download the app works fully offline.

**Purpose**: showcase on-device AI with `react-native-executorch` end-to-end
(computer vision + LLM chained in one real flow).

## 2. Goals and non-goals

**Goals**
- Capture a card photo (in-app camera) or pick one from the photo library.
- OCR the image and structure the text into contact fields with an on-device LLM.
- Editable review screen; save through the native prefilled "New Contact" form.
- Recoverable errors at every step; never a dead-end screen.
- Works offline after first-launch model download.

**Non-goals (YAGNI)**
- No scan history or local database — one-shot flow; the Contacts app is the record.
- No Android support in this POC (library supports it; we don't test it).
- No live/continuous scanning (single photo capture only).
- No multi-language OCR — English only (`language: 'en'`).
- No duplicate-contact detection.

## 3. User flow

1. **First launch**: models download (~45 MB OCR + ~470 MB LLM) with per-model
   progress bars. Cached in the app's documents directory thereafter.
2. **Capture**: camera view with shutter button; gallery button as alternative.
3. **Processing**: OCR reads the card (~1 s), then the LLM structures the text
   (streamed tokens shown as an "AI is reading the card…" effect).
4. **Review**: extracted fields in editable inputs. Buttons: *Add to Contacts*, *Rescan*.
5. **Save**: contacts permission → native iOS New Contact form, prefilled → user
   taps Save in the native UI → "Scan another card" state.

## 4. Stack and pinned versions

| Piece | Choice | Why |
|---|---|---|
| Framework | Expo SDK 55, TypeScript, New Architecture | react-native-executorch 0.9.x supports Expo SDK 54–55 / RN 0.81–0.85 only (NOT current SDK 57) |
| Build | Custom dev client, `npx expo run:ios` | Expo Go is not supported by the library |
| AI library | `react-native-executorch@0.9.3` (pinned **exact**) | Model URLs behind library constants have 404'd in other releases (#1326, #680) |
| Resource fetcher | `react-native-executorch-expo-resource-fetcher` + `expo-file-system` + `expo-asset` | Mandatory since 0.8.x; `initExecutorch({ resourceFetcher: ExpoResourceFetcher })` at app entry before any other library API |
| OCR model | `models.ocr.craft({ language: 'en' })` (CRAFT detector + CRNN recognizer) | ~45 MB download, ~0.6 s/image on recent iPhones |
| LLM | `models.llm.qwen3_0_6b()` (quantized default, 0.47 GB) | ~27 tok/s on modern iPhone; runs even on 4 GB iPhone SE 3; supports `/no_think` |
| Camera | `expo-camera` (`CameraView`, `takePictureAsync`) | Current SDK 54/55 API |
| Gallery | `expo-image-picker` (`launchImageLibraryAsync`, `mediaTypes: ['images']`) | No permission needed for picking on iOS |
| Contacts | `expo-contacts` (`presentFormAsync(null, contact, { isNew: true })`) | Native prefilled New Contact form; current API on SDK 54/55 (deprecated only in SDK 57+) |
| Validation | `zod` v4 | Library's structured-output helpers accept Zod v4 schemas |
| iOS config | `NSCameraUsageDescription`, `NSContactsUsageDescription` in app.json `ios.infoPlist` | Required permission strings |

## 5. Architecture

Lean state-machine, single root component. The two model hooks live at the root and
**never unmount** — unmounting `useLLM` mid-generation is a documented app crash.
Screens are dumb components selected by the state machine.

```
App.tsx                      initExecutorch() at module top; renders <Scanner/>
hooks/useScannerPipeline.ts  owns useOCR + useLLM; exposes { phase, downloadProgress,
                             fields, rawText, error, scanCard(uri), cancel(), reset() }
lib/schema.ts                Zod ContactFields schema
lib/ocrToText.ts             pure: OCRDetection[] → raw text
lib/prompt.ts                pure: builds LLM system prompt
lib/contacts.ts              ContactFields → expo-contacts shape; permission + native form
components/ModelLoadingScreen.tsx
components/CaptureScreen.tsx
components/ProcessingScreen.tsx
components/ReviewScreen.tsx
```

**State machine**: `loading-models → capture → processing → review → done`
(+ `error` sub-states that return to their originating state).

### ContactFields schema (lib/schema.ts)

All fields **nullable and optional** (the prompt tells the model to use `null` for
absent fields, so the schema must accept null — otherwise valid outputs would fail
validation). A normalize step after validation maps `null` → `undefined` and missing
arrays → `[]` so UI code only deals with one absence shape:

```
firstName, lastName, company, jobTitle: string | null?
phones: string[] | null?        emails: string[] | null?
website, address: string | null?
```

### OCR post-processing (lib/ocrToText.ts)

- Sort detections top→bottom, then left→right within a line (bands by bbox `y1`;
  defensive — within-line ordering was scrambled in a past library version, #1159).
- Drop detections with `score < 0.3`.
- Join into newline-separated text; cap at 1,500 chars (context-overflow guard —
  overflow surfaces as the cryptic "error code: 18").

### LLM strategy (lib/prompt.ts + pipeline)

- System prompt: `getStructuredOutputPrompt(zodSchema)` + short instructions
  ("extract contact fields from this business-card OCR text; use null for absent
  fields; do not invent data") + `/no_think` suffix (Qwen 3).
- **Functional mode** — `llm.generate([system, user])`, stateless; each scan gets a
  fresh context so history never accumulates.
- Parse with `fixAndValidateStructuredOutput(response, zodSchema)` (jsonrepair-backed).
- On validation failure: one automatic retry with the validation error appended to
  the user message. On second failure: degrade gracefully (see §7).

### Memory sequencing

Both hooks mount (and download) at startup, but **inference is strictly sequential**:
`await ocr.forward(...)` fully completes before `llm.generate(...)` starts. OCR peaks
at ~1.3 GB RAM during inference; the quantized 0.6B LLM is small enough to stay
resident alongside it on target hardware (verify on-device early — see §8 risks).

## 6. Contact save (lib/contacts.ts)

1. `Contacts.requestPermissionsAsync()` — if denied → alert with "Open Settings";
   review data stays on screen.
2. Map ContactFields → expo-contacts shape: `firstName`, `lastName`, `company`,
   `jobTitle`, `phoneNumbers: [{ number, label: 'work' }]`,
   `emails: [{ email, label: 'work' }]`, `urlAddresses`, `addresses`.
3. `Contacts.presentFormAsync(null, contact, { isNew: true })` → native form;
   the user taps Save/Cancel there. Either way the app returns to `done`.

## 7. Error handling

| Failure | Behavior |
|---|---|
| Model download fails | Error card + Retry; `downloadProgress` reflects resume |
| Camera permission denied | Inline explanation + Open Settings; gallery path still works |
| OCR yields nothing usable (empty after filtering) | "Couldn't read the card" + Retake / Pick another |
| LLM JSON fails schema (after 1 retry) | Open review anyway: empty fields + raw OCR text displayed for manual copy-paste — never hard-fail |
| Context overflow | Prevented by 1,500-char cap on OCR text |
| Contacts permission denied | Alert + Open Settings; review state preserved |
| Cancel during generation | `interrupt()` → wait for `isGenerating === false` → back to capture (never state-change while generating) |

## 8. Risks / known gotchas (from research, all sourced)

- **SDK pin**: must scaffold on Expo SDK 55, not latest. Expect a future migration
  (expo-contacts `presentFormAsync` is deprecated from SDK 57; library 0.10 rewrite
  is underway with breaking changes).
- **Crash-on-unmount while generating** — designed out via root-level hooks + the
  cancel protocol.
- **Memory**: OCR ~1.3 GB peak. If OCR + resident LLM proves too much on the test
  device, fallback is `preventLoad` on the LLM until OCR inference completes.
  Validate the happy path on-device in the first implementation milestone.
- **First-run download** is ~0.5 GB total — demo on Wi-Fi first.
- **Xcode**: an open issue breaks builds on Xcode 26.4 / Apple Clang 21 (fmt
  consteval, RN-ecosystem-wide, #1081). Check local Xcode version before starting.
- **Release builds** can't target the iOS simulator (ExecuTorch limitation) — release
  testing is device-only.

## 9. Testing

**Jest unit tests** (run on Mac, no device):
- `ocrToText`: line banding/sorting (incl. scrambled-order regression case), score
  filtering, char cap.
- `schema`: parses valid/partial/messy LLM outputs; rejects wrong shapes.
- `contacts` mapping: field → expo-contacts shape, empty-field omission.
- `prompt`: contains schema instructions and `/no_think`.

**Manual on-device checklist** (model pipeline is device-only):
- Happy path with a real card → contact saved correctly.
- Rotated/angled card; non-card photo (graceful failure).
- Camera and contacts permission denials.
- Airplane-mode scan after models cached (the offline money shot).
- Cancel mid-generation; immediate rescan after save.

## 10. References

- Docs: https://docs.swmansion.com/react-native-executorch/ (v0.9.x)
- useOCR: …/docs/hooks/computer-vision/useOCR — useLLM: …/docs/hooks/natural-language-processing/useLLM
- Getting started (initExecutorch, Expo dev-build requirement): …/docs/fundamentals/getting-started
- Compatibility table: …/docs/other/compatibility
- Benchmarks (size/RAM/speed): …/docs/benchmarks/*
- expo-contacts SDK 54: https://docs.expo.dev/versions/v54.0.0/sdk/contacts/
- Issues referenced: software-mansion/react-native-executorch #606, #948, #776, #726, #1159, #1081, #1326, #680
