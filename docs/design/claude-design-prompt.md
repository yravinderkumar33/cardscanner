# Prompt for Claude — CardScanner production design prototype

Design a production-ready, interactive mobile app prototype for **CardScanner** — an
iOS app that scans paper business cards and saves them as contacts using AI that runs
entirely on the phone. A working engineering POC exists; your job is to reimagine it
as a polished consumer product and deliver a clickable prototype covering every
screen and every state.

## The product

Point the camera at a business card → on-device OCR reads the text → a small
on-device language model structures it into contact fields → user reviews/edits →
saves into iOS Contacts. The differentiators, which the design must radiate:

- **Private by design.** The card never leaves the phone. No cloud, no account, no
  sign-up, no subscription upsell. There are deliberately NO login/registration
  screens — lean into that as a brand moment ("your contacts are yours").
- **Works offline.** After a one-time model download, everything works in airplane
  mode. Offline is a feature, never an error state.
- **Honest AI.** The AI is visible doing its work (token-by-token streaming during
  extraction) and admits failure gracefully (falls back to manual entry with the raw
  scanned text) — design these as moments of trust, not embarrassment.

## Real engineering constraints (design around these; do not idealize them away)

- First launch requires a **~0.5 GB one-time model download** (two models: a small
  OCR pack ~45 MB that finishes fast, a language model ~470 MB that takes minutes on
  Wi-Fi). Design this as a first-class onboarding experience: progress per model,
  Wi-Fi recommendation, what-is-downloading explanation, resumable/retry on failure.
- Scan timing: OCR ≈ 1–2 s; LLM extraction ≈ **10–30 s** with visible streaming
  tokens. The wait is the product's biggest UX challenge — design a staged,
  reassuring, cancellable processing experience (e.g. "Reading the card…" →
  "Understanding the details…" with the live token stream as an "AI at work" moment).
- Saving hands off to the **native iOS "New Contact" form** (prefilled, user taps
  Save there). The app's save flow must set expectations for that native detour and
  own the return moment (success state).
- Minimum iOS 17, iPhone-only, portrait-first.
- Extraction can partially fail: design a **degraded review state** where fields come
  back empty but the raw OCR text is shown for manual copy-in.

## Screens to design (current app + production reimagining)

1. **Onboarding / first launch** — value proposition (3 short beats max), then the
   model-download experience described above. Include: download-failed + retry,
   offline-at-first-launch, and a "come back later, we'll be ready" affordance.
2. **Capture (home)** — full-bleed camera with a card-shaped guide overlay, shutter,
   gallery import, flash toggle, entry point to history and settings. States: idle,
   steadying/hint, camera-permission-denied (explainer + Open Settings + gallery
   still works), post-error banner ("Couldn't read that card — try a sharper photo").
3. **Processing** — the two-stage AI moment with live token stream and Cancel.
   States: OCR stage, LLM stage (streaming), cancel-confirmed return.
4. **Review & edit** — extracted fields as editable elements (name, job title,
   company, phones[], emails[], website, address), a subtle per-field "AI filled
   this" affordance, raw scanned text accessible as reference, card photo thumbnail,
   Add to Contacts (primary) + Rescan. States: normal, degraded/manual (empty fields
   + prominent raw text), saving-in-progress, contacts-permission-denied (alert →
   Open Settings, edits preserved).
5. **Save success** — confirmation after the native form returns; "Scan another
   card"; the saved card lands in history.
6. **History** (production addition) — locally stored past scans: card-photo
   thumbnails, name/company, search, detail view (photo + fields + re-save/share),
   swipe-to-delete, empty state ("Your scans stay on this phone").
7. **Settings** (production addition) — storage/model management (models downloaded,
   size on disk, delete & re-download), OCR language packs (future), appearance
   (light/dark/system), privacy explainer page ("How on-device AI works" — a short,
   proud, plain-language page), about/version.
8. **System/edge catalog** — anything not covered above: low-storage warning during
   download, model-update available, first-scan coach marks.

Cover for each screen: default, loading, empty, error, and permission variants where
applicable. Both **light and dark mode**.

## Design direction

- iOS-native feel (respect platform idioms — sheets, large titles, SF-Symbols-style
  iconography, native form handoff) with a distinctive identity; avoid the generic
  AI-gradient look. The personality: a precise, trustworthy pocket tool — think
  "beautiful scanner utility", not "chatbot".
- Motion and micro-interaction notes matter: shutter feedback, the card outline
  locking on, token stream cadence, field-fill-in animation on the review screen,
  haptic moments.
- Accessibility: Dynamic Type friendliness, WCAG-AA contrast in both modes,
  VoiceOver labels for the AI states ("Extracting details, about 20 seconds").
- Use realistic content everywhere (real-looking names, Indian and international
  phone formats, a believable card photo) — no lorem ipsum, no 555 numbers.

## Deliverable

One **interactive prototype** in a single self-contained artifact: an iPhone-framed
(~390×844) clickable walkthrough where every screen above is reachable through real
navigation flows, plus a small floating dev/state switcher to jump directly to any
screen+state combination (including the rare ones like download-failed and degraded
review). Include a screen-map overview (all screens at a glance) and one short
rationale note per screen explaining the key design decision.
