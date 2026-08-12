# App Store screenshots

Five 6.9" iPhone screenshots, **1320 × 2868** — the size App Store Connect currently requires
for the iPhone set. Upload them in this order; the order on the product page is the order you
set in App Store Connect, and the first two are what most people ever see.

| File | Screen | Why it is in the set |
|---|---|---|
| `01-capture.png` | Capture | Shows the card guide and that this is a camera-first tool |
| `02-ai-on-device.png` | Processing | The differentiator: the model streaming tokens on the phone at ~39 tok/s, with the recognized text boxed on the real photo |
| `03-review.png` | Review & edit | Every field filled and marked as AI-filled, editable before saving |
| `04-history.png` | History | Local-only library, grouped by day, "nothing here ever syncs" |
| `05-privacy.png` | Privacy | The on-device pipeline diagram and the honest download-counter disclosure |

## How these were produced

Captured from a **Release** build (`-configuration Release`) running on an iPhone 17 Pro Max
simulator, so there is no development client, no debug overlay and no dev-tools bubble in any
frame. The content is a real scan of a real rendered business card, not a mockup.

Worth knowing: a Release build **does** run on the simulator, contrary to the note that used
to be in the README. That is how these were captured, and it is the way to get clean
screenshots in future.

## Before you upload

These are **development screenshots taken from mock data**, good enough to review the
layout but not what should ship on the product page. Three things to redo on a real
iPhone first:

- **`01-capture.png` is a black frame** where the camera feed belongs — a simulator has
  no camera. It is the first screenshot a shopper sees. Retake it pointed at a real card.
- **`03-review.png` shows an imperfect extraction.** The synthetic card is rendered text,
  not a photograph, and the 0.6B model mis-assigns Company on it and drops the dot before
  `.com`. That is honest product behaviour — the validation warnings you can see are the
  app catching it — but a store screenshot should show a clean read. Scan a real printed
  card and retake.
- **`04-history.png` has a single row.** Scan three or four different real cards so the
  day grouping and thumbnails have something to show.

Everything in these frames is mock data: `Example Labs`, `priya@example.com`,
`+1 (415) 555-0198`, `1 Market Street, San Francisco 94105`. `example.com` is
IANA-reserved and `555-01xx` is the reserved fictional range, so no real person,
company, domain or phone line is implicated. Keep it that way if you re-shoot.

Captions are not burned into these images. Apple does not require them, but a short
caption band above each screen measurably improves conversion. If you add them, keep the
frames at 1320 × 2868.
