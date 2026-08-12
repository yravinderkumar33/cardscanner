# Prompt for Claude Design — App Store screenshot frames

Paste everything below the line into Claude Design.

---

Design a set of **six App Store screenshot frames** for an iPhone app. Each frame is a single
image that pairs a short caption with a screenshot of the app, composed on a branded
background. This is the set a shopper swipes through on the App Store product page.

## Hard technical constraints

- **Each frame is exactly 1320 × 2868 px** — the 6.9" iPhone size (17 Pro Max / 16 Pro Max).
  Design at that exact pixel size. Do not letterbox, do not round the corners of the frame
  itself, do not add drop shadows that bleed past the canvas edge.
- Deliver **one HTML file** containing all six frames stacked vertically, each frame its own
  element at exactly 1320 × 2868 so it can be screenshotted individually. Give each frame a
  visible label *outside* the canvas (e.g. `01`) so I can tell them apart while reviewing.
- Inside each frame, leave a **screenshot slot** with the phone screen at a 1320:2868 aspect
  ratio, scaled down and positioned per your composition. Fill each slot with a labelled
  placeholder block (e.g. "SCREEN 02 — processing") that I will replace with the real PNG.
  Do not draw a fake iPhone bezel with a notch or Dynamic Island — a simple rounded-rect
  screen edge is enough, or none at all.
- Self-contained: inline CSS, no external fonts, no CDN, no JavaScript.

## What the app is

CardScanner photographs a paper business card and turns it into an iOS contact. What makes
it unusual: **the AI runs entirely on the phone.** On-device text recognition reads the card,
then a 0.6B-parameter language model on the device sorts that text into name, company, job
title, phone, email, website and address. The user checks the fields and saves through
Apple's own New Contact form.

There is no account, no sign-up and no server. After a one-time model download on first
launch, the app works in airplane mode.

Its App Store subtitle is *"Offline AI, no account needed"*.

## The six screens, in order

The order matters: App Store search results show only the first two or three, so those must
carry the whole pitch on their own.

1. **Capture** — full-bleed camera view with a card-shaped bracket guide, shutter button,
   gallery and history buttons. Dark chrome.
2. **Processing** — the strongest screen. The scanned card with recognised-text boxes drawn
   on it, and a live panel streaming the language model's JSON output token by token, with a
   tokens-per-second readout. This is the "the AI is really running here" moment.
3. **Review & edit** — the extracted fields in labelled rows, each marked with a small
   sparkle where the AI filled it in, all editable, with a prominent "Add to Contacts" button.
4. **History** — past scans grouped by day with card thumbnails, a search field, and a line
   reading "nothing here ever syncs".
5. **Privacy** — a diagram of the pipeline drawn inside a phone outline (Photo → OCR → LLM →
   Contacts) with "No cloud step", and three stat cards reading 0 servers / 0 accounts / 0 ads.
6. **Free choice** — pick whichever of the above best closes the set, or repeat the strongest.

## Captions

Write the captions yourself. Rules:

- **Six words maximum.** Most should be four. They are read in under a second, at thumbnail
  size, often one-handed on a train.
- Lead with what the person gets, not what the software has. "Works with no connection" beats
  "Offline-capable architecture".
- Sentence case. No exclamation marks. No emoji. No "revolutionary", "seamless", "effortless",
  "powerful", "unleash", "AI-powered".
- One caption per frame, optionally with a shorter second line as support.
- Frame 1's caption must make sense to someone who has never heard of the app.

**These claims are true and are the material worth using:** the AI runs on the phone; it works
with no connection once set up; there is no account and no sign-up; cards never leave the
device; a scan takes about three seconds; you check every field before it saves; scans are
stored only on that phone.

**Do not write, because they are false:** any claim of zero network activity ever (the models
download once on first launch), any accuracy percentage, any speed claim in an absolute unit,
any comparison to a named competitor, and anything about price.

## Visual direction

Match the app so the frames and the screenshots read as one thing. The app's palette:

| Role | Dark | Light |
|---|---|---|
| Background | `#161826` | `#e4e7f5` |
| Surface | `#232532` | `#f3f5fe` |
| Text | `#e9e9ed` | `#292b31` |
| Muted text | `#9ba0b4` | `#565b6d` |
| Accent | `#9184d9` | `#796cbf` |
| Accent bright | `#d2cefd` | `#5d5294` |

Typeface: Inter, or the closest system stack. Headings medium weight with slightly tight
letter-spacing; the app never uses bold display faces.

**Build the set dark.** The app's identity is dark, its icon is dark, and a dark set stands out
against the App Store's white product page. Use light only if you can argue it reads better.

The app's signature mark is a **corner-bracket scan frame** — four L-shaped brackets in the
accent colour suggesting a card being framed. Reuse that motif rather than inventing new
decoration. There is no logo lockup to place; the app name appears in the listing already, so
do not paste a wordmark onto every frame.

Give the six frames one visual system: caption in the same position and size on every frame,
the screen slot at the same scale, a consistent background treatment. A subtle accent glow
behind the phone is welcome; gradients that shift hue frame to frame are not. Restraint reads
as quality here — this is a precise utility, not a consumer game.

## What to hand back

The single HTML file, plus a short note listing the six captions as plain text so I can check
them against the character limits and the truth constraints above.
