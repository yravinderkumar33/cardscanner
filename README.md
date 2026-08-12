# CardScanner

An iPhone app that turns a photo of a paper business card into an iOS contact, using a language model that runs entirely on the phone.

No server, no API key, no account. The photo is read by an on-device OCR pair (CRAFT + CRNN), the resulting text is handed to a 0.6B-parameter language model (Qwen 3, 4-bit weights) running on ExecuTorch, and the model returns structured JSON that becomes a contact. The card image, the extracted fields and the raw text stay in the app's Documents directory. The models are downloaded once on first launch — the only network activity in the app, described in full below.

This is a working proof-of-concept: it builds, it runs, and the tests pass.

## Why on-device inference is the point

The claim the app exists to support is that a small language model doing real structured-extraction work on a phone is now practical, and that this changes three concrete things:

- **The data never leaves.** There is no endpoint to send a business card to, so there is no endpoint that can log it, retain it, or be breached. A reviewer can verify this by putting the phone in airplane mode after setup, which is how it was verified here.
- **It works with no connection.** On a plane, in a basement, in a conference hall with saturated Wi-Fi — the most likely place to be handed a business card.
- **No per-request cost, no rate limit, no vendor in the path.** Inference is a local CPU cycle. Nothing to rotate, deprecate, or reprice.

The trade is stated below: ~530 MB of model to download once, and a model far smaller than anything you'd call from a cloud API.

## Pipeline

```
  Camera capture / Photos import
            │
            ▼
  OCR  ── CRAFT detector + CRNN recognizer (en)  ── on-device
            │  boxes sorted into text lines
            ▼
  SLM  ── Qwen 3 0.6B, 4-bit, ExecuTorch/XNNPACK ── on-device
            │  strict-JSON prompt, streamed tokens
            ▼
  strip <think> + fences ─▶ jsonrepair ─▶ zod schema ─▶ normalize
            │
      ┌─────┴──────┐
    valid       invalid ─▶ retry once, parse error fed back
      │                          │
      │                     still invalid ─▶ degraded mode:
      │                          │           raw OCR lines, tap to assign
      ▼                          │
  Review & edit  ◀───────────────┘
  (AI-filled markers, per-field validation)
            │
            ▼
  Apple's native New Contact form  ─▶  user presses Save
```

Once the models are on disk, every stage above the last box runs with no network access. The last box is Apple's own `CNContactViewController(forNewContact:)`: the app hands it a pre-filled contact and the user presses Save. The app never reads the address book, and therefore requests **no Contacts permission at all** — verified at runtime with Contacts access revoked. Camera and photo library are the only permissions ever requested.

## The engineering around a small model

This is the part worth reading if you're building something similar. A 0.6B model is not GPT-class. Left alone it will wrap its answer in prose, emit a markdown fence, leak a `<think>` block, rename a key, or produce JSON with a trailing comma. None of that is a reason not to use it. It is a reason to build a layer around it.

What that layer is here, in order:

1. **A prompt with no room in it.** The system prompt states the exact JSON shape, forbids explanation and markdown, requires `null` for absent fields, forbids inventing data, and ends with `/no_think` to suppress Qwen's reasoning block. See `lib/prompt.ts`.
2. **Cleanup.** Strip any `<think>…</think>` block and any ```` ``` ```` fences, then slice from the first `{` to the last `}` to discard surrounding prose.
3. **Repair.** Run the result through `jsonrepair` before `JSON.parse`, which absorbs trailing commas, unquoted keys and single quotes.
4. **Validation.** Parse against a `zod` schema, then normalize (`null`/`""` collapse to absent, missing arrays become empty arrays).
5. **An emptiness check.** Every field is optional, so `{}` — or an object with renamed keys — would otherwise validate as a *successful* extraction of nothing. That is treated as a parse failure instead. This is a real bug that a permissive schema hides.
6. **One retry, with the error.** The failure message is fed back to the model verbatim: *"Your previous answer was not valid JSON for the required shape (error: …). Respond again with ONLY the JSON object."* One retry, not a loop — a loop turns a bounded scan into an unbounded wait.
7. **A degraded mode, not an error screen.** If it still fails, the app shows the raw OCR lines and lets the user assign each line to a field by tapping. The scan still ends in a saved contact. A small model that fails 1 time in N is only unshippable if failure means "sorry".

The control flow lives in `lib/extraction.ts` (46 lines) and `lib/parseModelJson.ts` (48 lines). `extractContact` takes its OCR and LLM calls as injected dependencies and `parseModelJson` is pure, which is why both are unit-tested with no simulator and no native module.

OCR needs its own layer. The detector returns boxes in arbitrary order, so `lib/ocrToText.ts` drops detections scoring below 0.3, bands the rest into lines by y-center (a box joins the current line if its center is within half a box height of the line's first box), sorts each line left-to-right, and caps the result at 1500 characters before it reaches the model's context.

## Measured performance

**Every number below was measured on the iOS Simulator running on an Apple Silicon Mac. The simulator executes on the Mac's CPU. These are not iPhone numbers.** Performance on physical device hardware has not been measured yet.

| iOS Simulator, Apple Silicon Mac — *not* a device | Release build | Debug build |
|---|---|---|
| End-to-end scan (photo in → fields on screen) | ~2.1–2.2 s | ~2.7–3.5 s |
| Token generation | ~39 tok/s | ~28–29 tok/s |

The gap between debug and Release is large enough to be worth stating: measure this kind of work in Release or don't quote the number.

## Models

Downloaded once on first launch from Hugging Face (`software-mansion/react-native-executorch`), then never again. Sizes are the actual byte counts from the download URLs; the same totals are hardcoded as offline fallbacks in `hooks/useScannerPipeline.ts`.

| Model | Files | Bytes |
|---|---|---|
| OCR (CRAFT detector int8 + CRNN recognizer, English) | detector + recognizer | 20,912,264 + 18,368,900 (~37 MB) |
| LLM (Qwen 3 0.6B, XNNPACK 8da4w — 4-bit weights) | model + tokenizer + tokenizer config | 505,686,400 + 11,422,654 + 9,675 (~493 MB) |

**~530 MB total.** The download manager is resumable, with distinct states for in-progress, failed, offline and low-storage, and Settings lets you delete the model files and re-download them later. After the download the app needs no network; verified in airplane mode.

## Privacy, and the one network caveat

Card photos, thumbnails, extracted fields and raw OCR text are written to the app's Documents directory and nowhere else. There is no account, no sign-up, and no backend server of any kind.

The one exception is on first launch. The models are fetched over the network, and the underlying open-source library (`react-native-executorch`) pings its own download counter as part of that fetch, sending: bundle id, platform, library version, model name, a locale-derived country code, and a simulator flag. Nothing about the user or their cards is included, and nothing is sent afterwards. This is disclosed on the in-app Privacy screen, in `docs/appstore/privacy-policy.md`, and in the App Store description. It is why this README says "no server of ours" and never "zero network activity ever".

## Requirements

- **iPhone only, portrait only, iOS 17+.** The deployment target is forced by `react-native-executorch`'s podspec (`s.platforms = { :ios => '17.0' }`) and set to match in `app.json` via `expo-build-properties`.
- **A custom dev build. Expo Go is not supported** — the app links a native runtime.
- Xcode with an iOS 17+ SDK, Node, and CocoaPods.

## Run

```sh
npm install
npx expo run:ios --device                        # physical iPhone (recommended)
npx expo run:ios                                 # simulator — no camera, use the Photos import path
npx expo run:ios --configuration Release         # how the numbers above were measured
```

Use Wi-Fi on first launch for the model download.

Release builds do run on the simulator; that is how the App Store screenshots were captured.

## Test

```sh
npm test          # jest — 62 tests, 10 suites
npx tsc --noEmit
```

The tests cover the pure logic and need no simulator: OCR line assembly, JSON parse/repair/validate, schema normalization, extraction control flow, contact mapping, vCard generation, field heuristics, date grouping, prompt construction, model-storage bookkeeping. TypeScript runs in strict mode and passes clean.

## Project layout

```
App.tsx                      initExecutorch, fonts, theme + toast providers,
                             model-retry remount
components/AppShell.tsx      phase router + overlay stack over an always-mounted
                             scan pipeline
components/*Screen.tsx       one file per screen (Onboarding, Capture, Processing,
                             Review, Success, History, Detail, Models, Settings, Privacy)
components/ui/               shared primitives and icons
hooks/useScannerPipeline.ts  OCR + LLM hooks (never unmounted), scan state machine,
                             cancellation, download state classification
lib/                         pure logic, no React Native imports:
  extraction.ts              scan orchestration, retry, degraded fallback
  parseModelJson.ts          strip / repair / validate / normalize
  ocrToText.ts               detection boxes → ordered text lines
  prompt.ts  schema.ts       system prompt, zod contract
  contactMapping.ts          fields → iOS contact
  contacts.ts                native New Contact form handoff
  vcard.ts  fieldGuess.ts  dates.ts
  historyStore.ts            Documents/scans — local-only history + thumbnails
  modelManager.ts            on-disk model bytes, install check, deletion
  settingsStore.ts
  __tests__/                 62 Jest tests
theme/                       design tokens (dark + light), fonts, layout metrics
plugins/                     config plugins (see Notes)
docs/appstore/               App Store submission package
docs/design/                 design prototype prompt
```

## Features

Onboarding and the model-download manager. Camera capture with a card guide. A two-stage processing screen showing the live token stream and the highest-scoring OCR boxes. Review & edit with per-field AI-filled markers and validation. The degraded manual-assign fallback. Local History with search, swipe-to-delete, re-save and `.vcf` share. Settings with model storage management, a privacy explainer, and light/dark/system themes. VoiceOver support throughout, including a non-gesture delete action for swipe-to-delete rows.

## Current limits, and what's next

Genuine limits, not a roadmap disclaimer:

- **Device performance is unmeasured.** Every number in this README is from the simulator on an Apple Silicon Mac. Benchmarking on real iPhone hardware, across a few generations, is the single most useful next step.
- **English OCR only.** The CRNN recognizer is loaded with `language: 'en'`. Cards in other scripts will produce garbage text, and the model will faithfully structure that garbage.
- **One card at a time.** No batch import, no multi-card photo.
- **No on-device fine-tuning or adaptation.** The model is used exactly as shipped. Prompting and the repair layer are the only levers.
- **The 0.6B model is the accuracy ceiling.** Unusual layouts, heavy stylization and dense multi-language cards are where it degrades. The degraded mode is the answer, not a fix.
- **No measured accuracy figure.** There is no labelled card corpus here, so extraction quality is reported by nobody, including this README.
- **iOS only.** ExecuTorch runs on Android too and the app code is React Native, but nothing here has been built or tested for Android.

## Notes

- `docs/appstore/` holds the App Store submission package: listing copy, privacy policy, support page, App Privacy answers, reviewer notes and screenshots.
- The UI was implemented from a Claude Design prototype; the prompt that produced it is in `docs/design/claude-design-prompt.md`.
- **Xcode 26.4 / Apple Clang 21 breaks stock React Native builds** (upstream issue). This repo carries the workaround as a config plugin, `plugins/withFmtConstevalPatch.js` (`FMT_USE_CONSTEVAL=0`).
- Saving requests **no** Contacts permission. `lib/contacts.ts` calls `presentFormAsync(null, contact, { isNew: true })`, which presents `CNContactViewController(forNewContact:)` — a user-mediated system form that needs no Contacts authorization. The Contacts usage-description string stays configured in `app.json` (the `expo-contacts` plugin's `contactsPermission`) deliberately, as a defensive measure; nothing triggers it, so it is never shown. Do not "fix" it away.
- iOS does not report whether the user tapped Done or Cancel on the native New Contact form, so the success screen shows after the form is dismissed either way.
- The model hooks are mounted for the app's lifetime and never unmounted — unmounting mid-generation crashes the runtime. Cancellation goes through `llm.interrupt()` plus a scan-id guard, not unmounting.

## Stack

Expo SDK 55 · React Native 0.83 · React 19 · TypeScript (strict) · New Architecture · `react-native-executorch` 0.9.3 (pinned) with `react-native-executorch-expo-resource-fetcher`, XNNPACK backend · `zod` · `jsonrepair` · expo-camera / expo-image-picker / expo-image-manipulator / expo-contacts / expo-file-system / expo-sharing / expo-network · react-native-svg + phosphor-react-native.

## What this generalizes to

Business cards are the example, not the point. The shape of the pipeline is: **unstructured real-world input → on-device OCR → small on-device LLM under a strict prompt → repair and schema validation → typed data your app can trust.** Receipts, forms, labels, handwritten notes, meter readings, packing slips — same five stages, same interesting engineering: the prompt, the repair layer, and what you do when the small model is wrong.
